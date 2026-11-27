require('reflect-metadata');
require('dotenv').config();

const request = require('supertest');
const { Test } = require('@nestjs/testing');
const cookieParser = require('cookie-parser');
const express = require('express');
const crypto = require('crypto');
const { AppModule } = require('../src/app.module');
const { HttpExceptionFilter } = require('../src/common/filters/http-exception.filter');
const { db } = require('../src/database/database.providers');
const { ShopifyApiService } = require('../src/modules/shopify/shopify-api.service');

describe('Shopify Webhook Integration & Real-Time Synchronization (e2e)', () => {
  let app;
  let httpServer;
  let adminAccessToken;
  let shopifyApiService;
  let testStore;

  const testShopDomain = 'webhook-sync-store.myshopify.com';
  const shopifySecret = process.env.SHOPIFY_API_SECRET || 'test_shopify_webhook_secret_key_123';

  function generateHmac(payloadString) {
    return crypto
      .createHmac('sha256', shopifySecret)
      .update(Buffer.from(payloadString, 'utf8'))
      .digest('base64');
  }

  beforeAll(async () => {
    process.env.SHOPIFY_API_SECRET = shopifySecret;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.use(
      express.json({
        limit: '10mb',
        verify: (req, res, buf) => {
          req.rawBody = buf;
        },
      })
    );
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();
    httpServer = app.getHttpServer();

    shopifyApiService = app.get(ShopifyApiService);

    // Clean up tables before testing
    await db.WebhookEvent.destroy({ where: {}, truncate: true, cascade: true });
    await db.OrderItem.destroy({ where: {}, truncate: true, cascade: true });
    await db.Order.destroy({ where: {}, truncate: true, cascade: true });
    await db.Customer.destroy({ where: {}, truncate: true, cascade: true });
    await db.Product.destroy({ where: {}, truncate: true, cascade: true });
    await db.ImportHistory.destroy({ where: {}, truncate: true, cascade: true });
    await db.ShopifyStore.destroy({ where: {}, truncate: true, cascade: true });

    // Seed active Shopify store
    testStore = await db.ShopifyStore.create({
      shopDomain: testShopDomain,
      shopifyShopId: 'gid://shopify/Shop/11223344',
      accessToken: 'shpat_mock_webhook_token_12345',
      scopes: 'read_orders,write_orders,read_customers,read_products',
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

  describe('1. Webhook Security & Signature Verification', () => {
    it('Scenario 1: should accept webhook with valid HMAC signature and active store (200 OK)', async () => {
      const payload = {
        id: 770001,
        admin_graphql_api_id: 'gid://shopify/Order/770001',
        name: '#TEST-7001',
        order_number: 7001,
        financial_status: 'paid',
        total_price: '50.00',
        currency: 'USD',
        customer: {
          id: 55001,
          first_name: 'Valid',
          last_name: 'Signer',
          email: 'signer@example.com',
        },
        line_items: [
          {
            id: 11001,
            title: 'Security Verified Item',
            quantity: 1,
            price: '50.00',
          },
        ],
      };

      const rawBody = JSON.stringify(payload);
      const hmac = generateHmac(rawBody);
      const deliveryId = 'wh-delivery-001-' + Date.now();

      const response = await request(httpServer)
        .post('/api/v1/webhooks/shopify')
        .set('Content-Type', 'application/json')
        .set('x-shopify-hmac-sha256', hmac)
        .set('x-shopify-shop-domain', testShopDomain)
        .set('x-shopify-topic', 'orders/create')
        .set('x-shopify-webhook-id', deliveryId)
        .send(rawBody)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('eventId');
    });

    it('Scenario 2: should reject webhook with invalid HMAC signature (401 Unauthorized)', async () => {
      const payload = { id: 770002, name: '#INVALID' };
      const rawBody = JSON.stringify(payload);
      const forgedHmac = 'forged_fake_invalid_signature_hmac_12345=';

      const response = await request(httpServer)
        .post('/api/v1/webhooks/shopify')
        .set('Content-Type', 'application/json')
        .set('x-shopify-hmac-sha256', forgedHmac)
        .set('x-shopify-shop-domain', testShopDomain)
        .set('x-shopify-topic', 'orders/create')
        .set('x-shopify-webhook-id', 'wh-forged-002')
        .send(rawBody)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid Shopify webhook HMAC signature');
    });

    it('Scenario 3: should reject webhook with missing signature header (400 Bad Request)', async () => {
      const payload = { id: 770003, name: '#NO-SIG' };
      const rawBody = JSON.stringify(payload);

      const response = await request(httpServer)
        .post('/api/v1/webhooks/shopify')
        .set('Content-Type', 'application/json')
        .set('x-shopify-shop-domain', testShopDomain)
        .set('x-shopify-topic', 'orders/create')
        .set('x-shopify-webhook-id', 'wh-no-sig-003')
        .send(rawBody)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Missing or invalid Shopify webhook HMAC signature');
    });

    it('Scenario 8: should reject webhook from unknown/unconnected Shopify store (400 Bad Request)', async () => {
      const payload = { id: 770004, name: '#UNKNOWN-SHOP' };
      const rawBody = JSON.stringify(payload);
      const hmac = generateHmac(rawBody);

      const response = await request(httpServer)
        .post('/api/v1/webhooks/shopify')
        .set('Content-Type', 'application/json')
        .set('x-shopify-hmac-sha256', hmac)
        .set('x-shopify-shop-domain', 'stranger-unconnected-store.myshopify.com')
        .set('x-shopify-topic', 'orders/create')
        .set('x-shopify-webhook-id', 'wh-unknown-004')
        .send(rawBody)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('is not connected or inactive');
    });
  });

  describe('2. Order Synchronization (orders/create & orders/updated)', () => {
    it('Scenario 4 & 14: should synchronize order, customer, line items, and product on orders/create', async () => {
      const payload = {
        id: 88001,
        admin_graphql_api_id: 'gid://shopify/Order/88001',
        name: '#2001',
        order_number: 2001,
        financial_status: 'paid',
        fulfillment_status: null,
        total_price: '210.00',
        currency: 'USD',
        created_at: new Date().toISOString(),
        customer: {
          id: 99001,
          admin_graphql_api_id: 'gid://shopify/Customer/99001',
          first_name: 'Natasha',
          last_name: 'Romanoff',
          email: 'natasha@avengers.org',
          phone: '+15557778888',
        },
        line_items: [
          {
            id: 33001,
            admin_graphql_api_id: 'gid://shopify/LineItem/33001',
            title: 'Widow Gauntlets',
            variant_title: 'Electric Blue',
            sku: 'WIDOW-GAUNTLET-BLU',
            quantity: 2,
            price: '80.00',
            product_id: 44001,
          },
          {
            id: 33002,
            admin_graphql_api_id: 'gid://shopify/LineItem/33002',
            title: 'Grappling Hook Cable',
            variant_title: 'Standard',
            sku: 'GRAPPLE-CABLE-10M',
            quantity: 1,
            price: '50.00',
            product_id: 44002,
          },
        ],
      };

      const rawBody = JSON.stringify(payload);
      const hmac = generateHmac(rawBody);
      const deliveryId = 'wh-create-' + Date.now();

      const response = await request(httpServer)
        .post('/api/v1/webhooks/shopify')
        .set('Content-Type', 'application/json')
        .set('x-shopify-hmac-sha256', hmac)
        .set('x-shopify-shop-domain', testShopDomain)
        .set('x-shopify-topic', 'orders/create')
        .set('x-shopify-webhook-id', deliveryId)
        .send(rawBody)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify PostgreSQL Persistence across all tables (Scenario 14)
      const dbOrder = await db.Order.findOne({
        where: { shopifyOrderId: 'gid://shopify/Order/88001' },
        include: [
          { model: db.Customer, as: 'customer' },
          { model: db.OrderItem, as: 'items' },
        ],
      });

      expect(dbOrder).not.toBeNull();
      expect(dbOrder.orderName).toBe('#2001');
      expect(parseFloat(dbOrder.totalAmount)).toBe(210.0);
      expect(dbOrder.financialStatus).toBe('paid');
      expect(dbOrder.customer.email).toBe('natasha@avengers.org');
      expect(dbOrder.customer.firstName).toBe('Natasha');
      expect(dbOrder.customer.shopifyCustomerId).toBe('gid://shopify/Customer/99001');
      expect(dbOrder.items).toHaveLength(2);

      // Product auto-registration
      const product1 = await db.Product.findOne({ where: { title: 'Widow Gauntlets' } });
      expect(product1).not.toBeNull();
      expect(product1.sku).toBe('WIDOW-GAUNTLET-BLU');

      // WebhookEvent record check
      const event = await db.WebhookEvent.findOne({ where: { shopifyWebhookId: deliveryId } });
      expect(event).not.toBeNull();
      expect(event.status).toBe('PROCESSED');
      expect(event.processedAt).not.toBeNull();
    });

    it('Scenario 5: should update order financial & fulfillment status and line items on orders/updated', async () => {
      // Send orders/updated for the order created in the previous test
      const updatedPayload = {
        id: 88001,
        admin_graphql_api_id: 'gid://shopify/Order/88001',
        name: '#2001',
        order_number: 2001,
        financial_status: 'refunded',
        fulfillment_status: 'fulfilled',
        total_price: '210.00',
        currency: 'USD',
        customer: {
          id: 99001,
          admin_graphql_api_id: 'gid://shopify/Customer/99001',
          first_name: 'Natasha',
          last_name: 'Romanoff-Banner',
          email: 'natasha@avengers.org',
          phone: '+15557779999',
        },
        line_items: [
          {
            id: 33001,
            admin_graphql_api_id: 'gid://shopify/LineItem/33001',
            title: 'Widow Gauntlets',
            variant_title: 'Electric Blue',
            sku: 'WIDOW-GAUNTLET-BLU',
            quantity: 2,
            price: '80.00',
          },
        ],
      };

      const rawBody = JSON.stringify(updatedPayload);
      const hmac = generateHmac(rawBody);
      const deliveryId = 'wh-update-' + Date.now();

      const response = await request(httpServer)
        .post('/api/v1/webhooks/shopify')
        .set('Content-Type', 'application/json')
        .set('x-shopify-hmac-sha256', hmac)
        .set('x-shopify-shop-domain', testShopDomain)
        .set('x-shopify-topic', 'orders/updated')
        .set('x-shopify-webhook-id', deliveryId)
        .send(rawBody)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify updated fields in DB
      const updatedOrder = await db.Order.findOne({
        where: { shopifyOrderId: 'gid://shopify/Order/88001' },
        include: [
          { model: db.Customer, as: 'customer' },
          { model: db.OrderItem, as: 'items' },
        ],
      });

      expect(updatedOrder.financialStatus).toBe('refunded');
      expect(updatedOrder.fulfillmentStatus).toBe('fulfilled');
      expect(updatedOrder.customer.lastName).toBe('Romanoff-Banner');
      expect(updatedOrder.items).toHaveLength(1); // Updated line items reflected
    });
  });

  describe('3. Deduplication, Idempotency & Concurrency', () => {
    it('Scenario 6: should detect duplicate webhook delivery and acknowledge idempotently', async () => {
      const payload = {
        id: 88002,
        admin_graphql_api_id: 'gid://shopify/Order/88002',
        name: '#2002',
        financial_status: 'paid',
        total_price: '40.00',
        currency: 'USD',
        customer: { email: 'dup@example.com', first_name: 'Dup' },
        line_items: [{ title: 'Deduplicated Item', quantity: 1, price: '40.00' }],
      };

      const rawBody = JSON.stringify(payload);
      const hmac = generateHmac(rawBody);
      const deliveryId = 'wh-idempotent-test-' + Date.now();

      // First delivery
      const firstRes = await request(httpServer)
        .post('/api/v1/webhooks/shopify')
        .set('Content-Type', 'application/json')
        .set('x-shopify-hmac-sha256', hmac)
        .set('x-shopify-shop-domain', testShopDomain)
        .set('x-shopify-topic', 'orders/create')
        .set('x-shopify-webhook-id', deliveryId)
        .send(rawBody)
        .expect(200);

      expect(firstRes.body.success).toBe(true);

      const ordersCountAfterFirst = await db.Order.count({
        where: { shopifyOrderId: 'gid://shopify/Order/88002' },
      });
      expect(ordersCountAfterFirst).toBe(1);

      // Duplicate delivery with identical webhook delivery ID
      const secondRes = await request(httpServer)
        .post('/api/v1/webhooks/shopify')
        .set('Content-Type', 'application/json')
        .set('x-shopify-hmac-sha256', hmac)
        .set('x-shopify-shop-domain', testShopDomain)
        .set('x-shopify-topic', 'orders/create')
        .set('x-shopify-webhook-id', deliveryId)
        .send(rawBody)
        .expect(200);

      expect(secondRes.body.success).toBe(true);
      expect(secondRes.body.message).toContain('Duplicate webhook already processed');

      // Database order count must remain 1
      const ordersCountAfterSecond = await db.Order.count({
        where: { shopifyOrderId: 'gid://shopify/Order/88002' },
      });
      expect(ordersCountAfterSecond).toBe(1);
    });

    it('Scenario 7: should safely handle concurrent duplicate deliveries without corruption', async () => {
      const payload = {
        id: 88003,
        admin_graphql_api_id: 'gid://shopify/Order/88003',
        name: '#2003',
        financial_status: 'paid',
        total_price: '75.00',
        currency: 'USD',
        customer: { email: 'concurrent@example.com', first_name: 'Concurrent' },
        line_items: [{ title: 'Concurrent Item', quantity: 1, price: '75.00' }],
      };

      const rawBody = JSON.stringify(payload);
      const hmac = generateHmac(rawBody);
      const deliveryId = 'wh-concurrent-' + Date.now();

      // Launch both requests simultaneously
      const [res1, res2] = await Promise.all([
        request(httpServer)
          .post('/api/v1/webhooks/shopify')
          .set('Content-Type', 'application/json')
          .set('x-shopify-hmac-sha256', hmac)
          .set('x-shopify-shop-domain', testShopDomain)
          .set('x-shopify-topic', 'orders/create')
          .set('x-shopify-webhook-id', deliveryId)
          .send(rawBody),
        request(httpServer)
          .post('/api/v1/webhooks/shopify')
          .set('Content-Type', 'application/json')
          .set('x-shopify-hmac-sha256', hmac)
          .set('x-shopify-shop-domain', testShopDomain)
          .set('x-shopify-topic', 'orders/create')
          .set('x-shopify-webhook-id', deliveryId)
          .send(rawBody),
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      // Verify only 1 order exists in database
      const count = await db.Order.count({
        where: { shopifyOrderId: 'gid://shopify/Order/88003' },
      });
      expect(count).toBe(1);
    });
  });

  describe('4. Error Handling, Rollback & Recovery', () => {
    it('Scenario 9: should reject invalid or malformed payload (400 Bad Request)', async () => {
      const payload = { missing_order_id: true };
      const rawBody = JSON.stringify(payload);
      const hmac = generateHmac(rawBody);
      const deliveryId = 'wh-invalid-payload-' + Date.now();

      const response = await request(httpServer)
        .post('/api/v1/webhooks/shopify')
        .set('Content-Type', 'application/json')
        .set('x-shopify-hmac-sha256', hmac)
        .set('x-shopify-shop-domain', testShopDomain)
        .set('x-shopify-topic', 'orders/create')
        .set('x-shopify-webhook-id', deliveryId)
        .send(rawBody)
        .expect(400);

      expect(response.body.success).toBe(false);

      // Check that event was recorded as FAILED
      const event = await db.WebhookEvent.findOne({
        where: { shopifyWebhookId: deliveryId },
      });
      expect(event).not.toBeNull();
      expect(event.status).toBe('FAILED');
      expect(event.errorMessage).toBeDefined();
    });

    it('Scenario 10 & 11: should rollback database transaction on persistence failure and record FAILED status', async () => {
      const payload = {
        id: 88005,
        admin_graphql_api_id: 'gid://shopify/Order/88005',
        name: '#2005-FAIL',
        financial_status: 'paid',
        total_price: '99.00',
        currency: 'USD',
        customer: { email: 'fail.test@example.com', first_name: 'Fail' },
        line_items: [{ title: 'Failing Item', quantity: 1, price: '99.00' }],
      };

      const rawBody = JSON.stringify(payload);
      const hmac = generateHmac(rawBody);
      const deliveryId = 'wh-rollback-' + Date.now();

      // Simulate database failure during transaction
      jest.spyOn(db.OrderItem, 'bulkCreate').mockRejectedValueOnce(
        new Error('Simulated DB constraint error during webhook sync')
      );

      const response = await request(httpServer)
        .post('/api/v1/webhooks/shopify')
        .set('Content-Type', 'application/json')
        .set('x-shopify-hmac-sha256', hmac)
        .set('x-shopify-shop-domain', testShopDomain)
        .set('x-shopify-topic', 'orders/create')
        .set('x-shopify-webhook-id', deliveryId)
        .send(rawBody)
        .expect(500);

      expect(response.body.success).toBe(false);

      // Verify transaction rollback: Order should not exist in database
      const rolledBackOrder = await db.Order.findOne({
        where: { shopifyOrderId: 'gid://shopify/Order/88005' },
      });
      expect(rolledBackOrder).toBeNull();

      // Verify WebhookEvent recorded the failure
      const event = await db.WebhookEvent.findOne({
        where: { shopifyWebhookId: deliveryId },
      });
      expect(event).not.toBeNull();
      expect(event.status).toBe('FAILED');
      expect(event.errorMessage).toContain('Simulated DB constraint error');
    });

    it('Scenario 12 & 13: should successfully recover and retry a failed webhook event via retry endpoint', async () => {
      // Find the failed event created in Scenario 10
      const failedEvent = await db.WebhookEvent.findOne({
        where: { status: 'FAILED' },
        order: [['createdAt', 'DESC']],
      });

      expect(failedEvent).not.toBeNull();
      const initialAttempts = failedEvent.attempts;

      // Call manual retry endpoint
      const retryResponse = await request(httpServer)
        .post(`/api/v1/webhooks/retry/${failedEvent.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(retryResponse.body.success).toBe(true);
      expect(retryResponse.body.message).toContain('retried and processed successfully');

      // Verify event transitioned to PROCESSED
      const updatedEvent = await db.WebhookEvent.findByPk(failedEvent.id);
      expect(updatedEvent.status).toBe('PROCESSED');
      expect(updatedEvent.attempts).toBe(initialAttempts + 1);
      expect(updatedEvent.errorMessage).toBeNull();

      // Verify order was created on retry
      const createdOrder = await db.Order.findOne({
        where: { shopifyOrderId: failedEvent.shopifyOrderId },
      });
      expect(createdOrder).not.toBeNull();
    });
  });

  describe('5. Webhook Management & Registration Endpoints', () => {
    it('should retrieve webhook status summary (GET /api/v1/webhooks/status)', async () => {
      const response = await request(httpServer)
        .get('/api/v1/webhooks/status')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('processed');
      expect(response.body.data).toHaveProperty('failed');
      expect(response.body.data).toHaveProperty('pending');
    });

    it('should retrieve paginated webhook events (GET /api/v1/webhooks/events)', async () => {
      const response = await request(httpServer)
        .get('/api/v1/webhooks/events?page=1&limit=5')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    it('should register webhook subscriptions on Shopify (POST /api/v1/shopify/webhooks/register)', async () => {
      jest.spyOn(shopifyApiService, 'registerWebhook').mockResolvedValue({
        id: 998811,
        topic: 'orders/create',
        address: 'http://localhost:5000/api/v1/webhooks/shopify',
      });

      const response = await request(httpServer)
        .post('/api/v1/shopify/webhooks/register')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].topic).toBe('orders/create');
      expect(response.body.data[1].topic).toBe('orders/updated');
    });

    it('should list registered webhooks from Shopify (GET /api/v1/shopify/webhooks)', async () => {
      jest.spyOn(shopifyApiService, 'fetchWebhooks').mockResolvedValue([
        { id: 998811, topic: 'orders/create', address: 'http://localhost:5000/api/v1/webhooks/shopify' },
        { id: 998822, topic: 'orders/updated', address: 'http://localhost:5000/api/v1/webhooks/shopify' },
      ]);

      const response = await request(httpServer)
        .get('/api/v1/shopify/webhooks')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });
  });
});
