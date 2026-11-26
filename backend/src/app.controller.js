const { Controller, Get } = require('@nestjs/common');

@Controller()
class AppController {
  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'Mini Order Management CRM Backend',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    };
  }
}

module.exports = { AppController };
