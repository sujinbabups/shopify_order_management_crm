const { Injectable, Logger } = require('@nestjs/common');

@Injectable()
class LoggerMiddleware {
  constructor() {
    this.logger = new Logger('Request');
  }

  use(req, res, next) {
    const { method, originalUrl, ip } = req;
    this.logger.log(`Incoming request: ${method} ${originalUrl} from ${ip}`);
    next();
  }
}

module.exports = { LoggerMiddleware };
