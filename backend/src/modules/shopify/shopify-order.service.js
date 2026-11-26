const {
  Injectable,
  Dependencies,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} = require('@nestjs/common');
const { ShopifyApiService } = require('./shopify-api.service');

@Injectable()
@Dependencies(
  'SEQUELIZE',
  'SHOPIFY_STORE_REPOSITORY',
  'CUSTOMER_REPOSITORY',
  'ORDER_REPOSITORY',
  'ORDER_ITEM_REPOSITORY',
  'PRODUCT_REPOSITORY',
  'IMPORT_HISTORY_REPOSITORY',
  ShopifyApiService
)
class ShopifyOrderService {
  constructor(
    sequelize,
    shopifyStoreRepository,
    customerRepository,
    orderRepository,
    orderItemRepository,
    productRepository,
    importHistoryRepository,
    shopifyApiService
  ) {
    this.sequelize = sequelize;
    this.shopifyStoreRepository = shopifyStoreRepository;
    this.customerRepository = customerRepository;
    this.orderRepository = orderRepository;
    this.orderItemRepository = orderItemRepository;
    this.productRepository = productRepository;
    this.importHistoryRepository = importHistoryRepository;
    this.shopifyApiService = shopifyApiService;
    this.logger = new Logger('ShopifyOrderService');
  }

  /**
   * Import orders from Shopify store with cursor pagination and transactions
   */
  async importOrders(storeId = null) {
    // 1. Retrieve active Shopify store
    let store;
    if (storeId) {
      store = await this.shopifyStoreRepository.findByPk(storeId);
    } else {
      store = await this.shopifyStoreRepository.findOne({
        where: { isActive: true },
        order: [['connectedAt', 'DESC']],
      });
    }

    if (!store || !store.isActive) {
      throw new BadRequestException(
        'No active Shopify store connected. Please connect a store first.'
      );
    }

    const accessToken = store.accessToken; // Model getter decrypts automatically
    if (!accessToken) {
      throw new BadRequestException('Shopify store access token is missing or corrupted.');
    }

    // 2. Initialize ImportHistory tracking record
    const importRecord = await this.importHistoryRepository.create({
      shopifyStoreId: store.id,
      status: 'IN_PROGRESS',
      startedAt: new Date(),
      totalFetched: 0,
      successfullyImported: 0,
      updatedExisting: 0,
      skipped: 0,
      failed: 0,
    });

    const stats = {
      totalFetched: 0,
      successfullyImported: 0,
      updatedExisting: 0,
      skipped: 0,
      failed: 0,
    };

    try {
      let cursor = null;
      let hasNextPage = true;
      const MAX_PAGES = 10; // Safety guard for batch import
      let pageCount = 0;

      while (hasNextPage && pageCount < MAX_PAGES) {
        pageCount++;
        let fetchedData;

        try {
          // Attempt modern GraphQL fetch first
          fetchedData = await this.shopifyApiService.fetchOrdersGraphQL(
            store.shopDomain,
            accessToken,
            { limit: 50, cursor }
          );
        } catch (gqlError) {
          this.logger.warn(`GraphQL order fetch failed (${gqlError.message}), falling back to REST`);
          fetchedData = await this.shopifyApiService.fetchOrdersREST(
            store.shopDomain,
            accessToken,
            { limit: 50 }
          );
        }

        const orders = fetchedData.orders || [];
        if (orders.length === 0) {
          break;
        }

        // Process each order in individual transactional boundary
        for (const orderData of orders) {
          stats.totalFetched++;
          try {
            await this.processSingleOrder(orderData, store.id, stats);
          } catch (orderErr) {
            this.logger.error(
              `Error processing order ${orderData.name || orderData.id}: ${orderErr.message}`
            );
            stats.failed++;
          }
        }

        hasNextPage = fetchedData.hasNextPage;
        cursor = fetchedData.endCursor;
        if (!cursor) break;
      }

      // 3. Mark import as completed
      await importRecord.update({
        status: 'COMPLETED',
        totalFetched: stats.totalFetched,
        successfullyImported: stats.successfullyImported,
        updatedExisting: stats.updatedExisting,
        skipped: stats.skipped,
        failed: stats.failed,
        completedAt: new Date(),
      });

      this.logger.log(
        `Order import completed for ${store.shopDomain}: ${JSON.stringify(stats)}`
      );

      return {
        success: true,
        importId: importRecord.id,
        storeDomain: store.shopDomain,
        stats,
      };
    } catch (error) {
      await importRecord.update({
        status: 'FAILED',
        totalFetched: stats.totalFetched,
        successfullyImported: stats.successfullyImported,
        updatedExisting: stats.updatedExisting,
        skipped: stats.skipped,
        failed: stats.failed,
        errorMessage: error.message,
        completedAt: new Date(),
      });

      this.logger.error(`Shopify order import failed: ${error.message}`);
      throw new InternalServerErrorException(`Order import failed: ${error.message}`);
    }
  }

  /**
   * Process and persist a single order inside a database transaction
   */
  async processSingleOrder(orderData, storeId, stats) {
    return this.sequelize.transaction(async (t) => {
      // a. Handle Customer
      let customerId = null;
      if (orderData.customer) {
        const { id: shopifyCustomerId, firstName, lastName, email, phone } = orderData.customer;

        let customer = null;
        if (shopifyCustomerId) {
          customer = await this.customerRepository.findOne({
            where: { shopifyCustomerId },
            transaction: t,
          });
        }

        if (!customer && email) {
          customer = await this.customerRepository.findOne({
            where: { email: email.toLowerCase().trim() },
            transaction: t,
          });
        }

        if (customer) {
          await customer.update(
            {
              shopifyCustomerId: shopifyCustomerId || customer.shopifyCustomerId,
              firstName: firstName || customer.firstName,
              lastName: lastName || customer.lastName,
              phone: phone || customer.phone,
            },
            { transaction: t }
          );
        } else {
          customer = await this.customerRepository.create(
            {
              shopifyCustomerId,
              firstName,
              lastName,
              email: email ? email.toLowerCase().trim() : null,
              phone,
            },
            { transaction: t }
          );
        }

        customerId = customer.id;
      }

      // b. Handle Products from line items
      for (const item of orderData.lineItems || []) {
        if (item.productId || item.productTitle) {
          const whereClause = item.productId
            ? { shopifyProductId: item.productId }
            : { title: item.productTitle };

          const existingProduct = await this.productRepository.findOne({
            where: whereClause,
            transaction: t,
          });

          if (!existingProduct) {
            await this.productRepository.create(
              {
                shopifyProductId: item.productId,
                title: item.productTitle,
                sku: item.sku,
              },
              { transaction: t }
            );
          }
        }
      }

      // c. Handle Order (prevent duplicates by shopifyStoreId + shopifyOrderId)
      const existingOrder = await this.orderRepository.findOne({
        where: {
          shopifyStoreId: storeId,
          shopifyOrderId: String(orderData.id),
        },
        transaction: t,
      });

      let orderRecord;
      if (existingOrder) {
        await existingOrder.update(
          {
            shopifyOrderNumber: String(orderData.orderNumber || existingOrder.shopifyOrderNumber),
            orderName: orderData.name || existingOrder.orderName,
            customerId: customerId || existingOrder.customerId,
            financialStatus: orderData.financialStatus || existingOrder.financialStatus,
            fulfillmentStatus: orderData.fulfillmentStatus || existingOrder.fulfillmentStatus,
            totalAmount: orderData.totalAmount || existingOrder.totalAmount,
            currency: orderData.currency || existingOrder.currency,
            orderDate: orderData.createdAt ? new Date(orderData.createdAt) : existingOrder.orderDate,
          },
          { transaction: t }
        );

        orderRecord = existingOrder;
        stats.updatedExisting++;
      } else {
        orderRecord = await this.orderRepository.create(
          {
            shopifyOrderId: String(orderData.id),
            shopifyOrderNumber: String(orderData.orderNumber || orderData.id),
            orderName: orderData.name || `Order ${orderData.id}`,
            customerId,
            shopifyStoreId: storeId,
            financialStatus: orderData.financialStatus || 'pending',
            fulfillmentStatus: orderData.fulfillmentStatus || null,
            totalAmount: orderData.totalAmount || 0.0,
            currency: orderData.currency || 'USD',
            orderDate: orderData.createdAt ? new Date(orderData.createdAt) : new Date(),
          },
          { transaction: t }
        );

        stats.successfullyImported++;
      }

      // d. Handle OrderItems (recreate line items for this order)
      if (orderData.lineItems && orderData.lineItems.length > 0) {
        await this.orderItemRepository.destroy({
          where: { orderId: orderRecord.id },
          transaction: t,
        });

        const itemsToInsert = orderData.lineItems.map((item) => ({
          orderId: orderRecord.id,
          shopifyLineItemId: item.id ? String(item.id) : null,
          productTitle: item.productTitle || item.title || 'Untitled Product',
          variantTitle: item.variantTitle,
          sku: item.sku,
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || 0.0,
          totalPrice: item.totalPrice || (item.unitPrice || 0.0) * (item.quantity || 1),
        }));

        await this.orderItemRepository.bulkCreate(itemsToInsert, { transaction: t });
      }
    });
  }
}

module.exports = { ShopifyOrderService };
