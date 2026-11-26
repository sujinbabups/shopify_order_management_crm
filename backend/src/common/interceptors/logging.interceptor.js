const { Injectable, Logger } = require('@nestjs/common');
const { tap } = require('rxjs/operators');

@Injectable()
class LoggingInterceptor {
  constructor() {
    this.logger = new Logger('HTTP');
  }

  intercept(context, next) {
    const req = context.switchToHttp().getRequest();
    const { method, originalUrl, ip } = req;
    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse();
          const { statusCode } = res;
          const delay = Date.now() - now;
          this.logger.log(`${method} ${originalUrl} ${statusCode} - ${delay}ms [${ip}]`);
        },
        error: (err) => {
          const delay = Date.now() - now;
          const statusCode = err.status || 500;
          this.logger.warn(`${method} ${originalUrl} ${statusCode} - ${delay}ms [${ip}] - ${err.message}`);
        },
      })
    );
  }
}

module.exports = { LoggingInterceptor };
