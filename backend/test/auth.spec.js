require('reflect-metadata');
require('dotenv').config();

const request = require('supertest');
const { Test } = require('@nestjs/testing');
const cookieParser = require('cookie-parser');
const express = require('express');
const { AppModule } = require('../src/app.module');
const { HttpExceptionFilter } = require('../src/common/filters/http-exception.filter');
const { db } = require('../src/database/database.providers');

describe('Authentication API (e2e)', () => {
  let app;
  let httpServer;
  let adminAccessToken;
  let adminRefreshToken;
  const testStaffUser = {
    name: 'Staff Member',
    email: `staff_${Date.now()}@example.com`,
    password: 'Password@123',
  };

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
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('GET /api/v1/health', () => {
    it('should return health check status ok', async () => {
      const response = await request(httpServer)
        .get('/api/v1/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('service');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should log in successfully with valid admin credentials', async () => {
      const response = await request(httpServer)
        .post('/api/v1/auth/login')
        .send({
          email: process.env.ADMIN_EMAIL || 'admin@example.com',
          password: process.env.ADMIN_PASSWORD || 'Admin@Password123',
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data.user).toHaveProperty('email', process.env.ADMIN_EMAIL || 'admin@example.com');
      expect(response.body.data.user).toHaveProperty('role', 'ADMIN');
      expect(response.body.data.user).not.toHaveProperty('password');

      adminAccessToken = response.body.data.accessToken;

      // Check HttpOnly refresh token cookie
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const refreshCookie = cookies.find((c) => c.startsWith('refresh_token='));
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('HttpOnly');

      adminRefreshToken = refreshCookie.split(';')[0].split('=')[1];
    });

    it('should reject login with invalid password', async () => {
      const response = await request(httpServer)
        .post('/api/v1/auth/login')
        .send({
          email: process.env.ADMIN_EMAIL || 'admin@example.com',
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Invalid email or password');
    });

    it('should reject login for non-existent user', async () => {
      const response = await request(httpServer)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Password123!',
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Invalid email or password');
    });
  });

  describe('POST /api/v1/auth/register', () => {
    it('should successfully register a new user', async () => {
      const response = await request(httpServer)
        .post('/api/v1/auth/register')
        .send(testStaffUser)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.user).toHaveProperty('email', testStaffUser.email.toLowerCase());
      expect(response.body.data.user).toHaveProperty('name', testStaffUser.name);
      expect(response.body.data.user).toHaveProperty('role', 'STAFF');
      expect(response.body.data.user).not.toHaveProperty('password');
      expect(response.body.data).toHaveProperty('accessToken');
    });

    it('should reject registration with duplicate email', async () => {
      const response = await request(httpServer)
        .post('/api/v1/auth/register')
        .send(testStaffUser)
        .expect(409);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('already exists');
    });

    it('should reject registration with weak password (missing special char or too short)', async () => {
      const response = await request(httpServer)
        .post('/api/v1/auth/register')
        .send({
          name: 'Weak Pass',
          email: 'weakpass@example.com',
          password: 'weak',
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('at least 8 characters');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return profile for authenticated user with Bearer token', async () => {
      const response = await request(httpServer)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('email', process.env.ADMIN_EMAIL || 'admin@example.com');
      expect(response.body.data).not.toHaveProperty('password');
    });

    it('should reject request without authentication token', async () => {
      const response = await request(httpServer)
        .get('/api/v1/auth/me')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should reject request with forged/invalid token', async () => {
      const response = await request(httpServer)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer forged.invalid.token')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should rotate tokens when provided valid refresh token in cookie', async () => {
      const response = await request(httpServer)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`refresh_token=${adminRefreshToken}`])
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data.accessToken).not.toEqual(adminAccessToken);

      // Verify new refresh token cookie was set
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const newRefreshCookie = cookies.find((c) => c.startsWith('refresh_token='));
      expect(newRefreshCookie).toBeDefined();
    });

    it('should reject refresh when previous refresh token is reused (rotation invalidation)', async () => {
      // Re-using the old adminRefreshToken which was just rotated
      const response = await request(httpServer)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`refresh_token=${adminRefreshToken}`])
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('revoked or is invalid');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should successfully log out and clear cookie', async () => {
      // First log in to get a fresh refresh token
      const loginRes = await request(httpServer)
        .post('/api/v1/auth/login')
        .send({
          email: process.env.ADMIN_EMAIL || 'admin@example.com',
          password: process.env.ADMIN_PASSWORD || 'Admin@Password123',
        })
        .expect(200);

      const cookies = loginRes.headers['set-cookie'];
      const refreshCookie = cookies.find((c) => c.startsWith('refresh_token='));
      const token = refreshCookie.split(';')[0].split('=')[1];

      const response = await request(httpServer)
        .post('/api/v1/auth/logout')
        .set('Cookie', [`refresh_token=${token}`])
        .expect(200);

      expect(response.body).toHaveProperty('success', true);

      // Verify refresh cookie cleared
      const logoutCookies = response.headers['set-cookie'];
      expect(logoutCookies).toBeDefined();
      const clearedCookie = logoutCookies.find((c) => c.startsWith('refresh_token='));
      expect(clearedCookie).toContain('Max-Age=0');
    });
  });
});
