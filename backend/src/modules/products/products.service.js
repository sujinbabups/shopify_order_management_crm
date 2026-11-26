const { Injectable, Dependencies } = require('@nestjs/common');
const { Op } = require('sequelize');
const { ShopifyApiService } = require('../shopify/shopify-api.service');

@Injectable()
@Dependencies('PRODUCT_REPOSITORY', 'SHOPIFY_STORE_REPOSITORY', ShopifyApiService)
class ProductsService {
  constructor(productRepository, shopifyStoreRepository, shopifyApiService) {
    this.productRepository = productRepository;
    this.shopifyStoreRepository = shopifyStoreRepository;
    this.shopifyApiService = shopifyApiService;
  }

  async findAll({ search = '', page = 1, limit = 50 } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    const where = {};
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      where[Op.or] = [
        { title: { [Op.iLike]: term } },
        { sku: { [Op.iLike]: term } },
      ];
    }

    const { rows, count } = await this.productRepository.findAndCountAll({
      where,
      limit: limitNum,
      offset,
      order: [['title', 'ASC']],
    });

    return {
      products: rows,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum),
      },
    };
  }

  async findById(id) {
    return this.productRepository.findByPk(id);
  }
}

module.exports = { ProductsService };
