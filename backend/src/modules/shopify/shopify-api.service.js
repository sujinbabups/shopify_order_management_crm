const { Injectable, Logger, HttpException, HttpStatus } = require('@nestjs/common');
const axios = require('axios');
const shopifyConfig = require('../../config/shopify.config');

@Injectable()
class ShopifyApiService {
  constructor() {
    this.logger = new Logger('ShopifyApiService');
    this.config = shopifyConfig;
  }

  /**
   * Execute Shopify GraphQL query with retry on rate limit
   */
  async graphqlRequest(shopDomain, accessToken, query, variables = {}, retries = 2) {
    const url = `https://${shopDomain}/admin/api/${this.config.apiVersion}/graphql.json`;

    try {
      const response = await axios.post(
        url,
        { query, variables },
        {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );

      if (response.data.errors && response.data.errors.length > 0) {
        const errorMsg = response.data.errors.map((e) => e.message).join(', ');
        throw new Error(`Shopify GraphQL Error: ${errorMsg}`);
      }

      return response.data.data;
    } catch (error) {
      if (error.response?.status === 429 && retries > 0) {
        const retryAfter = parseInt(error.response.headers['retry-after'] || '2', 10);
        this.logger.warn(`Shopify rate limit encountered. Retrying in ${retryAfter}s...`);
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        return this.graphqlRequest(shopDomain, accessToken, query, variables, retries - 1);
      }

      const status = error.response?.status || HttpStatus.BAD_GATEWAY;
      const message = error.response?.data?.errors || error.message;
      this.logger.error(`Shopify API call failed for ${shopDomain}: ${JSON.stringify(message)}`);
      throw new HttpException(
        `Shopify API request failed: ${typeof message === 'string' ? message : JSON.stringify(message)}`,
        status
      );
    }
  }

  /**
   * Execute Shopify REST request with retry on rate limit
   */
  async restRequest(shopDomain, accessToken, endpoint, method = 'GET', data = null, retries = 2) {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `https://${shopDomain}/admin/api/${this.config.apiVersion}${cleanEndpoint}`;

    try {
      const response = await axios({
        url,
        method,
        data,
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });

      return {
        data: response.data,
        headers: response.headers,
      };
    } catch (error) {
      if (error.response?.status === 429 && retries > 0) {
        const retryAfter = parseInt(error.response.headers['retry-after'] || '2', 10);
        this.logger.warn(`Shopify rate limit encountered on REST endpoint. Retrying in ${retryAfter}s...`);
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        return this.restRequest(shopDomain, accessToken, endpoint, method, data, retries - 1);
      }

      const status = error.response?.status || HttpStatus.BAD_GATEWAY;
      const message = error.response?.data?.errors || error.message;
      this.logger.error(`Shopify REST API error for ${shopDomain}: ${JSON.stringify(message)}`);
      throw new HttpException(
        `Shopify REST request failed: ${typeof message === 'string' ? message : JSON.stringify(message)}`,
        status
      );
    }
  }

  /**
   * Fetch a page of orders via GraphQL with cursor pagination
   */
  async fetchOrdersGraphQL(shopDomain, accessToken, { limit = 50, cursor = null } = {}) {
    const query = `
      query getOrders($first: Int!, $after: String) {
        orders(first: $first, after: $after, sortKey: CREATED_AT, reverse: true) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            cursor
            node {
              id
              name
              displayFinancialStatus
              displayFulfillmentStatus
              totalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              createdAt
              customer {
                id
                firstName
                lastName
                email
                phone
              }
              lineItems(first: 50) {
                edges {
                  node {
                    id
                    title
                    variantTitle
                    sku
                    quantity
                    discountedUnitPriceSet {
                      shopMoney {
                        amount
                      }
                    }
                    discountedTotalSet {
                      shopMoney {
                        amount
                      }
                    }
                    product {
                      id
                      title
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const variables = { first: limit, after: cursor };
    const result = await this.graphqlRequest(shopDomain, accessToken, query, variables);

    const ordersData = result?.orders;
    if (!ordersData) {
      return { orders: [], hasNextPage: false, endCursor: null };
    }

    const orders = (ordersData.edges || []).map((edge) => {
      const node = edge.node;
      // Strip gid prefix: "gid://shopify/Order/123456" -> "123456"
      const rawOrderId = node.id ? String(node.id).replace(/^gid:\/\/shopify\/Order\//, '') : null;
      const rawCustomerId = node.customer?.id
        ? String(node.customer.id).replace(/^gid:\/\/shopify\/Customer\//, '')
        : null;

      const lineItems = (node.lineItems?.edges || []).map((itemEdge) => {
        const item = itemEdge.node;
        const lineItemId = item.id
          ? String(item.id).replace(/^gid:\/\/shopify\/LineItem\//, '')
          : null;
        const productId = item.product?.id
          ? String(item.product.id).replace(/^gid:\/\/shopify\/Product\//, '')
          : null;

        return {
          id: lineItemId,
          title: item.title,
          variantTitle: item.variantTitle,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: parseFloat(item.discountedUnitPriceSet?.shopMoney?.amount || 0),
          totalPrice: parseFloat(item.discountedTotalSet?.shopMoney?.amount || 0),
          productId,
          productTitle: item.product?.title || item.title,
        };
      });

      return {
        id: rawOrderId,
        orderNumber: node.name ? node.name.replace('#', '') : rawOrderId,
        name: node.name,
        financialStatus: (node.displayFinancialStatus || 'pending').toLowerCase(),
        fulfillmentStatus: node.displayFulfillmentStatus ? node.displayFulfillmentStatus.toLowerCase() : null,
        totalAmount: parseFloat(node.totalPriceSet?.shopMoney?.amount || 0),
        currency: node.totalPriceSet?.shopMoney?.currencyCode || 'USD',
        createdAt: node.createdAt,
        customer: node.customer
          ? {
              id: rawCustomerId,
              firstName: node.customer.firstName,
              lastName: node.customer.lastName,
              email: node.customer.email,
              phone: node.customer.phone,
            }
          : null,
        lineItems,
      };
    });

    return {
      orders,
      hasNextPage: ordersData.pageInfo?.hasNextPage || false,
      endCursor: ordersData.pageInfo?.endCursor || null,
    };
  }

  /**
   * Fetch orders via REST API (fallback / alternative)
   */
  async fetchOrdersREST(shopDomain, accessToken, { limit = 50, sinceId = null } = {}) {
    let endpoint = `/orders.json?status=any&limit=${limit}`;
    if (sinceId) {
      endpoint += `&since_id=${sinceId}`;
    }

    const { data } = await this.restRequest(shopDomain, accessToken, endpoint);
    const rawOrders = data?.orders || [];

    const orders = rawOrders.map((raw) => {
      const lineItems = (raw.line_items || []).map((item) => ({
        id: String(item.id),
        title: item.title,
        variantTitle: item.variant_title,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: parseFloat(item.price || 0),
        totalPrice: parseFloat(item.price || 0) * (item.quantity || 1),
        productId: item.product_id ? String(item.product_id) : null,
        productTitle: item.title,
      }));

      return {
        id: String(raw.id),
        orderNumber: String(raw.order_number || raw.id),
        name: raw.name,
        financialStatus: (raw.financial_status || 'pending').toLowerCase(),
        fulfillmentStatus: raw.fulfillment_status ? raw.fulfillment_status.toLowerCase() : null,
        totalAmount: parseFloat(raw.total_price || 0),
        currency: raw.currency || 'USD',
        createdAt: raw.created_at,
        customer: raw.customer
          ? {
              id: String(raw.customer.id),
              firstName: raw.customer.first_name,
              lastName: raw.customer.last_name,
              email: raw.customer.email,
              phone: raw.customer.phone,
            }
          : null,
        lineItems,
      };
    });

    return {
      orders,
      hasNextPage: false,
      endCursor: null,
    };
  }
}

module.exports = { ShopifyApiService };
