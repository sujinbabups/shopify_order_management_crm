const {
  Injectable,
  Dependencies,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
} = require('@nestjs/common');
const { JwtService } = require('@nestjs/jwt');
const crypto = require('crypto');
const jwtConfig = require('../../config/jwt.config');
const PasswordUtil = require('../../common/utils/password.util');
const { UsersService } = require('../users/users.service');

@Injectable()
@Dependencies(UsersService, JwtService, 'REFRESH_TOKEN_REPOSITORY')
class AuthService {
  constructor(usersService, jwtService, refreshTokenRepository) {
    this.usersService = usersService;
    this.jwtService = jwtService;
    this.refreshTokenRepository = refreshTokenRepository;
  }

  validatePasswordStrength(password) {
    if (!password || typeof password !== 'string') {
      throw new BadRequestException('Password is required');
    }

    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long');
    }

    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[@$!%*?&#^()_+\-=\[\]{}|;:,.<>\/]/.test(password);

    if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      throw new BadRequestException(
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      );
    }
  }

  validateEmailFormat(email) {
    if (!email || typeof email !== 'string') {
      throw new BadRequestException('Email is required');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      throw new BadRequestException('Please provide a valid email address');
    }
  }

  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async generateTokens(user) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: jwtConfig.accessSecret,
      expiresIn: jwtConfig.accessExpiresIn,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: jwtConfig.refreshSecret,
      expiresIn: jwtConfig.refreshExpiresIn,
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.refreshTokenRepository.create({
      userId: user.id,
      tokenHash: this.hashToken(refreshToken),
      expiresAt,
      isRevoked: false,
    });

    return { accessToken, refreshToken };
  }

  async register(registrationDto) {
    const { name, email, password } = registrationDto;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      throw new BadRequestException('Full name must be at least 2 characters long');
    }

    this.validateEmailFormat(email);
    this.validatePasswordStrength(password);

    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('An account with this email address already exists');
    }

    const hashedPassword = await PasswordUtil.hash(password);

    const newUser = await this.usersService.create({
      name: name.trim(),
      email: email.trim(),
      password: hashedPassword,
      role: 'STAFF',
      isActive: true,
    });

    const userProfile = newUser.toJSON();
    const tokens = await this.generateTokens(newUser);

    return {
      user: userProfile,
      tokens,
    };
  }

  async login(loginDto) {
    const { email, password } = loginDto;

    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }

    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await PasswordUtil.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Your account is deactivated. Please contact an administrator.');
    }

    const userProfile = user.toJSON();
    const tokens = await this.generateTokens(user);

    return {
      user: userProfile,
      tokens,
    };
  }

  async refreshTokens(refreshToken) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    let payload;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: jwtConfig.refreshSecret,
      });
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);
    const tokenRecord = await this.refreshTokenRepository.findOne({
      where: {
        tokenHash,
        isRevoked: false,
      },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Refresh token has been revoked or is invalid');
    }

    if (new Date() > new Date(tokenRecord.expiresAt)) {
      await tokenRecord.update({ isRevoked: true });
      throw new UnauthorizedException('Refresh token has expired');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account is invalid or inactive');
    }

    await tokenRecord.update({ isRevoked: true });

    const tokens = await this.generateTokens(user);

    return {
      user: user.toJSON(),
      tokens,
    };
  }

  async logout(refreshToken) {
    if (refreshToken) {
      try {
        const tokenHash = this.hashToken(refreshToken);
        await this.refreshTokenRepository.update(
          { isRevoked: true },
          { where: { tokenHash } }
        );
      } catch (err) {
        // Silent fail on invalid token hash during logout
      }
    }
    return { success: true, message: 'Logged out successfully' };
  }

  async getProfile(userId) {
    const user = await this.usersService.findById(userId);
    return user.toJSON();
  }
}

module.exports = { AuthService };
