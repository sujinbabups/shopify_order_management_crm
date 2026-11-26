const { Module, MiddlewareConsumer, RequestMethod } = require('@nestjs/common');
const { ConfigModule } = require('@nestjs/config');
const { DatabaseModule } = require('./database/database.module');
const { AuthModule } = require('./modules/auth/auth.module');
const { UsersModule } = require('./modules/users/users.module');
const { ShopifyModule } = require('./modules/shopify/shopify.module');
const { CustomersModule } = require('./modules/customers/customers.module');
const { ProductsModule } = require('./modules/products/products.module');
const { OrdersModule } = require('./modules/orders/orders.module');
const { AppController } = require('./app.controller');
const { LoggerMiddleware } = require('./common/middleware/logger.middleware');

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    UsersModule,
    AuthModule,
    ShopifyModule,
    CustomersModule,
    ProductsModule,
    OrdersModule,
  ],
  controllers: [AppController],
  providers: [],
})
class AppModule {
  configure(consumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}

module.exports = { AppModule };
