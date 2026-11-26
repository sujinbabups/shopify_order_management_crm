const { Module } = require('@nestjs/common');
const { CustomersController } = require('./customers.controller');
const { CustomersService } = require('./customers.service');

@Module({
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
class CustomersModule {}

module.exports = { CustomersModule };
