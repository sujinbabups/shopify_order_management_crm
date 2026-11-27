require('dotenv').config();

const appUrl = (process.env.SHOPIFY_APP_URL || 'http://localhost:5000').replace(/\/$/, '');

module.exports = {
  apiKey: process.env.SHOPIFY_API_KEY || '',
  apiSecret: process.env.SHOPIFY_API_SECRET || '',
  apiVersion: process.env.SHOPIFY_API_VERSION || '2024-10',
  appUrl,
  redirectUri:
    process.env.SHOPIFY_REDIRECT_URI ||
    `${appUrl}/api/v1/shopify/callback`,
  scopes:
    process.env.SHOPIFY_SCOPES ||
    'read_orders,write_orders,read_customers,read_products',
  encryptionKey:
    process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY ||
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
};
