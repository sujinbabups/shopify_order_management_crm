const {
  Injectable,
  Dependencies,
  NotFoundException,
  BadRequestException,
} = require('@nestjs/common');
const { ShopifyAuthService } = require('./shopify-auth.service');
const { ShopifyOrderService } = require('./shopify-order.service');

@Injectable()
@Dependencies(
  'SHOPIFY_STORE_REPOSITORY',
  'IMPORT_HISTORY_REPOSITORY',
  ShopifyAuthService,
  ShopifyOrderService
)
class ShopifyService {
  constructor(
    shopifyStoreRepository,
    importHistoryRepository,
    shopifyAuthService,
    shopifyOrderService
  ) {
    this.shopifyStoreRepository = shopifyStoreRepository;
    this.importHistoryRepository = importHistoryRepository;
    this.shopifyAuthService = shopifyAuthService;
    this.shopifyOrderService = shopifyOrderService;
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
}

module.exports = { ShopifyService };
