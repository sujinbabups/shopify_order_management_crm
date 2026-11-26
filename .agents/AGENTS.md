# AGENTS.md — Project Development Rules

## 1. Project Overview

Build a Mini Order Management CRM integrated with Shopify.

Core features:
- Secure user authentication.
- Shopify store integration.
- Order importing and synchronization.
- Order listing, searching, filtering, and sorting.
- Order details.
- CRM-based order creation.
- Shopify webhook processing.
- Reliable database persistence.

**The original interview assignment is the primary source of functional requirements.**

## 2. Mandatory Technology Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + NestJS |
| Backend Language | JavaScript (CommonJS) |
| Frontend | React.js + Vite |
| Frontend Language | JavaScript + JSX |
| Database | PostgreSQL |
| ORM | Sequelize |
| Authentication | JWT + bcrypt |

Additional requirements:
- Use REST API architecture.
- Use React Router and Axios.
- Use Sequelize migrations and seeders.
- Do not use TypeScript, TSX, Prisma, or TypeORM.
- Do not replace the specified technologies without approval.
- Configure NestJS properly to support JavaScript without TypeScript.

## 3. Project Architecture

Use a standard monorepo structure:

```text
shopify-order-crm/
├── backend/
│   └── src/
│       ├── config/
│       ├── common/
│       ├── database/
│       │   ├── models/
│       │   ├── migrations/
│       │   └── seeders/
│       ├── modules/
│       │   ├── auth/
│       │   ├── users/
│       │   ├── customers/
│       │   ├── orders/
│       │   ├── order-items/
│       │   ├── products/
│       │   ├── shopify/
│       │   └── webhooks/
│       ├── app.module.js
│       └── main.js
│
├── frontend/
│   └── src/
│       ├── assets/
│       ├── components/
│       ├── pages/
│       ├── layouts/
│       ├── hooks/
│       ├── services/
│       ├── context/
│       ├── routes/
│       ├── utils/
│       ├── App.jsx
│       └── main.jsx
│
├── docs/
├── README.md
├── AGENTS.md
├── .gitignore
└── package.json
```

Maintain modular architecture and clear separation of responsibilities.

## 4. Backend Rules

1. Use NestJS modules for feature organization.
2. Follow dependency injection principles.
3. Keep controllers thin and business logic inside services.
4. Use JavaScript exclusively.
5. Use Sequelize models and migrations.
6. Keep database operations out of controllers.
7. Use centralized exception handling.
8. Follow REST conventions and appropriate HTTP status codes.
9. Use async/await consistently.
10. Validate incoming requests.
11. Avoid duplicated business logic.
12. Use NestJS guards for authentication and authorization.

## 5. Frontend Rules

1. Use React functional components and JSX.
2. Create reusable components.
3. Separate API calls from UI components.
4. Use centralized Axios configuration.
5. Implement protected routes.
6. Use reusable forms and validation.
7. Handle loading, error, and empty states.
8. Avoid unnecessary prop drilling.
9. Maintain consistent styling and naming conventions.
10. Keep components small and maintainable.

## 6. Database Rules

Use PostgreSQL with Sequelize.

Required entities:
- Users
- Customers
- Orders
- OrderItems
- Products
- ShopifyStores
- WebhookEvents
- RefreshTokens

Requirements:
- Use UUID primary keys where appropriate.
- Define proper foreign key relationships.
- Add indexes for frequently queried fields.
- Enforce unique Shopify identifiers.
- Use appropriate decimal types for monetary values.
- Use database transactions for related operations.
- Prevent duplicate Shopify orders.
- Support future multi-store architecture.
- Use migrations for schema changes.
- Never use destructive synchronization in production.

## 7. Authentication and Security

Security is mandatory.

- Hash passwords using bcrypt.
- Never store plaintext passwords.
- Use short-lived JWT access tokens.
- Implement refresh-token rotation and revocation.
- Store refresh tokens as hashes in PostgreSQL.
- Use HTTP-only, Secure, SameSite cookies where appropriate.
- Implement NestJS authentication guards.
- Validate all incoming data.
- Configure CORS explicitly.
- Use Helmet and rate limiting.
- Implement CSRF protection where required.
- Never expose secrets or credentials to the frontend.
- Use environment variables for sensitive configuration.
- Implement role-based authorization where required.

## 8. Shopify Integration

- Use Shopify Admin API.
- Keep credentials exclusively on the backend.
- Implement the appropriate Shopify authentication flow.
- Request only necessary API scopes.
- Store relevant Shopify identifiers.
- Implement order import and synchronization.
- Support CRM-to-Shopify order creation.
- Handle API errors, network failures, and rate limits.
- Prevent duplicate order creation.
- Document Shopify configuration and required scopes.

## 9. Webhook Requirements

- Subscribe to order creation and update events.
- Verify Shopify HMAC signatures using raw request bodies.
- Reject invalid webhook signatures.
- Implement idempotent event processing.
- Track processed events in PostgreSQL.
- Handle duplicate deliveries safely.
- Acknowledge webhook requests appropriately.
- Log processing failures.
- Implement a recovery strategy.

Never trust an incoming webhook without signature verification.

## 10. API and Coding Standards

- Use consistent REST endpoint naming.
- Implement server-side pagination, searching, filtering, and sorting.
- Validate request bodies and query parameters.
- Return consistent API response structures.
- Never expose passwords, tokens, or internal stack traces.
- Follow DRY and SOLID principles where appropriate.
- Use meaningful names and modular code.
- Avoid unnecessary abstractions and dependencies.
- Remove unused imports and dead code.
- Handle errors explicitly.

## 11. Cursor Development Instructions

Before modifying code:
1. Inspect the existing project structure.
2. Understand the current implementation.
3. Identify relevant files and dependencies.
4. Reuse existing components and services.
5. Plan changes before implementation.

When implementing features:
1. Implement backend changes.
2. Implement frontend changes when required.
3. Update database models and migrations when necessary.
4. Add validation and error handling.
5. Add or update tests.
6. Run relevant tests and verify existing functionality.

Important:
- Never rewrite the entire application for a small change.
- Never silently change the technology stack.
- Do not duplicate existing modules or components.
- Do not remove working functionality.
- Ask for clarification when requirements are ambiguous.
- Never claim implementation is complete without verification.
- Do not leave critical functionality as TODO placeholders.

## 12. Testing Requirements

Prioritize testing:

- Authentication and authorization.
- Order creation and importing.
- Shopify synchronization.
- Webhook HMAC verification.
- Duplicate webhook handling.
- Search, filtering, and pagination.
- Request validation.
- Error handling.

Run relevant tests after every significant implementation.

## 13. Environment and Documentation

Maintain `.env.example` files.

Backend configuration should document:

- NODE_ENV
- PORT
- DATABASE_URL
- JWT_ACCESS_SECRET
- JWT_REFRESH_SECRET
- SHOPIFY_API_KEY
- SHOPIFY_API_SECRET
- SHOPIFY_STORE_DOMAIN
- SHOPIFY_ACCESS_TOKEN
- SHOPIFY_API_VERSION
- FRONTEND_URL

Never commit actual environment files or credentials.

Maintain README documentation covering:
- Project overview and architecture.
- Technology stack and folder structure.
- Installation and setup.
- Environment variables.
- Database migrations and seeders.
- Shopify configuration and API scopes.
- API endpoints.
- Testing.
- Deployment instructions.

Target deployment: Render, Railway, or another suitable provider.

## 14. Development Priority

Always prioritize:

1. Security.
2. Correctness.
3. Data consistency.
4. Reliability.
5. Maintainability.
6. Performance.
7. User experience.

Follow the original interview assignment strictly. Avoid unnecessary features.

**Final goal:** Build a secure, maintainable, fully functional Shopify Order Management CRM that can be confidently demonstrated and explained during the technical interview.