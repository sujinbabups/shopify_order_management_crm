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
const { ProductsService } = require('./products.service');
const { JwtAuthGuard } = require('../../common/guards/jwt-auth.guard');

@Controller('products')
@UseGuards(JwtAuthGuard)
@Dependencies(ProductsService)
class ProductsController {
  constructor(productsService) {
    this.productsService = productsService;
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @Bind(Query('search'), Query('page'), Query('limit'))
  async listProducts(search = '', page = 1, limit = 50) {
    const { products, pagination } = await this.productsService.findAll({
      search,
      page,
      limit,
    });

    return {
      success: true,
      data: products,
      pagination,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Bind(Param('id'))
  async getProductById(id) {
    const product = await this.productsService.findById(id);
    return {
      success: true,
      data: product,
    };
  }
}

module.exports = { ProductsController };
