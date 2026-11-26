const { Injectable, Dependencies, NotFoundException, ConflictException } = require('@nestjs/common');

@Injectable()
@Dependencies('USER_REPOSITORY')
class UsersService {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  async findByEmail(email) {
    if (!email) return null;
    return this.userRepository.findOne({
      where: { email: email.toLowerCase().trim() },
    });
  }

  async findById(id) {
    const user = await this.userRepository.findByPk(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async create(userData) {
    const existing = await this.findByEmail(userData.email);
    if (existing) {
      throw new ConflictException('An account with this email address already exists');
    }

    return this.userRepository.create({
      ...userData,
      email: userData.email.toLowerCase().trim(),
    });
  }

  async findAll(options = {}) {
    const { limit = 20, offset = 0, role, search } = options;
    const where = {};

    if (role) {
      where.role = role;
    }

    if (search) {
      const { Op } = require('sequelize');
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
      ];
    }

    return this.userRepository.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      attributes: { exclude: ['password'] },
    });
  }
}

module.exports = { UsersService };
