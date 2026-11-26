const { Catch, HttpException, HttpStatus, Logger } = require('@nestjs/common');

@Catch()
class HttpExceptionFilter {
  constructor() {
    this.logger = new Logger('HttpExceptionFilter');
  }

  catch(exception, host) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorDetails = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        message = res.message || res.error || message;
        errorDetails = res.errors || null;
      }
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled Exception: ${exception.message}`, exception.stack);
      // In production, do not leak raw server error details
      if (process.env.NODE_ENV === 'development') {
        message = exception.message;
      }
    }

    const errorResponse = {
      success: false,
      statusCode: status,
      message,
      ...(errorDetails ? { errors: errorDetails } : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(errorResponse);
  }
}

module.exports = { HttpExceptionFilter };
