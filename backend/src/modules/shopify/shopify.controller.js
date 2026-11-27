const {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Query,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Dependencies,
  Bind,
} = require('@nestjs/common');
const { ShopifyService } = require('./shopify.service');
const { JwtAuthGuard } = require('../../common/guards/jwt-auth.guard');
const { RolesGuard } = require('../../common/guards/roles.guard');
const { Roles } = require('../../common/decorators/roles.decorator');

@Controller('shopify')
@Dependencies(ShopifyService)
class ShopifyController {
  constructor(shopifyService) {
    this.shopifyService = shopifyService;
  }

  /**
   * Initiate Shopify store connection (ADMIN only)
   * POST /api/v1/shopify/connect
   */
  @Post('connect')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @Bind(Body())
  async connectStore(body) {
    const { shopDomain } = body;
    const authData = await this.shopifyService.initiateConnection(shopDomain);

    return {
      success: true,
      data: authData,
    };
  }

  /**
   * Handle Shopify OAuth callback (Public redirect from Shopify)
   * GET /api/v1/shopify/callback
   */
  @Get('callback')
  @Bind(Query(), Res())
  async handleCallback(query, res) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    try {
      const result = await this.shopifyService.processCallback(query);
      return res.redirect(
        `${frontendUrl}/shopify?status=connected&shop=${encodeURIComponent(result.shopDomain)}`
      );
    } catch (error) {
      const errorMsg = error.message || 'Shopify authorization failed';
      return res.redirect(
        `${frontendUrl}/shopify?status=error&message=${encodeURIComponent(errorMsg)}`
      );
    }
  }

  /**
   * Return current Shopify connection status
   * GET /api/v1/shopify/status
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getStatus() {
    const status = await this.shopifyService.getStatus();
    return {
      success: true,
      data: status,
    };
  }

  /**
   * Disconnect the active Shopify store (ADMIN only)
   * DELETE /api/v1/shopify/disconnect
   */
  @Delete('disconnect')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async disconnect() {
    return this.shopifyService.disconnect();
  }

  /**
   * Start order import (ADMIN only)
   * POST /api/v1/shopify/orders/import
   */
  @Post('orders/import')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async importOrders() {
    const result = await this.shopifyService.startOrderImport();
    return result;
  }

  /**
   * Get latest import status
   * GET /api/v1/shopify/orders/import/status
   */
  @Get('orders/import/status')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getImportStatus() {
    return this.shopifyService.getImportStatus();
  }

  /**
   * Get historical import records
   * GET /api/v1/shopify/orders/import/history
   */
  @Get('orders/import/history')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Bind(Query('page'), Query('limit'))
  async getImportHistory(page = 1, limit = 10) {
    return this.shopifyService.getImportHistory(page, limit);
  }

  /**
   * Register order webhooks on connected Shopify store (ADMIN only)
   * POST /api/v1/shopify/webhooks/register
   */
  @Post('webhooks/register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async registerWebhooks() {
    return this.shopifyService.registerWebhooks();
  }

  /**
   * List registered webhooks from Shopify
   * GET /api/v1/shopify/webhooks
   */
  @Get('webhooks')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getRegisteredWebhooks() {
    return this.shopifyService.getRegisteredWebhooks();
  }
}

module.exports = { ShopifyController };
