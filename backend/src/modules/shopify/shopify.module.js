const { Module } = require('@nestjs/common');
const { ShopifyController } = require('./shopify.controller');
const { ShopifyService } = require('./shopify.service');
const { ShopifyAuthService } = require('./shopify-auth.service');
const { ShopifyApiService } = require('./shopify-api.service');
const { ShopifyOrderService } = require('./shopify-order.service');

@Module({
  controllers: [ShopifyController],
  providers: [
    ShopifyService,
    ShopifyAuthService,
    ShopifyApiService,
    ShopifyOrderService,
  ],
  exports: [
    ShopifyService,
    ShopifyAuthService,
    ShopifyApiService,
    ShopifyOrderService,
  ],
})
class ShopifyModule {}

module.exports = { ShopifyModule };
