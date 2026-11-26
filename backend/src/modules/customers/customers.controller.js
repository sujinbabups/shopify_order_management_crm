const {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Dependencies,
  Bind,
} = require('@nestjs/common');
const { CustomersService } = require('./customers.service');
const { JwtAuthGuard } = require('../../common/guards/jwt-auth.guard');

@Controller('customers')
@UseGuards(JwtAuthGuard)
@Dependencies(CustomersService)
class CustomersController {
  constructor(customersService) {
    this.customersService = customersService;
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @Bind(Query('search'), Query('page'), Query('limit'))
  async listCustomers(search = '', page = 1, limit = 20) {
    const { customers, pagination } = await this.customersService.search({
      search,
      page,
      limit,
    });

    return {
      success: true,
      data: customers,
      pagination,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Bind(Param('id'))
  async getCustomerById(id) {
    const customer = await this.customersService.findById(id);
    return {
      success: true,
      data: customer,
    };
  }
}

module.exports = { CustomersController };
