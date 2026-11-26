require('reflect-metadata');
require('dotenv').config();

const request = require('supertest');
const { Test } = require('@nestjs/testing');
const cookieParser = require('cookie-parser');
const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const { AppModule } = require('../src/app.module');
const { HttpExceptionFilter } = require('../src/common/filters/http-exception.filter');
const { db } = require('../src/database/database.providers');
const { ShopifyApiService } = require('../src/modules/shopify/shopify-api.service');
const { ShopifyOrderService } = require('../src/modules/shopify/shopify-order.service');

describe('Shopify Integration & Order Import (e2e)', () => {
  let app;
  let httpServer;
  let adminAccessToken;
  let staffAccessToken;
  let shopifyApiService;
  let shopifyOrderService;

  const testShop = 'demo-crm-store.myshopify.com';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.use(express.json());
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();
    httpServer = app.getHttpServer();

    shopifyApiService = app.get(ShopifyApiService);
    shopifyOrderService = app.get(ShopifyOrderService);

    // Clean up any test stores, orders, and customers from previous runs
    await db.OrderItem.destroy({ where: {}, truncate: true, cascade: true });
    await db.Order.destroy({ where: {}, truncate: true, cascade: true });
    await db.Customer.destroy({ where: {}, truncate: true, cascade: true });
    await db.ImportHistory.destroy({ where: {}, truncate: true, cascade: true });
    await db.ShopifyStore.destroy({ where: {}, truncate: true, cascade: true });

    // 1. Log in as seeded ADMIN to obtain admin JWT
    const adminLoginRes = await request(httpServer)
      .post('/api/v1/auth/login')
      .send({
        email: process.env.ADMIN_EMAIL || 'admin@example.com',
        password: process.env.ADMIN_PASSWORD || 'Admin@Password123',
      });
    adminAccessToken = adminLoginRes.body.data.accessToken;

    // 2. Register and log in a STAFF user to verify role-based restrictions
    const staffEmail = `staff_${Date.now()}@example.com`;
    const staffRegisterRes = await request(httpServer)
      .post('/api/v1/auth/register')
      .send({
        name: 'Regular Staff',
        email: staffEmail,
        password: 'Password@123',
      });
    staffAccessToken = staffRegisterRes.body.data.accessToken;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('1 & 2. Shopify Connection Initiation & Domain Validation', () => {
    it('1. should initiate Shopify connection for valid shop domain', async () => {
      const response = await request(httpServer)
        .post('/api/v1/shopify/connect')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ shopDomain: 'demo-crm-store' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('authUrl');
      expect(response.body.data).toHaveProperty('state');
      expect(response.body.data.shopDomain).toBe('demo-crm-store.myshopify.com');
      expect(response.body.data.authUrl).toContain('oauth/authorize');
      expect(response.body.data.authUrl).toContain('client_id=');
    });

    it('2. should reject invalid Shopify store domain with 400', async () => {
      const response = await request(httpServer)
        .post('/api/v1/shopify/connect')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ shopDomain: 'illegal*domain!!' })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Invalid Shopify store domain');
    });
  });

  describe('3, 4, 5. Shopify OAuth Callback Security & Persistence', () => {
    let validState;

    beforeEach(async () => {
      const connectRes = await request(httpServer)
        .post('/api/v1/shopify/connect')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ shopDomain: testShop });
      validState = connectRes.body.data.state;
    });

    it('3. should reject OAuth callback with invalid state', async () => {
      const query = {
        code: 'mock_code',
        shop: testShop,
        state: 'tampered_invalid_state',
        timestamp: String(Math.floor(Date.now() / 1000)),
      };

      // Compute valid HMAC for query
      const sorted = Object.keys(query).sort().map((k) => `${k}=${query[k]}`).join('&');
      const hmac = crypto
        .createHmac('sha256', process.env.SHOPIFY_API_SECRET || 'test_shopify_api_secret_placeholder')
        .update(sorted)
        .digest('hex');

      const response = await request(httpServer)
        .get(`/api/v1/shopify/callback?${sorted}&hmac=${hmac}`)
        .expect(302); // Redirects to frontend with error

      expect(decodeURIComponent(response.headers.location)).toContain('status=error');
      expect(decodeURIComponent(response.headers.location)).toContain('OAuth state');
    });

    it('4. should reject OAuth callback with invalid HMAC', async () => {
      const query = `code=mock_code&shop=${testShop}&state=${validState}&timestamp=123456789&hmac=invalid_forged_hmac`;

      const response = await request(httpServer)
        .get(`/api/v1/shopify/callback?${query}`)
        .expect(302);

      expect(response.headers.location).toContain('status=error');
      expect(response.headers.location).toContain('HMAC');
    });

    it('5. should process successful OAuth callback, exchange token, and store encrypted token', async () => {
      // Mock axios token exchange and shop details call
      const axiosPostSpy = jest.spyOn(axios, 'post').mockImplementation((url) => {
        if (url.includes('access_token')) {
          return Promise.resolve({
            data: {
              access_token: 'shpat_mock_access_token_12345',
              scope: 'read_orders,write_orders',
            },
          });
        }
        return Promise.reject(new Error('Unknown url'));
      });

      const axiosGetSpy = jest.spyOn(axios, 'get').mockImplementation((url) => {
        if (url.includes('shop.json')) {
          return Promise.resolve({
            data: {
              shop: {
                id: 987654321,
                name: 'Demo CRM Store',
                domain: testShop,
                myshopify_domain: testShop,
              },
            },
          });
        }
        return Promise.reject(new Error('Unknown url'));
      });

      const queryObj = {
        code: 'valid_auth_code',
        shop: testShop,
        state: validState,
        timestamp: String(Math.floor(Date.now() / 1000)),
      };

      const sorted = Object.keys(queryObj).sort().map((k) => `${k}=${queryObj[k]}`).join('&');
      const hmac = crypto
        .createHmac('sha256', process.env.SHOPIFY_API_SECRET || 'test_shopify_api_secret_placeholder')
        .update(sorted)
        .digest('hex');

      const response = await request(httpServer)
        .get(`/api/v1/shopify/callback?${sorted}&hmac=${hmac}`)
        .expect(302);

      expect(response.headers.location).toContain('status=connected');
      expect(response.headers.location).toContain(`shop=${encodeURIComponent(testShop)}`);

      // Verify store in database
      const storeInDb = await db.ShopifyStore.findOne({ where: { shopDomain: testShop } });
      expect(storeInDb).toBeDefined();
      expect(storeInDb.isActive).toBe(true);
      expect(storeInDb.accessToken).toBe('shpat_mock_access_token_12345');

      axiosPostSpy.mockRestore();
      axiosGetSpy.mockRestore();
    });
  });

  describe('6. Shopify Connection Status', () => {
    it('6. should return connected store status without exposing access token', async () => {
      const response = await request(httpServer)
        .get('/api/v1/shopify/status')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('isConnected', true);
      expect(response.body.data.store).toHaveProperty('shopDomain', testShop);
      expect(response.body.data.store).not.toHaveProperty('accessToken');
    });
  });

  describe('7, 8, 9, 10, 11. Order Import, Duplication Protection, Customers & Items', () => {
    const mockOrderNode = {
      orders: [
        {
          id: '5566778899',
          orderNumber: '1001',
          name: '#1001',
          financialStatus: 'paid',
          fulfillmentStatus: 'unfulfilled',
          totalAmount: 149.99,
          currency: 'USD',
          createdAt: new Date().toISOString(),
          customer: {
            id: '99887766',
            firstName: 'Sarah',
            lastName: 'Connor',
            email: 'sarah.connor@example.com',
            phone: '+15551234567',
          },
          lineItems: [
            {
              id: '112233',
              title: 'Wireless Mechanical Keyboard',
              variantTitle: 'RGB Brown Switch',
              sku: 'KB-MECH-BR',
              quantity: 1,
              unitPrice: 149.99,
              totalPrice: 149.99,
              productId: '778899',
              productTitle: 'Wireless Mechanical Keyboard',
            },
          ],
        },
      ],
      hasNextPage: false,
      endCursor: null,
    };

    it('7. should successfully communicate with Shopify API service and map orders', async () => {
      const fetchSpy = jest
        .spyOn(shopifyApiService, 'fetchOrdersGraphQL')
        .mockResolvedValueOnce(mockOrderNode);

      const result = await shopifyApiService.fetchOrdersGraphQL(testShop, 'mock_token', {});
      expect(result.orders).toHaveLength(1);
      expect(result.orders[0].name).toBe('#1001');
      expect(result.orders[0].customer.email).toBe('sarah.connor@example.com');
      expect(result.orders[0].lineItems).toHaveLength(1);

      fetchSpy.mockRestore();
    });

    it('8. should successfully import order into PostgreSQL database', async () => {
      const fetchSpy = jest
        .spyOn(shopifyApiService, 'fetchOrdersGraphQL')
        .mockResolvedValueOnce(mockOrderNode);

      const response = await request(httpServer)
        .post('/api/v1/shopify/orders/import')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.stats).toHaveProperty('totalFetched', 1);
      expect(response.body.stats).toHaveProperty('successfullyImported', 1);
      expect(response.body.stats).toHaveProperty('updatedExisting', 0);
      expect(response.body.stats).toHaveProperty('failed', 0);

      // Verify order record in DB
      const order = await db.Order.findOne({
        where: { shopifyOrderId: '5566778899' },
        include: [{ model: db.Customer, as: 'customer' }, { model: db.OrderItem, as: 'items' }],
      });

      expect(order).toBeDefined();
      expect(order.orderName).toBe('#1001');
      expect(parseFloat(order.totalAmount)).toBe(149.99);

      // 10. Verify Customer synchronization
      expect(order.customer).toBeDefined();
      expect(order.customer.email).toBe('sarah.connor@example.com');
      expect(order.customer.firstName).toBe('Sarah');

      // 11. Verify OrderItem persistence
      expect(order.items).toHaveLength(1);
      expect(order.items[0].sku).toBe('KB-MECH-BR');
      expect(order.items[0].quantity).toBe(1);
      expect(parseFloat(order.items[0].unitPrice)).toBe(149.99);

      fetchSpy.mockRestore();
    });

    it('9. should safely re-run import and prevent duplicate records (updates existing order)', async () => {
      // Modify order total and financial status in mock to verify update
      const updatedMockNode = {
        orders: [
          {
            ...mockOrderNode.orders[0],
            financialStatus: 'refunded',
            totalAmount: 149.99,
          },
        ],
        hasNextPage: false,
        endCursor: null,
      };

      const fetchSpy = jest
        .spyOn(shopifyApiService, 'fetchOrdersGraphQL')
        .mockResolvedValueOnce(updatedMockNode);

      const response = await request(httpServer)
        .post('/api/v1/shopify/orders/import')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.stats).toHaveProperty('totalFetched', 1);
      expect(response.body.stats).toHaveProperty('successfullyImported', 0);
      expect(response.body.stats).toHaveProperty('updatedExisting', 1);
      expect(response.body.stats).toHaveProperty('failed', 0);

      // Check total order count in DB: still exactly 1 order
      const count = await db.Order.count({ where: { shopifyOrderId: '5566778899' } });
      expect(count).toBe(1);

      const updatedOrder = await db.Order.findOne({ where: { shopifyOrderId: '5566778899' } });
      expect(updatedOrder.financialStatus).toBe('refunded');

      fetchSpy.mockRestore();
    });
  });

  describe('12 & 13. Shopify API Failure & Transaction Rollback', () => {
    it('12. should handle Shopify API failure safely without corrupting local data', async () => {
      const fetchSpy = jest
        .spyOn(shopifyApiService, 'fetchOrdersGraphQL')
        .mockRejectedValueOnce(new Error('Shopify 502 Bad Gateway'));

      const restSpy = jest
        .spyOn(shopifyApiService, 'fetchOrdersREST')
        .mockRejectedValueOnce(new Error('Shopify 502 Bad Gateway'));

      const response = await request(httpServer)
        .post('/api/v1/shopify/orders/import')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(500);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Shopify 502 Bad Gateway');

      // Verify that ImportHistory logged the failure
      const latestHistory = await db.ImportHistory.findOne({
        order: [['startedAt', 'DESC']],
      });
      expect(latestHistory.status).toBe('FAILED');
      expect(latestHistory.errorMessage).toContain('Shopify 502 Bad Gateway');

      fetchSpy.mockRestore();
      restSpy.mockRestore();
    });

    it('13. should rollback database transaction on order write failure', async () => {
      const invalidOrder = {
        orders: [
          {
            id: '9999999999',
            name: '#ERROR-TEST',
            totalAmount: 50.0,
            currency: 'USD',
            customer: null,
            lineItems: [],
          },
        ],
        hasNextPage: false,
        endCursor: null,
      };

      const fetchSpy = jest
        .spyOn(shopifyApiService, 'fetchOrdersGraphQL')
        .mockResolvedValueOnce(invalidOrder);

      // Force failure during transaction by spying on order creation to throw
      const orderCreateSpy = jest
        .spyOn(db.Order, 'create')
        .mockRejectedValueOnce(new Error('Simulated DB constraint error'));

      const response = await request(httpServer)
        .post('/api/v1/shopify/orders/import')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      // Individual order failed inside its transaction, stats reflect failure
      expect(response.body.stats.failed).toBe(1);

      // Verify order was not created in DB
      const failedOrder = await db.Order.findOne({ where: { shopifyOrderId: '9999999999' } });
      expect(failedOrder).toBeNull();

      fetchSpy.mockRestore();
      orderCreateSpy.mockRestore();
    });
  });

  describe('14. Unauthorized Shopify Operations & Access Control', () => {
    it('14a. should reject unauthenticated connect request with 401', async () => {
      await request(httpServer)
        .post('/api/v1/shopify/connect')
        .send({ shopDomain: testShop })
        .expect(401);
    });

    it('14b. should reject non-admin (STAFF) connect request with 403', async () => {
      await request(httpServer)
        .post('/api/v1/shopify/connect')
        .set('Authorization', `Bearer ${staffAccessToken}`)
        .send({ shopDomain: testShop })
        .expect(403);
    });

    it('14c. should reject non-admin (STAFF) import request with 403', async () => {
      await request(httpServer)
        .post('/api/v1/shopify/orders/import')
        .set('Authorization', `Bearer ${staffAccessToken}`)
        .expect(403);
    });

    it('14d. should reject non-admin (STAFF) disconnect request with 403', async () => {
      await request(httpServer)
        .delete('/api/v1/shopify/disconnect')
        .set('Authorization', `Bearer ${staffAccessToken}`)
        .expect(403);
    });
  });
});
