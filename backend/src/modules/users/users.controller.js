const { Controller, Get, UseGuards, Query, Dependencies, Bind } = require('@nestjs/common');
const { UsersService } = require('./users.service');
const { JwtAuthGuard } = require('../../common/guards/jwt-auth.guard');
const { RolesGuard } = require('../../common/guards/roles.guard');
const { Roles } = require('../../common/decorators/roles.decorator');
const { CurrentUser } = require('../../common/decorators/current-user.decorator');

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Dependencies(UsersService)
class UsersController {
  constructor(usersService) {
    this.usersService = usersService;
  }

  @Get('me')
  @Bind(CurrentUser())
  async getProfile(user) {
    return {
      success: true,
      data: user,
    };
  }

  @Get()
  @Roles('ADMIN')
  @Bind(Query('page'), Query('limit'), Query('search'))
  async listUsers(page = 1, limit = 10, search = '') {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const offset = (pageNum - 1) * limitNum;

    const { rows, count } = await this.usersService.findAll({
      limit: limitNum,
      offset,
      search,
    });

    return {
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(count / limitNum),
      },
    };
  }
}

module.exports = { UsersController };
