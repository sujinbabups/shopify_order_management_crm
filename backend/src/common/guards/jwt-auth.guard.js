const { Injectable, CanActivate, ExecutionContext, UnauthorizedException } = require('@nestjs/common');
const jwt = require('jsonwebtoken');
const jwtConfig = require('../../config/jwt.config');

@Injectable()
class JwtAuthGuard {
  constructor() {
    this.jwtConfig = jwtConfig;
  }

  async canActivate(context) {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Authentication token is missing');
    }

    try {
      const payload = jwt.verify(token, this.jwtConfig.accessSecret);
      if (!payload || !payload.sub) {
        throw new UnauthorizedException('Invalid token payload');
      }

      const { User } = require('../../database/models');
      const user = await User.findByPk(payload.sub);

      if (!user) {
        throw new UnauthorizedException('User account no longer exists');
      }

      if (!user.isActive) {
        throw new UnauthorizedException('User account is deactivated');
      }

      request.user = user.toJSON();
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Access token has expired');
      }
      throw new UnauthorizedException('Invalid authentication token');
    }
  }

  extractTokenFromHeader(request) {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    // Also check cookie as fallback
    if (request.cookies && request.cookies.access_token) {
      return request.cookies.access_token;
    }
    return null;
  }
}

module.exports = { JwtAuthGuard };
