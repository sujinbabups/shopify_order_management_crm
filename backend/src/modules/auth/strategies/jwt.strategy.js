const { Injectable, UnauthorizedException, Dependencies } = require('@nestjs/common');
const { PassportStrategy } = require('@nestjs/passport');
const { Strategy, ExtractJwt } = require('passport-jwt');
const jwtConfig = require('../../../config/jwt.config');
const { UsersService } = require('../../users/users.service');

@Injectable()
@Dependencies(UsersService)
class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(usersService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req) => {
          if (req && req.cookies) {
            return req.cookies.access_token;
          }
          return null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: jwtConfig.accessSecret,
    });
    this.usersService = usersService;
  }

  async validate(payload) {
    if (!payload || !payload.sub) {
      throw new UnauthorizedException('Invalid token');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account is invalid or inactive');
    }

    return user.toJSON();
  }
}

module.exports = { JwtStrategy };
