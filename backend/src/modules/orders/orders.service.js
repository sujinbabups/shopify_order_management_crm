const {
  Injectable,
  Dependencies,
  BadRequestException,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  Logger,
} = require('@nestjs/common');
const { Op } = require('sequelize');
const crypto = require('crypto');
const { ShopifyApiService } = require('../shopify/shopify-api.service');

// In-memory idempotency cache for 5 minutes
const idempotencyStore = new Map();

@Injectable()
@Dependencies(
  'SEQUELIZE',
  'ORDER_REPOSITORY',
  'ORDER_ITEM_REPOSITORY',
  'CUSTOMER_REPOSITORY',
  'PRODUCT_REPOSITORY',
  'SHOPIFY_STORE_REPOSITORY',
  ShopifyApiService
)
class OrdersService {
  constructor(
    sequelize,
    orderRepository,
    orderItemRepository,
    customerRepository,
    productRepository,
    shopifyStoreRepository,
    shopifyApiService
  ) {
    this.sequelize = sequelize;
    this.orderRepository = orderRepository;
    this.orderItemRepository = orderItemRepository;
    this.customerRepository = customerRepository;
    this.productRepository = productRepository;
    this.shopifyStoreRepository = shopifyStoreRepository;
    this.shopifyApiService = shopifyApiService;
    this.logger = new Logger('OrdersService');
  }

  /**
   * Validate incoming order creation payload
   */
  validateOrderInput(orderDto) {
    const { customer, customerId, lineItems } = orderDto;

    // 1. Customer validation
    if (!customerId && !customer) {
      throw new BadRequestException('Customer information or existing customerId is required');
    }

    if (customer) {
      if (!customer.email || typeof customer.email !== 'string') {
        throw new BadRequestException('Customer email is required');
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(customer.email.trim())) {
        throw new BadRequestException('Please provide a valid customer email address');
      }

      if (!customer.firstName && !customer.name) {
        throw new BadRequestException('Customer first name is required');
      }
    }

    // 2. Line items validation
    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      throw new BadRequestException('Order must contain at least one line item');
    }

    for (let i = 0; i < lineItems.length; i++) {
      const item = lineItems[i];
      if (!item.productTitle && !item.title) {
        throw new BadRequestException(`Line item at index ${i} is missing product title`);
      }

      const quantity = parseInt(item.quantity, 10);
      if (isNaN(quantity) || quantity <= 0) {
        throw new BadRequestException(`Quantity for item "${item.productTitle || item.title}" must be a positive integer`);
      }

      const unitPrice = parseFloat(item.unitPrice);
      if (isNaN(unitPrice) || unitPrice < 0) {
        throw new BadRequestException(`Unit price for item "${item.productTitle || item.title}" must be a valid non-negative number`);
      }
    }
  }

  /**
   * Create an order in Shopify and persist in PostgreSQL inside a transaction
   */
  async createOrder(orderDto, idempotencyKey = null) {
    this.validateOrderInput(orderDto);

    // 1. Check idempotency lock to prevent double submissions
    const lockKey = idempotencyKey || this.generateSubmissionFingerprint(orderDto);
    if (idempotencyStore.has(lockKey)) {
      const existingRecord = idempotencyStore.get(lockKey);
      if (existingRecord.status === 'IN_FLIGHT') {
        throw new ConflictException('Order submission is currently being processed. Please do not submit twice.');
      }
      if (existingRecord.status === 'COMPLETED') {
        return existingRecord.result;
      }
    }

    // Set lock
    idempotencyStore.set(lockKey, { status: 'IN_FLIGHT', timestamp: Date.now() });

    // 2. Retrieve active Shopify store
    const store = await this.shopifyStoreRepository.findOne({
      where: { isActive: true },
      order: [['connectedAt', 'DESC']],
    });

    if (!store || !store.isActive) {
      idempotencyStore.delete(lockKey);
      throw new BadRequestException('No active Shopify store connected. Please connect a store first.');
    }

    const accessToken = store.accessToken;
    if (!accessToken) {
      idempotencyStore.delete(lockKey);
      throw new BadRequestException('Shopify store access token is missing or invalid.');
    }

    // 3. Resolve customer details
    let resolvedCustomer = null;
    if (orderDto.customerId) {
      resolvedCustomer = await this.customerRepository.findByPk(orderDto.customerId);
      if (!resolvedCustomer) {
        idempotencyStore.delete(lockKey);
        throw new NotFoundException(`Customer with ID ${orderDto.customerId} not found`);
      }
    } else {
      resolvedCustomer = {
        firstName: orderDto.customer.firstName || orderDto.customer.name.split(' ')[0],
        lastName: orderDto.customer.lastName || orderDto.customer.name.split(' ').slice(1).join(' ') || '',
        email: orderDto.customer.email.toLowerCase().trim(),
        phone: orderDto.customer.phone || null,
      };
    }

    // 4. Calculate authoritative order line items & totals
    const normalizedLineItems = orderDto.lineItems.map((item) => {
      const quantity = parseInt(item.quantity, 10);
      const unitPrice = parseFloat(parseFloat(item.unitPrice).toFixed(2));
      const totalPrice = parseFloat((quantity * unitPrice).toFixed(2));

      return {
        productTitle: item.productTitle || item.title,
        title: item.productTitle || item.title,
        variantTitle: item.variantTitle || null,
        sku: item.sku || null,
        quantity,
        unitPrice,
        totalPrice,
        variantId: item.variantId || null,
        productId: item.productId || null,
      };
    });

    const calculatedTotal = normalizedLineItems.reduce(
      (sum, item) => sum + item.totalPrice,
      0
    );

    // 5. Submit Order to Shopify Admin API (Shopify is the source of truth)
    let shopifyOrder;
    try {
      shopifyOrder = await this.shopifyApiService.createOrder(
        store.shopDomain,
        accessToken,
        {
          email: resolvedCustomer.email,
          customer: resolvedCustomer,
          lineItems: normalizedLineItems,
          financialStatus: orderDto.financialStatus || 'paid',
          currency: orderDto.currency || 'USD',
          note: orderDto.note || 'Created from Mini Order Management CRM',
        }
      );
    } catch (shopifyError) {
      idempotencyStore.delete(lockKey);
      this.logger.error(`Shopify order creation failed: ${shopifyError.message}`);
      throw shopifyError;
    }

    // 6. Persist order, customer, and line items in PostgreSQL inside a transaction
    let persistedOrder;
    try {
      persistedOrder = await this.sequelize.transaction(async (t) => {
        // a. Persist or update Customer
        let customerRecord = null;
        if (orderDto.customerId) {
          customerRecord = await this.customerRepository.findByPk(orderDto.customerId, {
            transaction: t,
          });
          if (shopifyOrder.customer?.id && !customerRecord.shopifyCustomerId) {
            await customerRecord.update(
              { shopifyCustomerId: shopifyOrder.customer.id },
              { transaction: t }
            );
          }
        } else {
          // Check by email or shopifyCustomerId
          if (shopifyOrder.customer?.id) {
            customerRecord = await this.customerRepository.findOne({
              where: { shopifyCustomerId: shopifyOrder.customer.id },
              transaction: t,
            });
          }
          if (!customerRecord && resolvedCustomer.email) {
            customerRecord = await this.customerRepository.findOne({
              where: { email: resolvedCustomer.email },
              transaction: t,
            });
          }

          if (customerRecord) {
            await customerRecord.update(
              {
                shopifyCustomerId: shopifyOrder.customer?.id || customerRecord.shopifyCustomerId,
                firstName: resolvedCustomer.firstName || customerRecord.firstName,
                lastName: resolvedCustomer.lastName || customerRecord.lastName,
                phone: resolvedCustomer.phone || customerRecord.phone,
              },
              { transaction: t }
            );
          } else {
            customerRecord = await this.customerRepository.create(
              {
                shopifyCustomerId: shopifyOrder.customer?.id || null,
                firstName: resolvedCustomer.firstName,
                lastName: resolvedCustomer.lastName,
                email: resolvedCustomer.email,
                phone: resolvedCustomer.phone,
              },
              { transaction: t }
            );
          }
        }

        // b. Create Order
        const newOrder = await this.orderRepository.create(
          {
            shopifyOrderId: shopifyOrder.id,
            shopifyOrderNumber: shopifyOrder.orderNumber,
            orderName: shopifyOrder.name,
            customerId: customerRecord ? customerRecord.id : null,
            shopifyStoreId: store.id,
            financialStatus: shopifyOrder.financialStatus || 'paid',
            fulfillmentStatus: shopifyOrder.fulfillmentStatus || null,
            totalAmount: shopifyOrder.totalAmount || calculatedTotal,
            currency: shopifyOrder.currency || 'USD',
            orderDate: new Date(shopifyOrder.createdAt),
          },
          { transaction: t }
        );

        // c. Create OrderItems
        const itemsToInsert = (shopifyOrder.lineItems || normalizedLineItems).map((item) => ({
          orderId: newOrder.id,
          shopifyLineItemId: item.id || null,
          productTitle: item.productTitle || item.title,
          variantTitle: item.variantTitle || null,
          sku: item.sku || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        }));

        await this.orderItemRepository.bulkCreate(itemsToInsert, { transaction: t });

        // d. Register products if not present
        for (const item of normalizedLineItems) {
          if (item.productTitle) {
            const existingProduct = await this.productRepository.findOne({
              where: { title: item.productTitle },
              transaction: t,
            });
            if (!existingProduct) {
              await this.productRepository.create(
                {
                  shopifyProductId: item.productId || null,
                  title: item.productTitle,
                  sku: item.sku || null,
                },
                { transaction: t }
              );
            }
          }
        }

        return newOrder;
      });
    } catch (dbError) {
      this.logger.error(
        `CRITICAL: Order created in Shopify (${shopifyOrder.name} / ${shopifyOrder.id}) but failed local database persistence: ${dbError.message}`
      );
      // Recovery information recorded in response
      throw new InternalServerErrorException({
        success: false,
        message: 'Order created in Shopify, but local database persistence encountered an error. The order will be reconciled during the next synchronization.',
        shopifyOrderId: shopifyOrder.id,
        shopifyOrderNumber: shopifyOrder.orderNumber,
      });
    }

    // 7. Load complete order with associations for confirmation
    const completeOrder = await this.findById(persistedOrder.id);

    const result = {
      success: true,
      message: `Order ${shopifyOrder.name} created successfully in Shopify and recorded in CRM`,
      data: completeOrder,
    };

    // Update idempotency store
    idempotencyStore.set(lockKey, {
      status: 'COMPLETED',
      result,
      timestamp: Date.now(),
    });

    return result;
  }

  /**
   * Find order by ID with customer, items, and store
   */
  async findById(id) {
    const order = await this.orderRepository.findByPk(id, {
      include: [
        { model: this.customerRepository, as: 'customer' },
        { model: this.orderItemRepository, as: 'items' },
        { model: this.shopifyStoreRepository, as: 'store', attributes: ['id', 'shopDomain'] },
      ],
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return order;
  }

  /**
   * List orders with pagination and search
   */
  async findAll({ search = '', status = '', page = 1, limit = 20 } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const where = {};
    if (status) {
      where.financialStatus = status;
    }
    if (search && search.trim()) {
      where[Op.or] = [
        { orderName: { [Op.iLike]: `%${search.trim()}%` } },
        { shopifyOrderNumber: { [Op.iLike]: `%${search.trim()}%` } },
      ];
    }

    const { rows, count } = await this.orderRepository.findAndCountAll({
      where,
      limit: limitNum,
      offset,
      order: [['orderDate', 'DESC']],
      include: [
        { model: this.customerRepository, as: 'customer' },
        { model: this.orderItemRepository, as: 'items' },
      ],
    });

    return {
      orders: rows,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum),
      },
    };
  }

  generateSubmissionFingerprint(orderDto) {
    const email = orderDto.customer?.email || orderDto.customerId || '';
    const itemsKey = (orderDto.lineItems || [])
      .map((i) => `${i.productTitle || i.title}:${i.quantity}:${i.unitPrice}`)
      .join('|');
    return crypto.createHash('sha256').update(`${email}-${itemsKey}`).digest('hex');
  }
}

module.exports = { OrdersService };
