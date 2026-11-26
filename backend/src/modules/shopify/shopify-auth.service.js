const {
  Injectable,
  Dependencies,
  BadRequestException,
  UnauthorizedException,
  InternalServerErrorException,
} = require('@nestjs/common');
const crypto = require('crypto');
const axios = require('axios');
const shopifyConfig = require('../../config/shopify.config');

// In-memory state store with 10-minute TTL
const stateStore = new Map();

@Injectable()
@Dependencies('SHOPIFY_STORE_REPOSITORY')
class ShopifyAuthService {
  constructor(shopifyStoreRepository) {
    this.shopifyStoreRepository = shopifyStoreRepository;
    this.config = shopifyConfig;
  }

  /**
   * Validate and normalize shop domain to name.myshopify.com
   */
  normalizeShopDomain(shop) {
    if (!shop || typeof shop !== 'string') {
      throw new BadRequestException('Shop domain is required');
    }

    let domain = shop.trim().toLowerCase();

    // Strip http/https prefix if present
    domain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');

    // If bare shop name passed, append .myshopify.com
    if (!domain.includes('.')) {
      domain = `${domain}.myshopify.com`;
    }

    // Validate standard myshopify format
    const shopifyDomainRegex = /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/;
    if (!shopifyDomainRegex.test(domain)) {
      throw new BadRequestException(
        'Invalid Shopify store domain. Expected format: your-store.myshopify.com'
      );
    }

    return domain;
  }

  /**
   * Generate secure random nonce and build OAuth authorization URL
   */
  generateAuthUrl(shopDomain) {
    const normalizedShop = this.normalizeShopDomain(shopDomain);
    const state = crypto.randomBytes(16).toString('hex');

    // Store state with 10-minute expiry
    stateStore.set(state, {
      shop: normalizedShop,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    // Cleanup expired states
    this.cleanupExpiredStates();

    const authUrl = new URL(`https://${normalizedShop}/admin/oauth/authorize`);
    authUrl.searchParams.set('client_id', this.config.apiKey);
    authUrl.searchParams.set('scope', this.config.scopes);
    authUrl.searchParams.set('redirect_uri', this.config.redirectUri);
    authUrl.searchParams.set('state', state);

    return {
      authUrl: authUrl.toString(),
      state,
      shopDomain: normalizedShop,
    };
  }

  /**
   * Validate OAuth callback query HMAC signature
   */
  validateHmac(query) {
    const { hmac, signature, ...params } = query;

    if (!hmac) {
      return false;
    }

    // Sort query keys alphabetically
    const sortedKeys = Object.keys(params).sort();
    const message = sortedKeys
      .map((key) => `${key}=${params[key]}`)
      .join('&');

    const calculatedHmac = crypto
      .createHmac('sha256', this.config.apiSecret)
      .update(message)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(calculatedHmac, 'utf8'),
        Buffer.from(hmac, 'utf8')
      );
    } catch (e) {
      return false;
    }
  }

  /**
   * Validate OAuth callback state nonce
   */
  validateState(state, shop) {
    if (!state || !stateStore.has(state)) {
      return false;
    }

    const record = stateStore.get(state);
    stateStore.delete(state); // One-time use

    if (Date.now() > record.expiresAt) {
      return false;
    }

    if (shop && record.shop !== this.normalizeShopDomain(shop)) {
      return false;
    }

    return true;
  }

  /**
   * Exchange authorization code for permanent access token
   */
  async exchangeCodeForToken(shop, code) {
    const normalizedShop = this.normalizeShopDomain(shop);
    const tokenUrl = `https://${normalizedShop}/admin/oauth/access_token`;

    try {
      const response = await axios.post(
        tokenUrl,
        {
          client_id: this.config.apiKey,
          client_secret: this.config.apiSecret,
          code,
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        }
      );

      const { access_token, scope } = response.data;
      if (!access_token) {
        throw new UnauthorizedException('Shopify did not return an access token');
      }

      return {
        accessToken: access_token,
        scope,
      };
    } catch (error) {
      const errorMsg = error.response?.data?.error_description || error.message;
      throw new UnauthorizedException(`Failed to exchange Shopify authorization code: ${errorMsg}`);
    }
  }

  /**
   * Fetch Shop information from Shopify Admin API
   */
  async fetchShopDetails(shop, accessToken) {
    const url = `https://${shop}/admin/api/${this.config.apiVersion}/shop.json`;
    try {
      const response = await axios.get(url, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      return response.data?.shop;
    } catch (error) {
      console.warn('Could not fetch shop details:', error.message);
      return null;
    }
  }

  /**
   * Complete OAuth callback: validate HMAC, validate state, exchange token, persist in DB
   */
  async handleCallback(query) {
    const { code, shop, state } = query;

    if (!this.validateHmac(query)) {
      throw new UnauthorizedException('Invalid Shopify HMAC signature');
    }

    if (!this.validateState(state, shop)) {
      throw new UnauthorizedException('Invalid or expired OAuth state parameter');
    }

    const normalizedShop = this.normalizeShopDomain(shop);
    const { accessToken, scope } = await this.exchangeCodeForToken(normalizedShop, code);
    const shopDetails = await this.fetchShopDetails(normalizedShop, accessToken);

    // Save or update store record
    const [storeRecord] = await this.shopifyStoreRepository.upsert(
      {
        shopDomain: normalizedShop,
        shopifyShopId: shopDetails?.id ? String(shopDetails.id) : null,
        accessToken, // Setter encrypts using AES-256-GCM
        scopes: scope || this.config.scopes,
        isActive: true,
        connectedAt: new Date(),
      },
      { returning: true }
    );

    return {
      store: storeRecord.toJSON(),
      shopDomain: normalizedShop,
    };
  }

  cleanupExpiredStates() {
    const now = Date.now();
    for (const [key, val] of stateStore.entries()) {
      if (now > val.expiresAt) {
        stateStore.delete(key);
      }
    }
  }
}

module.exports = { ShopifyAuthService };
