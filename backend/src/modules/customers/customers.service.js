const { Injectable, Dependencies } = require('@nestjs/common');
const { Op } = require('sequelize');

@Injectable()
@Dependencies('CUSTOMER_REPOSITORY')
class CustomersService {
  constructor(customerRepository) {
    this.customerRepository = customerRepository;
  }

  async search({ search = '', page = 1, limit = 20 } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const where = {};
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      where[Op.or] = [
        { email: { [Op.iLike]: term } },
        { firstName: { [Op.iLike]: term } },
        { lastName: { [Op.iLike]: term } },
        { phone: { [Op.iLike]: term } },
      ];
    }

    const { rows, count } = await this.customerRepository.findAndCountAll({
      where,
      limit: limitNum,
      offset,
      order: [['createdAt', 'DESC']],
    });

    return {
      customers: rows,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum),
      },
    };
  }

  async findById(id) {
    return this.customerRepository.findByPk(id);
  }

  async findByEmail(email) {
    if (!email) return null;
    return this.customerRepository.findOne({
      where: { email: email.toLowerCase().trim() },
    });
  }
}

module.exports = { CustomersService };
