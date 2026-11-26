require('reflect-metadata');
require('dotenv').config();

const request = require('supertest');
const { Test } = require('@nestjs/testing');
const cookieParser = require('cookie-parser');
const express = require('express');
const { BadRequestException, BadGatewayException } = require('@nestjs/common');
const { AppModule } = require('../src/app.module');
const { HttpExceptionFilter } = require('../src/common/filters/http-exception.filter');
const { db } = require('../src/database/database.providers');
const { ShopifyApiService } = require('../src/modules/shopify/shopify-api.service');
const CryptoUtil = require('../src/common/utils/crypto.util');

describe('CRM Order Creation & Manual Order Placement (e2e)', () => {
  let app;
  let httpServer;
  let adminAccessToken;
  let shopifyApiService;
  let testStore;

  const testShopDomain = 'order-crm-test-store.myshopify.com';

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

    // Clean up all related tables before testing
    await db.OrderItem.destroy({ where: {}, truncate: true, cascade: true });
    await db.Order.destroy({ where: {}, truncate: true, cascade: true });
    await db.Customer.destroy({ where: {}, truncate: true, cascade: true });
    await db.Product.destroy({ where: {}, truncate: true, cascade: true });
    await db.ImportHistory.destroy({ where: {}, truncate: true, cascade: true });
    await db.ShopifyStore.destroy({ where: {}, truncate: true, cascade: true });

    // Seed active Shopify store
    testStore = await db.ShopifyStore.create({
      shopDomain: testShopDomain,
      shopifyShopId: 'gid://shopify/Shop/99887766',
      accessToken: 'shpat_mock_test_token_12345',
      scopes: 'read_orders,write_orders,read_products,read_customers',
      isActive: true,
      connectedAt: new Date(),
    });

    // Obtain admin JWT
    const adminLoginRes = await request(httpServer)
      .post('/api/v1/auth/login')
      .send({
        email: process.env.ADMIN_EMAIL || 'admin@example.com',
        password: process.env.ADMIN_PASSWORD || 'Admin@Password123',
      });
    adminAccessToken = adminLoginRes.body.data.accessToken;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Validation Requirements', () => {
    it('Scenario 2: should reject order creation when customer info is missing (400)', async () => {
      const payload = {
        lineItems: [
          { productTitle: 'Test Widget', quantity: 1, unitPrice: 25.0 },
        ],
      };

      const response = await request(httpServer)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(payload)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Customer information or existing customerId is required');
    });

    it('Scenario 3: should reject order creation when customer email format is invalid (400)', async () => {
      const payload = {
        customer: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'invalid-email-address',
        },
        lineItems: [
          { productTitle: 'Test Widget', quantity: 1, unitPrice: 25.0 },
        ],
      };

      const response = await request(httpServer)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(payload)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('valid customer email address');
    });

    it('Scenario 4: should reject order creation when line items array is missing or empty (400)', async () => {
      const payload = {
        customer: {
          firstName: 'Alice',
          email: 'alice@example.com',
        },
        lineItems: [],
      };

      const response = await request(httpServer)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(payload)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('at least one line item');
    });

    it('Scenario 5: should reject order creation when line item product title is missing (400)', async () => {
      const payload = {
        customer: {
          firstName: 'Bob',
          email: 'bob@example.com',
        },
        lineItems: [
          { quantity: 2, unitPrice: 15.0 },
        ],
      };

      const response = await request(httpServer)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(payload)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('missing product title');
    });

    it('Scenario 6: should reject order creation with 0 or negative quantities (400)', async () => {
      const payload = {
        customer: {
          firstName: 'Charlie',
          email: 'charlie@example.com',
        },
        lineItems: [
          { productTitle: 'Test Gadget', quantity: 0, unitPrice: 10.0 },
        ],
      };

      const responseZero = await request(httpServer)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(payload)
        .expect(400);

      expect(responseZero.body.success).toBe(false);
      expect(responseZero.body.message).toContain('positive integer');

      const payloadNegative = {
        customer: {
          firstName: 'Charlie',
          email: 'charlie@example.com',
        },
        lineItems: [
          { productTitle: 'Test Gadget', quantity: -3, unitPrice: 10.0 },
        ],
      };

      const responseNeg = await request(httpServer)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(payloadNegative)
        .expect(400);

      expect(responseNeg.body.success).toBe(false);
      expect(responseNeg.body.message).toContain('positive integer');
    });

    it('should reject order creation with invalid negative unit price (400)', async () => {
      const payload = {
        customer: {
          firstName: 'David',
          email: 'david@example.com',
        },
        lineItems: [
          { productTitle: 'Test Item', quantity: 1, unitPrice: -5.0 },
        ],
      };

      const response = await request(httpServer)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(payload)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('non-negative number');
    });
  });

  describe('2. Authentication and Authorization', () => {
    it('Scenario 15: should reject unauthorized order creation request without JWT (401)', async () => {
      const response = await request(httpServer)
        .post('/api/v1/orders')
        .send({
          customer: { firstName: 'Test', email: 'test@example.com' },
          lineItems: [{ productTitle: 'Test', quantity: 1, unitPrice: 10 }],
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('3. Order Creation, Calculations & Persistence', () => {
    it('Scenario 1 & 8: should successfully create order in Shopify and persist in PostgreSQL with correct totals', async () => {
      const mockShopifyResponse = {
        id: 'gid://shopify/Order/88001122',
        orderNumber: '1001',
        name: '#1001',
        email: 'sarah.connor@example.com',
        currency: 'USD',
        totalAmount: 150.0,
        subtotalAmount: 150.0,
        financialStatus: 'paid',
        fulfillmentStatus: null,
        createdAt: new Date().toISOString(),
        customer: {
          id: 'gid://shopify/Customer/990011',
          firstName: 'Sarah',
          lastName: 'Connor',
          email: 'sarah.connor@example.com',
          phone: '+15551234567',
        },
        lineItems: [
          {
            id: 'gid://shopify/LineItem/7711',
            productTitle: 'Ergonomic Mechanical Keyboard',
            variantTitle: 'Tactile Brown Switches',
            sku: 'KEY-MECH-BRN',
            quantity: 1,
            unitPrice: 150.0,
            totalPrice: 150.0,
          },
        ],
      };

      jest.spyOn(shopifyApiService, 'createOrder').mockResolvedValueOnce(mockShopifyResponse);

      const payload = {
        customer: {
          firstName: 'Sarah',
          lastName: 'Connor',
          email: 'sarah.connor@example.com',
          phone: '+15551234567',
        },
        lineItems: [
          {
            productTitle: 'Ergonomic Mechanical Keyboard',
            variantTitle: 'Tactile Brown Switches',
            sku: 'KEY-MECH-BRN',
            quantity: 1,
            unitPrice: 150.0,
          },
        ],
        financialStatus: 'paid',
        currency: 'USD',
        note: 'High priority customer',
      };

      const response = await request(httpServer)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(payload)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.shopifyOrderId).toBe('gid://shopify/Order/88001122');
      expect(response.body.data.orderName).toBe('#1001');
      expect(parseFloat(response.body.data.totalAmount)).toBe(150.0);
      expect(response.body.data.currency).toBe('USD');
      expect(response.body.data.customer.email).toBe('sarah.connor@example.com');
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].productTitle).toBe('Ergonomic Mechanical Keyboard');
      expect(parseFloat(response.body.data.items[0].unitPrice)).toBe(150.0);
    });

    it('Scenario 7 & 11: should handle multiple line items and verify DB persistence across all models', async () => {
      const mockShopifyResponse = {
        id: 'gid://shopify/Order/88002233',
        orderNumber: '1002',
        name: '#1002',
        email: 'john.wick@example.com',
        currency: 'USD',
        totalAmount: 185.0,
        subtotalAmount: 185.0,
        financialStatus: 'paid',
        fulfillmentStatus: null,
        createdAt: new Date().toISOString(),
        customer: {
          id: 'gid://shopify/Customer/990022',
          firstName: 'John',
          lastName: 'Wick',
          email: 'john.wick@example.com',
          phone: '+15559876543',
        },
        lineItems: [
          {
            id: 'gid://shopify/LineItem/7722',
            productTitle: 'Tailored Black Suit',
            variantTitle: 'Size 40R',
            sku: 'SUIT-BLK-40R',
            quantity: 1,
            unitPrice: 150.0,
            totalPrice: 150.0,
          },
          {
            id: 'gid://shopify/LineItem/7733',
            productTitle: 'Tactical Pen',
            variantTitle: 'Titanium',
            sku: 'PEN-TAC-TI',
            quantity: 2,
            unitPrice: 17.5,
            totalPrice: 35.0,
          },
        ],
      };

      jest.spyOn(shopifyApiService, 'createOrder').mockResolvedValueOnce(mockShopifyResponse);

      const payload = {
        customer: {
          firstName: 'John',
          lastName: 'Wick',
          email: 'john.wick@example.com',
          phone: '+15559876543',
        },
        lineItems: [
          {
            productTitle: 'Tailored Black Suit',
            variantTitle: 'Size 40R',
            sku: 'SUIT-BLK-40R',
            quantity: 1,
            unitPrice: 150.0,
          },
          {
            productTitle: 'Tactical Pen',
            variantTitle: 'Titanium',
            sku: 'PEN-TAC-TI',
            quantity: 2,
            unitPrice: 17.5,
          },
        ],
        financialStatus: 'paid',
      };

      const response = await request(httpServer)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(payload)
        .expect(201);

      const createdOrder = response.body.data;
      expect(createdOrder.orderName).toBe('#1002');
      expect(createdOrder.items).toHaveLength(2);

      // Scenario 11: Direct Database Verification
      const dbOrder = await db.Order.findByPk(createdOrder.id, {
        include: [
          { model: db.Customer, as: 'customer' },
          { model: db.OrderItem, as: 'items' },
          { model: db.ShopifyStore, as: 'store' },
        ],
      });

      expect(dbOrder).not.toBeNull();
      expect(dbOrder.shopifyOrderId).toBe('gid://shopify/Order/88002233');
      expect(parseFloat(dbOrder.totalAmount)).toBe(185.0);
      expect(dbOrder.customer.email).toBe('john.wick@example.com');
      expect(dbOrder.customer.shopifyCustomerId).toBe('gid://shopify/Customer/990022');
      expect(dbOrder.items).toHaveLength(2);

      // Check Products table auto-registration
      const suitProduct = await db.Product.findOne({ where: { title: 'Tailored Black Suit' } });
      expect(suitProduct).not.toBeNull();
      expect(suitProduct.sku).toBe('SUIT-BLK-40R');

      const penProduct = await db.Product.findOne({ where: { title: 'Tactical Pen' } });
      expect(penProduct).not.toBeNull();
      expect(penProduct.sku).toBe('PEN-TAC-TI');
    });

    it('Scenario 13: should prevent duplicate submission with idempotency key', async () => {
      const mockShopifyResponse = {
        id: 'gid://shopify/Order/88003344',
        orderNumber: '1003',
        name: '#1003',
        email: 'ellen.ripley@example.com',
        currency: 'USD',
        totalAmount: 89.99,
        subtotalAmount: 89.99,
        financialStatus: 'paid',
        createdAt: new Date().toISOString(),
        customer: {
          id: 'gid://shopify/Customer/990033',
          firstName: 'Ellen',
          lastName: 'Ripley',
          email: 'ellen.ripley@example.com',
        },
        lineItems: [
          {
            id: 'gid://shopify/LineItem/7744',
            productTitle: 'Pulse Rifle Replica',
            quantity: 1,
            unitPrice: 89.99,
            totalPrice: 89.99,
          },
        ],
      };

      const spy = jest.spyOn(shopifyApiService, 'createOrder').mockResolvedValue(mockShopifyResponse);

      const idempotencyKey = 'order-idemp-' + Date.now();
      const payload = {
        idempotencyKey,
        customer: {
          firstName: 'Ellen',
          lastName: 'Ripley',
          email: 'ellen.ripley@example.com',
        },
        lineItems: [
          {
            productTitle: 'Pulse Rifle Replica',
            quantity: 1,
            unitPrice: 89.99,
          },
        ],
      };

      // First submission
      const firstRes = await request(httpServer)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(payload)
        .expect(201);

      expect(firstRes.body.success).toBe(true);
      expect(firstRes.body.data.orderName).toBe('#1003');

      // Second submission with same idempotency key
      const secondRes = await request(httpServer)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(payload)
        .expect(201);

      // Should return the cached/completed order without calling Shopify twice
      expect(secondRes.body.success).toBe(true);
      expect(secondRes.body.data.id).toBe(firstRes.body.data.id);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('4. Error Handling & Shopify Failures', () => {
    it('Scenario 9: should handle Shopify API validation failure and create no local order', async () => {
      jest.spyOn(shopifyApiService, 'createOrder').mockRejectedValueOnce(
        new BadRequestException('Shopify API validation failed: Inventory not available')
      );

      const ordersCountBefore = await db.Order.count();

      const payload = {
        customer: {
          firstName: 'Luke',
          lastName: 'Skywalker',
          email: 'luke@rebel.org',
        },
        lineItems: [
          {
            productTitle: 'Lightsaber Blue',
            quantity: 1,
            unitPrice: 500.0,
          },
        ],
      };

      const response = await request(httpServer)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(payload)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Inventory not available');

      // Verify no local order was created
      const ordersCountAfter = await db.Order.count();
      expect(ordersCountAfter).toBe(ordersCountBefore);
    });

    it('Scenario 10: should handle Shopify network/gateway failure safely without creating local order', async () => {
      jest.spyOn(shopifyApiService, 'createOrder').mockRejectedValueOnce(
        new BadGatewayException('Shopify API network timeout or connection refused')
      );

      const ordersCountBefore = await db.Order.count();

      const payload = {
        customer: {
          firstName: 'Han',
          lastName: 'Solo',
          email: 'han@falcon.org',
        },
        lineItems: [
          {
            productTitle: 'Blaster Pistol',
            quantity: 1,
            unitPrice: 200.0,
          },
        ],
      };

      const response = await request(httpServer)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(payload)
        .expect(502);

      expect(response.body.success).toBe(false);

      const ordersCountAfter = await db.Order.count();
      expect(ordersCountAfter).toBe(ordersCountBefore);
    });

    it('Scenario 12: should rollback database transaction when local persistence fails', async () => {
      const mockShopifyResponse = {
        id: 'gid://shopify/Order/88009999',
        orderNumber: '9999',
        name: '#9999',
        email: 'marty.mcfly@hillvalley.org',
        currency: 'USD',
        totalAmount: 120.0,
        subtotalAmount: 120.0,
        financialStatus: 'paid',
        createdAt: new Date().toISOString(),
        customer: {
          id: 'gid://shopify/Customer/990099',
          firstName: 'Marty',
          lastName: 'McFly',
          email: 'marty.mcfly@hillvalley.org',
        },
        lineItems: [
          {
            productTitle: 'Hoverboard',
            quantity: 1,
            unitPrice: 120.0,
            totalPrice: 120.0,
          },
        ],
      };

      jest.spyOn(shopifyApiService, 'createOrder').mockResolvedValueOnce(mockShopifyResponse);

      // Force OrderItem bulkCreate to reject to simulate a database failure inside the transaction
      jest.spyOn(db.OrderItem, 'bulkCreate').mockRejectedValueOnce(new Error('Simulated DB constraint error'));

      const payload = {
        customer: {
          firstName: 'Marty',
          lastName: 'McFly',
          email: 'marty.mcfly@hillvalley.org',
        },
        lineItems: [
          {
            productTitle: 'Hoverboard',
            quantity: 1,
            unitPrice: 120.0,
          },
        ],
      };

      const response = await request(httpServer)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(payload)
        .expect(500);

      // Scenario 14: Recovery reporting if Shopify succeeded but DB persistence failed
      expect(response.body.message).toContain('Order created in Shopify, but local database persistence encountered an error');

      // Verify that the Order was rolled back and does not exist in DB
      const rolledBackOrder = await db.Order.findOne({
        where: { shopifyOrderId: 'gid://shopify/Order/88009999' },
      });
      expect(rolledBackOrder).toBeNull();
    });
  });

  describe('5. Read Operations: Customer, Product & Order Retrieval', () => {
    it('should list customers for selection (GET /api/v1/customers)', async () => {
      const response = await request(httpServer)
        .get('/api/v1/customers')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    it('should list products from local catalog or Shopify (GET /api/v1/products)', async () => {
      const response = await request(httpServer)
        .get('/api/v1/products')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    it('should retrieve single order details with customer and items (GET /api/v1/orders/:id)', async () => {
      const existingOrder = await db.Order.findOne({
        order: [['createdAt', 'DESC']],
      });

      if (existingOrder) {
        const response = await request(httpServer)
          .get(`/api/v1/orders/${existingOrder.id}`)
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(existingOrder.id);
        expect(response.body.data.customer).toBeDefined();
        expect(response.body.data.items).toBeDefined();
      }
    });

    it('should return 404 for non-existent order ID', async () => {
      const fakeUuid = '00000000-0000-0000-0000-000000000000';
      const response = await request(httpServer)
        .get(`/api/v1/orders/${fakeUuid}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });
});
