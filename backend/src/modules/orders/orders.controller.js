const {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
  Dependencies,
  Bind,
} = require('@nestjs/common');
const { OrdersService } = require('./orders.service');
const { JwtAuthGuard } = require('../../common/guards/jwt-auth.guard');

@Controller('orders')
@UseGuards(JwtAuthGuard)
@Dependencies(OrdersService)
class OrdersController {
  constructor(ordersService) {
    this.ordersService = ordersService;
  }

  /**
   * Create an order directly in Shopify and persist locally
   * POST /api/v1/orders
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Bind(Body(), Headers('x-idempotency-key'))
  async createOrder(orderDto, idempotencyHeader) {
    const key = orderDto.idempotencyKey || idempotencyHeader;
    return this.ordersService.createOrder(orderDto, key);
  }

  /**
   * Get single order details with customer and line items
   * GET /api/v1/orders/:id
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Bind(Param('id'))
  async getOrderById(id) {
    const order = await this.ordersService.findById(id);
    return {
      success: true,
      data: order,
    };
  }

  /**
   * List orders with pagination and filters
   * GET /api/v1/orders
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @Bind(Query('search'), Query('status'), Query('page'), Query('limit'))
  async listOrders(search = '', status = '', page = 1, limit = 20) {
    const { orders, pagination } = await this.ordersService.findAll({
      search,
      status,
      page,
      limit,
    });

    return {
      success: true,
      data: orders,
      pagination,
    };
  }
}

module.exports = { OrdersController };
