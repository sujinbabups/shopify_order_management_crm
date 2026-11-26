const { Module } = require('@nestjs/common');
const { OrdersController } = require('./orders.controller');
const { OrdersService } = require('./orders.service');
const { ShopifyModule } = require('../shopify/shopify.module');

@Module({
  imports: [ShopifyModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
class OrdersModule {}

module.exports = { OrdersModule };
