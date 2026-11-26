const { Module } = require('@nestjs/common');
const { ProductsController } = require('./products.controller');
const { ProductsService } = require('./products.service');
const { ShopifyModule } = require('../shopify/shopify.module');

@Module({
  imports: [ShopifyModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
class ProductsModule {}

module.exports = { ProductsModule };
