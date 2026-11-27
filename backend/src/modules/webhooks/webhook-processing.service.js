const {
  Injectable,
  Dependencies,
  BadRequestException,
  Logger,
} = require('@nestjs/common');

@Injectable()
@Dependencies(
  'SEQUELIZE',
  'ORDER_REPOSITORY',
  'ORDER_ITEM_REPOSITORY',
  'CUSTOMER_REPOSITORY',
  'PRODUCT_REPOSITORY',
  'SHOPIFY_STORE_REPOSITORY'
)
class WebhookProcessingService {
  constructor(
    sequelize,
    orderRepository,
    orderItemRepository,
    customerRepository,
    productRepository,
    shopifyStoreRepository
  ) {
    this.sequelize = sequelize;
    this.orderRepository = orderRepository;
    this.orderItemRepository = orderItemRepository;
    this.customerRepository = customerRepository;
    this.productRepository = productRepository;
    this.shopifyStoreRepository = shopifyStoreRepository;
    this.logger = new Logger('WebhookProcessingService');
  }

  /**
   * Process order webhook event (orders/create or orders/updated)
   * Runs in an atomic transaction to guarantee database consistency.
   *
   * @param {string} topic - e.g. 'orders/create' or 'orders/updated'
   * @param {object} payload - Shopify order payload
   * @param {object} store - ShopifyStore database instance
   */
  async processOrderWebhook(topic, payload, store) {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Invalid or empty webhook payload');
    }

    // Extract Shopify order identifiers
    const rawOrderId = payload.id;
    const shopifyOrderId =
      payload.admin_graphql_api_id ||
      (rawOrderId ? `gid://shopify/Order/${rawOrderId}` : null);

    if (!shopifyOrderId) {
      throw new BadRequestException('Webhook payload missing required Shopify order ID');
    }

    const rawOrderNumber = payload.order_number || payload.number;
    const shopifyOrderNumber = (rawOrderNumber || payload.name?.replace('#', '') || '').toString();
    const orderName = payload.name || (rawOrderNumber ? `#${rawOrderNumber}` : 'Order');
    const financialStatus = payload.financial_status || 'paid';
    const fulfillmentStatus = payload.fulfillment_status || null;
    const totalAmount = parseFloat(payload.total_price || payload.current_total_price || 0);
    const currency = payload.currency || 'USD';
    const orderDate = payload.created_at ? new Date(payload.created_at) : new Date();

    this.logger.log(
      `Processing webhook [${topic}] for order ${orderName} (${shopifyOrderId}) on store ${store.shopDomain}`
    );

    return this.sequelize.transaction(async (t) => {
      // 1. Synchronize Customer
      let customerRecord = null;
      const rawCustomer = payload.customer;
      const rawEmail = (rawCustomer?.email || payload.email || '').toLowerCase().trim();
      const shopifyCustomerId =
        rawCustomer?.admin_graphql_api_id ||
        (rawCustomer?.id ? `gid://shopify/Customer/${rawCustomer.id}` : null);

      if (shopifyCustomerId) {
        customerRecord = await this.customerRepository.findOne({
          where: { shopifyCustomerId },
          transaction: t,
        });
      }

      if (!customerRecord && rawEmail) {
        customerRecord = await this.customerRepository.findOne({
          where: { email: rawEmail },
          transaction: t,
        });
      }

      const firstName = rawCustomer?.first_name || '';
      const lastName = rawCustomer?.last_name || '';
      const phone = rawCustomer?.phone || payload.phone || null;

      if (customerRecord) {
        await customerRecord.update(
          {
            shopifyCustomerId: shopifyCustomerId || customerRecord.shopifyCustomerId,
            firstName: firstName || customerRecord.firstName,
            lastName: lastName || customerRecord.lastName,
            phone: phone || customerRecord.phone,
          },
          { transaction: t }
        );
      } else if (rawEmail || firstName || lastName) {
        customerRecord = await this.customerRepository.create(
          {
            shopifyCustomerId,
            firstName,
            lastName,
            email: rawEmail || null,
            phone,
          },
          { transaction: t }
        );
      }

      // 2. Synchronize Order
      let orderRecord = await this.orderRepository.findOne({
        where: {
          shopifyStoreId: store.id,
          shopifyOrderId,
        },
        transaction: t,
      });

      let action = 'CREATED';

      if (orderRecord) {
        action = 'UPDATED';
        await orderRecord.update(
          {
            shopifyOrderNumber: shopifyOrderNumber || orderRecord.shopifyOrderNumber,
            orderName: orderName || orderRecord.orderName,
            customerId: customerRecord ? customerRecord.id : orderRecord.customerId,
            financialStatus,
            fulfillmentStatus,
            totalAmount,
            currency,
            orderDate,
          },
          { transaction: t }
        );
      } else {
        orderRecord = await this.orderRepository.create(
          {
            shopifyOrderId,
            shopifyOrderNumber,
            orderName,
            customerId: customerRecord ? customerRecord.id : null,
            shopifyStoreId: store.id,
            financialStatus,
            fulfillmentStatus,
            totalAmount,
            currency,
            orderDate,
          },
          { transaction: t }
        );
      }

      // 3. Synchronize Line Items
      if (Array.isArray(payload.line_items) && payload.line_items.length > 0) {
        // If updating an existing order, replace existing items to reflect current Shopify state accurately
        if (action === 'UPDATED') {
          await this.orderItemRepository.destroy({
            where: { orderId: orderRecord.id },
            transaction: t,
          });
        }

        const itemsToInsert = payload.line_items.map((item) => {
          const rawItemId = item.id;
          const shopifyLineItemId =
            item.admin_graphql_api_id ||
            (rawItemId ? `gid://shopify/LineItem/${rawItemId}` : null);

          const quantity = parseInt(item.quantity, 10) || 1;
          const unitPrice = parseFloat(item.price || 0);
          const totalPrice = parseFloat((quantity * unitPrice).toFixed(2));

          return {
            orderId: orderRecord.id,
            shopifyLineItemId,
            productTitle: item.title || item.name || 'Product',
            variantTitle: item.variant_title || null,
            sku: item.sku || null,
            quantity,
            unitPrice,
            totalPrice,
          };
        });

        await this.orderItemRepository.bulkCreate(itemsToInsert, { transaction: t });

        // 4. Register Products in local catalog if absent
        for (const item of payload.line_items) {
          const productTitle = item.title || item.name;
          if (productTitle) {
            const rawProdId = item.product_id;
            const shopifyProductId = rawProdId ? `gid://shopify/Product/${rawProdId}` : null;

            const existingProduct = await this.productRepository.findOne({
              where: { title: productTitle },
              transaction: t,
            });

            if (!existingProduct) {
              await this.productRepository.create(
                {
                  shopifyProductId,
                  title: productTitle,
                  sku: item.sku || null,
                },
                { transaction: t }
              );
            }
          }
        }
      }

      this.logger.log(
        `Successfully ${action.toLowerCase()} order ${orderName} (${orderRecord.id}) via webhook`
      );

      return {
        success: true,
        action,
        orderId: orderRecord.id,
        orderName: orderRecord.orderName,
        shopifyOrderId,
      };
    });
  }
}

module.exports = { WebhookProcessingService };
