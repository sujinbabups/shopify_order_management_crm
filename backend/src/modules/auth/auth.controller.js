const {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Dependencies,
  Bind,
} = require('@nestjs/common');
const { AuthService } = require('./auth.service');
const { JwtAuthGuard } = require('../../common/guards/jwt-auth.guard');
const { CurrentUser } = require('../../common/decorators/current-user.decorator');
const jwtConfig = require('../../config/jwt.config');

@Controller('auth')
@Dependencies(AuthService)
class AuthController {
  constructor(authService) {
    this.authService = authService;
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Bind(Body(), Res({ passthrough: true }))
  async register(registrationDto, res) {
    const { user, tokens } = await this.authService.register(registrationDto);

    res.cookie('refresh_token', tokens.refreshToken, jwtConfig.cookieOptions);

    return {
      success: true,
      message: 'User registered successfully',
      data: {
        user,
        accessToken: tokens.accessToken,
      },
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Bind(Body(), Res({ passthrough: true }))
  async login(loginDto, res) {
    const { user, tokens } = await this.authService.login(loginDto);

    res.cookie('refresh_token', tokens.refreshToken, jwtConfig.cookieOptions);

    return {
      success: true,
      message: 'Login successful',
      data: {
        user,
        accessToken: tokens.accessToken,
      },
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Bind(Req(), Body(), Res({ passthrough: true }))
  async refresh(req, body, res) {
    const refreshToken = req.cookies?.refresh_token || body?.refreshToken;

    const { user, tokens } = await this.authService.refreshTokens(refreshToken);

    res.cookie('refresh_token', tokens.refreshToken, jwtConfig.cookieOptions);

    return {
      success: true,
      message: 'Token refreshed successfully',
      data: {
        user,
        accessToken: tokens.accessToken,
      },
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @Bind(Req(), Body(), Res({ passthrough: true }))
  async logout(req, body, res) {
    const refreshToken = req.cookies?.refresh_token || body?.refreshToken;

    await this.authService.logout(refreshToken);

    res.clearCookie('refresh_token', {
      ...jwtConfig.cookieOptions,
      maxAge: 0,
    });

    return {
      success: true,
      message: 'Logged out successfully',
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Bind(CurrentUser())
  async getMe(user) {
    return {
      success: true,
      data: user,
    };
  }
}

module.exports = { AuthController };
