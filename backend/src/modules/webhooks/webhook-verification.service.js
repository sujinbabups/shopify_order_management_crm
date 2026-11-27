const {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} = require('@nestjs/common');
const crypto = require('crypto');

@Injectable()
class WebhookVerificationService {
  constructor() {
    this.logger = new Logger('WebhookVerificationService');
  }

  /**
   * Verify HMAC-SHA256 signature against original raw request body
   * @param {string} receivedHmac - Value of x-shopify-hmac-sha256 header
   * @param {Buffer|string} rawBody - Unparsed request body buffer
   * @returns {boolean} true if valid, throws UnauthorizedException/BadRequestException otherwise
   */
  verifyHmac(receivedHmac, rawBody) {
    if (!receivedHmac || typeof receivedHmac !== 'string') {
      throw new BadRequestException('Missing or invalid Shopify webhook HMAC signature header');
    }

    if (!rawBody) {
      throw new BadRequestException('Raw request body is required for HMAC signature verification');
    }

    const secret = process.env.SHOPIFY_API_SECRET;
    if (!secret) {
      this.logger.error('SHOPIFY_API_SECRET is not configured in environment variables');
      throw new UnauthorizedException('Shopify webhook verification misconfigured on server');
    }

    // Ensure rawBody is a Buffer or string
    const bodyBuffer = Buffer.isBuffer(rawBody)
      ? rawBody
      : Buffer.from(rawBody, typeof rawBody === 'string' ? 'utf8' : undefined);

    const calculatedHmac = crypto
      .createHmac('sha256', secret)
      .update(bodyBuffer)
      .digest('base64');

    const calculatedBuffer = Buffer.from(calculatedHmac, 'utf8');
    const receivedBuffer = Buffer.from(receivedHmac.trim(), 'utf8');

    // Secure timing-safe comparison to prevent timing attacks
    if (
      calculatedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(calculatedBuffer, receivedBuffer)
    ) {
      this.logger.warn('Shopify webhook HMAC signature mismatch');
      throw new UnauthorizedException('Invalid Shopify webhook HMAC signature');
    }

    return true;
  }
}

module.exports = { WebhookVerificationService };
