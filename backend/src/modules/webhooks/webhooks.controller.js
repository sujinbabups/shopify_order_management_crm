const {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Headers,
  Req,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Dependencies,
  Bind,
} = require('@nestjs/common');
const { WebhooksService } = require('./webhooks.service');
const { JwtAuthGuard } = require('../../common/guards/jwt-auth.guard');

@Controller('webhooks')
@Dependencies(WebhooksService)
class WebhooksController {
  constructor(webhooksService) {
    this.webhooksService = webhooksService;
  }

  /**
   * Shopify Webhook Receiver Endpoint
   * POST /api/v1/webhooks/shopify
   * Public endpoint - authenticated exclusively by Shopify HMAC SHA-256 signature
   */
  @Post('shopify')
  @HttpCode(HttpStatus.OK)
  @Bind(Headers(), Req(), Body())
  async handleShopifyWebhook(headers, req, body) {
    // Preserve raw buffer for cryptographic verification
    const rawBody =
      req.rawBody ||
      (Buffer.isBuffer(body)
        ? body
        : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body || {}), 'utf8'));

    const parsedBody = typeof body === 'string' ? JSON.parse(body) : body;

    const result = await this.webhooksService.handleIncomingWebhook(
      headers,
      rawBody,
      parsedBody
    );

    return {
      success: true,
      message: result.message || 'Webhook acknowledged',
      data: result,
    };
  }

  /**
   * List Webhook Events with filters & pagination
   * GET /api/v1/webhooks/events
   * Protected: CRM Authenticated users
   */
  @Get('events')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Bind(Query('page'), Query('limit'), Query('status'), Query('topic'), Query('search'))
  async listEvents(page = 1, limit = 20, status = '', topic = '', search = '') {
    const data = await this.webhooksService.listEvents({
      page,
      limit,
      status,
      topic,
      search,
    });

    return {
      success: true,
      data: data.events,
      pagination: data.pagination,
    };
  }

  /**
   * Get Webhook Status Summary
   * GET /api/v1/webhooks/status
   * Protected: CRM Authenticated users
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getStatusSummary() {
    const summary = await this.webhooksService.getStatusSummary();
    return {
      success: true,
      data: summary,
    };
  }

  /**
   * Manually retry a failed webhook event
   * POST /api/v1/webhooks/retry/:id
   * Protected: CRM Authenticated users
   */
  @Post('retry/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Bind(Param('id'))
  async retryEvent(id) {
    const result = await this.webhooksService.retryEvent(id);
    return {
      success: true,
      message: result.message,
      data: result.data,
    };
  }
}

module.exports = { WebhooksController };
