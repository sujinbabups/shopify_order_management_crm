const {
  Injectable,
  Dependencies,
  NotFoundException,
  BadRequestException,
} = require('@nestjs/common');
const { ShopifyAuthService } = require('./shopify-auth.service');
const { ShopifyOrderService } = require('./shopify-order.service');
const { ShopifyApiService } = require('./shopify-api.service');

@Injectable()
@Dependencies(
  'SHOPIFY_STORE_REPOSITORY',
  'IMPORT_HISTORY_REPOSITORY',
  ShopifyAuthService,
  ShopifyOrderService,
  ShopifyApiService
)
class ShopifyService {
  constructor(
    shopifyStoreRepository,
    importHistoryRepository,
    shopifyAuthService,
    shopifyOrderService,
    shopifyApiService
  ) {
    this.shopifyStoreRepository = shopifyStoreRepository;
    this.importHistoryRepository = importHistoryRepository;
    this.shopifyAuthService = shopifyAuthService;
    this.shopifyOrderService = shopifyOrderService;
    this.shopifyApiService = shopifyApiService;
  }

  /**
   * Initiate Shopify store connection
   */
  async initiateConnection(shopDomain) {
    return this.shopifyAuthService.generateAuthUrl(shopDomain);
  }

  /**
   * Process Shopify OAuth callback
   */
  async processCallback(query) {
    return this.shopifyAuthService.handleCallback(query);
  }

  /**
   * Return current Shopify connection status without exposing sensitive tokens
   */
  async getStatus() {
    const store = await this.shopifyStoreRepository.findOne({
      where: { isActive: true },
      order: [['connectedAt', 'DESC']],
    });

    if (!store) {
      return {
        isConnected: false,
        store: null,
      };
    }

    const safeStore = store.toJSON();
    delete safeStore.accessToken;

    return {
      isConnected: true,
      store: safeStore,
    };
  }

  /**
   * Disconnect the currently active Shopify store
   */
  async disconnect() {
    const store = await this.shopifyStoreRepository.findOne({
      where: { isActive: true },
    });

    if (!store) {
      throw new NotFoundException('No active Shopify store to disconnect');
    }

    await store.update({ isActive: false });

    return {
      success: true,
      message: `Store ${store.shopDomain} disconnected successfully`,
    };
  }

  /**
   * Start order import
   */
  async startOrderImport() {
    return this.shopifyOrderService.importOrders();
  }

  /**
   * Return latest import status
   */
  async getImportStatus() {
    const latestImport = await this.importHistoryRepository.findOne({
      order: [['startedAt', 'DESC']],
    });

    return {
      success: true,
      data: latestImport,
    };
  }

  /**
   * Return paginated import history
   */
  async getImportHistory(page = 1, limit = 10) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const offset = (pageNum - 1) * limitNum;

    const { rows, count } = await this.importHistoryRepository.findAndCountAll({
      limit: limitNum,
      offset,
      order: [['startedAt', 'DESC']],
    });

    return {
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum),
      },
    };
  }

  /**
   * Register order webhooks (orders/create, orders/updated) on Shopify
   */
  async registerWebhooks() {
    const store = await this.shopifyStoreRepository.findOne({
      where: { isActive: true },
      order: [['connectedAt', 'DESC']],
    });

    if (!store) {
      throw new BadRequestException('No active Shopify store connected');
    }

    const appUrl = process.env.SHOPIFY_APP_URL || 'http://localhost:5000';
    const webhookAddress = `${appUrl}/api/v1/webhooks/shopify`;
    const topics = ['orders/create', 'orders/updated'];

    const results = [];
    for (const topic of topics) {
      try {
        const result = await this.shopifyApiService.registerWebhook(
          store.shopDomain,
          store.accessToken,
          {
            topic,
            address: webhookAddress,
          }
        );
        results.push({ topic, status: 'registered', result });
      } catch (err) {
        results.push({ topic, status: 'error', error: err.message });
      }
    }

    return {
      success: true,
      message: 'Shopify webhook registration processed',
      data: results,
    };
  }

  /**
   * Fetch registered webhooks from Shopify
   */
  async getRegisteredWebhooks() {
    const store = await this.shopifyStoreRepository.findOne({
      where: { isActive: true },
      order: [['connectedAt', 'DESC']],
    });

    if (!store) {
      return { success: true, data: [] };
    }

    const webhooks = await this.shopifyApiService.fetchWebhooks(
      store.shopDomain,
      store.accessToken
    );

    return {
      success: true,
      data: webhooks,
    };
  }
}

module.exports = { ShopifyService };
