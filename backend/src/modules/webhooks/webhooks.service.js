const {
  Injectable,
  Dependencies,
  BadRequestException,
  NotFoundException,
  Logger,
} = require('@nestjs/common');
const { Op } = require('sequelize');
const { WebhookVerificationService } = require('./webhook-verification.service');
const { WebhookProcessingService } = require('./webhook-processing.service');

@Injectable()
@Dependencies(
  'WEBHOOK_EVENT_REPOSITORY',
  'SHOPIFY_STORE_REPOSITORY',
  WebhookVerificationService,
  WebhookProcessingService
)
class WebhooksService {
  constructor(
    webhookEventRepository,
    shopifyStoreRepository,
    verificationService,
    processingService
  ) {
    this.webhookEventRepository = webhookEventRepository;
    this.shopifyStoreRepository = shopifyStoreRepository;
    this.verificationService = verificationService;
    this.processingService = processingService;
    this.logger = new Logger('WebhooksService');
  }

  /**
   * Main entry point for incoming Shopify webhooks
   * @param {object} headers - HTTP request headers
   * @param {Buffer|string} rawBody - Raw request body
   * @param {object} parsedBody - Parsed JSON body
   */
  async handleIncomingWebhook(headers, rawBody, parsedBody) {
    // 1. Verify HMAC signature before anything else
    const hmacHeader =
      headers['x-shopify-hmac-sha256'] ||
      headers['X-Shopify-Hmac-Sha256'] ||
      headers['x-shopify-hmac-sha256'.toLowerCase()];

    this.verificationService.verifyHmac(hmacHeader, rawBody);

    // 2. Validate Shopify headers
    const shopDomain = (
      headers['x-shopify-shop-domain'] ||
      headers['X-Shopify-Shop-Domain'] ||
      ''
    )
      .toLowerCase()
      .trim();

    if (!shopDomain) {
      throw new BadRequestException('Missing x-shopify-shop-domain header');
    }

    const topic = (
      headers['x-shopify-topic'] ||
      headers['X-Shopify-Topic'] ||
      ''
    )
      .toLowerCase()
      .trim();

    if (!topic) {
      throw new BadRequestException('Missing x-shopify-topic header');
    }

    // 3. Locate active Shopify store in local database
    const store = await this.shopifyStoreRepository.findOne({
      where: {
        shopDomain,
        isActive: true,
      },
    });

    if (!store) {
      this.logger.warn(`Rejected webhook for unknown or disconnected store: ${shopDomain}`);
      throw new BadRequestException(`Shopify store "${shopDomain}" is not connected or inactive`);
    }

    // 4. Extract delivery identifier for deduplication
    const shopifyWebhookId =
      headers['x-shopify-webhook-id'] ||
      headers['X-Shopify-Webhook-Id'] ||
      null;

    const rawOrderId = parsedBody?.id;
    const shopifyOrderId =
      headers['x-shopify-order-id'] ||
      parsedBody?.admin_graphql_api_id ||
      (rawOrderId ? `gid://shopify/Order/${rawOrderId}` : null);

    // 5. Database-level deduplication check
    if (shopifyWebhookId) {
      const existingEvent = await this.webhookEventRepository.findOne({
        where: {
          shopDomain,
          shopifyWebhookId,
        },
      });

      if (existingEvent) {
        if (existingEvent.status === 'PROCESSED') {
          this.logger.log(
            `Duplicate webhook delivery ${shopifyWebhookId} already PROCESSED. Returning 200 OK.`
          );
          return {
            success: true,
            message: 'Duplicate webhook already processed',
            eventId: existingEvent.id,
            status: 'PROCESSED',
          };
        }

        if (existingEvent.status === 'PROCESSING') {
          this.logger.log(
            `Concurrent/duplicate webhook delivery ${shopifyWebhookId} is currently PROCESSING.`
          );
          return {
            success: true,
            message: 'Webhook is currently being processed',
            eventId: existingEvent.id,
            status: 'PROCESSING',
          };
        }
      }
    }

    // 6. Record incoming WebhookEvent
    let eventRecord;
    try {
      eventRecord = await this.webhookEventRepository.create({
        shopifyWebhookId,
        shopDomain,
        topic,
        shopifyOrderId,
        payload: parsedBody,
        status: 'PROCESSING',
        attempts: 1,
      });
    } catch (createError) {
      // Handle concurrent insert collision on unique constraint
      if (
        createError.name === 'SequelizeUniqueConstraintError' ||
        createError.message?.includes('duplicate key')
      ) {
        this.logger.warn(`Concurrent duplicate delivery collision caught for ID ${shopifyWebhookId}`);
        const existing = await this.webhookEventRepository.findOne({
          where: { shopDomain, shopifyWebhookId },
        });
        return {
          success: true,
          message: 'Duplicate concurrent webhook detected; event already registered',
          eventId: existing?.id,
          status: existing?.status || 'PROCESSING',
        };
      }
      throw createError;
    }

    // 7. Dispatch to WebhookProcessingService
    try {
      const result = await this.processingService.processOrderWebhook(topic, parsedBody, store);

      await eventRecord.update({
        status: 'PROCESSED',
        processedAt: new Date(),
        errorMessage: null,
      });

      return {
        success: true,
        message: 'Webhook processed successfully',
        eventId: eventRecord.id,
        action: result.action,
        orderId: result.orderId,
      };
    } catch (processingError) {
      this.logger.error(
        `Failed processing webhook ${eventRecord.id} (${topic}): ${processingError.message}`
      );

      await eventRecord.update({
        status: 'FAILED',
        errorMessage: processingError.message,
      });

      throw processingError;
    }
  }

  /**
   * Manual recovery / retry mechanism for failed webhook events
   * @param {string} eventId - UUID of WebhookEvent
   */
  async retryEvent(eventId) {
    const event = await this.webhookEventRepository.findByPk(eventId);
    if (!event) {
      throw new NotFoundException(`Webhook event with ID ${eventId} not found`);
    }

    const store = await this.shopifyStoreRepository.findOne({
      where: {
        shopDomain: event.shopDomain,
        isActive: true,
      },
    });

    if (!store) {
      throw new BadRequestException(
        `Store ${event.shopDomain} is no longer connected or active. Cannot retry event.`
      );
    }

    await event.update({
      status: 'PROCESSING',
      attempts: (event.attempts || 0) + 1,
    });

    try {
      const result = await this.processingService.processOrderWebhook(
        event.topic,
        event.payload,
        store
      );

      await event.update({
        status: 'PROCESSED',
        processedAt: new Date(),
        errorMessage: null,
      });

      return {
        success: true,
        message: 'Event retried and processed successfully',
        data: event,
        result,
      };
    } catch (error) {
      this.logger.error(`Retry failed for event ${eventId}: ${error.message}`);
      await event.update({
        status: 'FAILED',
        errorMessage: error.message,
      });
      throw error;
    }
  }

  /**
   * List webhook events with filters and pagination
   */
  async listEvents({ page = 1, limit = 20, status = '', topic = '', search = '' } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const where = {};
    if (status) {
      where.status = status;
    }
    if (topic) {
      where.topic = topic;
    }
    if (search && search.trim()) {
      where[Op.or] = [
        { shopDomain: { [Op.iLike]: `%${search.trim()}%` } },
        { shopifyOrderId: { [Op.iLike]: `%${search.trim()}%` } },
        { shopifyWebhookId: { [Op.iLike]: `%${search.trim()}%` } },
      ];
    }

    const { rows, count } = await this.webhookEventRepository.findAndCountAll({
      where,
      limit: limitNum,
      offset,
      order: [['createdAt', 'DESC']],
    });

    return {
      events: rows,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum),
      },
    };
  }

  /**
   * Get summary counts for webhook status display
   */
  async getStatusSummary() {
    const [total, processed, failed, pending, processing, lastEvent] = await Promise.all([
      this.webhookEventRepository.count(),
      this.webhookEventRepository.count({ where: { status: 'PROCESSED' } }),
      this.webhookEventRepository.count({ where: { status: 'FAILED' } }),
      this.webhookEventRepository.count({ where: { status: 'PENDING' } }),
      this.webhookEventRepository.count({ where: { status: 'PROCESSING' } }),
      this.webhookEventRepository.findOne({
        order: [['createdAt', 'DESC']],
        attributes: ['id', 'topic', 'status', 'shopDomain', 'createdAt', 'processedAt'],
      }),
    ]);

    return {
      total,
      processed,
      failed,
      pending,
      processing,
      lastEvent,
    };
  }
}

module.exports = { WebhooksService };
