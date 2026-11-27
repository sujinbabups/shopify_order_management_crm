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
   * Get CRM dashboard metrics
   * GET /api/v1/orders/metrics/dashboard
   */
  @Get('metrics/dashboard')
  @HttpCode(HttpStatus.OK)
  async getDashboardMetrics() {
    const metrics = await this.ordersService.getDashboardMetrics();
    return {
      success: true,
      data: metrics,
    };
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
   * List orders with pagination, search, status filters, and sorting
   * GET /api/v1/orders
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @Bind(
    Query('search'),
    Query('status'),
    Query('financialStatus'),
    Query('fulfillmentStatus'),
    Query('startDate'),
    Query('endDate'),
    Query('sortBy'),
    Query('page'),
    Query('limit')
  )
  async listOrders(
    search = '',
    status = '',
    financialStatus = '',
    fulfillmentStatus = '',
    startDate = '',
    endDate = '',
    sortBy = 'date_desc',
    page = 1,
    limit = 20
  ) {
    const { orders, pagination } = await this.ordersService.findAll({
      search,
      status,
      financialStatus,
      fulfillmentStatus,
      startDate: startDate || null,
      endDate: endDate || null,
      sortBy,
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
