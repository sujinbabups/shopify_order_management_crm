require('reflect-metadata');
require('dotenv').config();

const { NestFactory } = require('@nestjs/core');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { AppModule } = require('./app.module');
const { HttpExceptionFilter } = require('./common/filters/http-exception.filter');
const { LoggingInterceptor } = require('./common/interceptors/logging.interceptor');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security Headers via Helmet
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false,
    })
  );

  // Cookie Parser
  app.use(cookieParser());

  // JSON Body Parser with size limits and raw body preservation for HMAC verification
  app.use(
    express.json({
      limit: '10mb',
      verify: (req, res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // CORS Configuration
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const allowedOrigins = [
    frontendUrl,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    'http://localhost:5175',
    'http://127.0.0.1:5175',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl) or any localhost port during development
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'x-idempotency-key',
      'x-shopify-hmac-sha256',
      'x-shopify-shop-domain',
      'x-shopify-topic',
      'x-shopify-webhook-id',
      'x-shopify-order-id',
    ],
  });

  // Global API Prefix
  app.setGlobalPrefix('api/v1');

  // Global Exception Filter and Interceptors
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Rate Limiting for Auth routes
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      statusCode: 429,
      message: 'Too many requests from this IP, please try again after 15 minutes',
    },
  });
  app.use('/api/v1/auth', authLimiter);

  const port = process.env.PORT || 5000;
  await app.listen(port);
  console.log(`Server is running on: http://localhost:${port}/api/v1`);
  console.log(`Health check: http://localhost:${port}/api/v1/health`);
}

bootstrap().catch((err) => {
  console.error('Fatal error during application bootstrap:', err);
  process.exit(1);
});
