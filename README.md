# Mini Order Management CRM

A production-conscious Mini Order Management CRM built with a **Node.js NestJS** backend (CommonJS & pure JavaScript) and a **React.js** frontend (JSX & JavaScript), integrated with a **PostgreSQL** database via **Sequelize ORM** and integrated with the **Shopify Admin API**.

---

## 1. Project Overview

- **Phase 1: Project Setup, Architecture & Secure Authentication**
  - Modular monorepo architecture with pure JavaScript (`.js` CommonJS for NestJS, `.jsx` for React).
  - PostgreSQL persistence with Sequelize models, migrations, and seeders.
  - JWT access tokens (15m) + rotated, revocable refresh tokens (7d) stored with SHA-256 hashes in PostgreSQL and transmitted via `HttpOnly`, `SameSite` cookies.
  - Helmet headers, rate limiting (`express-rate-limit`), CORS, centralized exception filters, and request logging.
  - Dedicated health check endpoint: `GET /api/v1/health`.

- **Phase 2: Shopify Integration & Initial Order Import**
  - Official Shopify OAuth authorization flow with state nonce and SHA-256 HMAC signature verification.
  - Token security at rest: Shopify access tokens are encrypted with **AES-256-GCM** before database persistence.
  - Dedicated Shopify module supporting both **Shopify GraphQL Admin API** and **REST Admin API** with rate-limit retries.
  - Order synchronization pipeline:
    - Batched cursor-based pagination.
    - Synchronizes Customers, Products, Orders, and Line Items.
    - Idempotent: safe re-running without duplicate orders (upsert on `[shopifyStoreId, shopifyOrderId]`).
    - Robust transactional boundaries (`sequelize.transaction`) ensuring zero corrupted records on failure.
    - Live tracking and persistent audit via `ImportHistory` records.
  - Modern CRM integration UI at `/shopify` allowing administrators to connect, monitor status, disconnect, and trigger on-demand order synchronization with real-time statistics.

- **Phase 3: CRM Order Creation & Manual Order Placement**
  - Manual order creation workflow initiated directly from the CRM UI at `/orders/create`.
  - Customer selection: pick from existing saved CRM customers (with live auto-fill) or create new customers.
  - Dynamic line items: multi-product entry with product title, variant, SKU, positive quantity, unit price, and real-time calculated line totals.
  - Authoritative order totals and subtotal calculation on the backend to prevent client-side price tampering.
  - In-memory idempotency locking (`x-idempotency-key` and payload fingerprinting) to prevent duplicate submissions.
  - Order creation in Shopify using Shopify Admin REST API (`POST /orders.json`), treating Shopify as the authoritative source of truth.
  - Complete atomic PostgreSQL persistence across `customers`, `orders`, `order_items`, and `products` tables within `sequelize.transaction`.
  - Transactional rollback: if database persistence fails, all records roll back cleanly and recovery info is returned.
  - Rich order confirmation view displaying the Shopify order number (e.g. `#1002`), customer info, line items summary, and receipt details.

---

## 2. Technology Stack

### Backend
- **Framework:** NestJS (`@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`)
- **Language / Runtime:** Node.js (v20+ / v22+), Pure JavaScript (CommonJS)
- **Compiler / Transpiler:** Babel (`@babel/register`, `@babel/preset-env`, `@babel/plugin-proposal-decorators`) for ES decorator execution
- **Database:** PostgreSQL (v15+)
- **ORM:** Sequelize (v6) with `sequelize-cli` migrations & seeders
- **Security & Utilities:** `crypto` (AES-256-GCM), `bcryptjs`, `jsonwebtoken`, `@nestjs/passport`, `passport-jwt`, `helmet`, `cookie-parser`, `express-rate-limit`, `axios`

### Frontend
- **Framework:** React.js (v18)
- **Language:** JavaScript & JSX ONLY (no TypeScript / no TSX)
- **Routing:** React Router DOM (v6)
- **HTTP Client:** Axios with credentials, automatic refresh token rotation queue interceptor
- **Bundler:** Vite
- **Styling:** Custom CRM CSS design system (responsive, accessible, clean typography)

---

## 3. Project Structure

```text
shopify-order-crm/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.config.js       # Database environments
│   │   │   ├── jwt.config.js            # JWT secrets, lifetimes & cookie options
│   │   │   └── shopify.config.js        # Shopify API keys, version, scopes & redirect URI
│   │   ├── common/
│   │   │   ├── decorators/
│   │   │   │   ├── current-user.decorator.js # Parameter decorator for req.user
│   │   │   │   └── roles.decorator.js        # Role metadata decorator
│   │   │   ├── guards/
│   │   │   │   ├── jwt-auth.guard.js    # JWT authentication guard
│   │   │   │   └── roles.guard.js       # RBAC authorization guard
│   │   │   ├── filters/
│   │   │   │   └── http-exception.filter.js  # Centralized exception formatting
│   │   │   ├── interceptors/
│   │   │   │   └── logging.interceptor.js    # HTTP latency & status logger
│   │   │   ├── middleware/
│   │   │   │   └── logger.middleware.js      # Global request logger
│   │   │   └── utils/
│   │   │       ├── crypto.util.js       # AES-256-GCM token encryption & decryption
│   │   │       └── password.util.js     # Bcrypt hashing & verification
│   │   ├── database/
│   │   │   ├── models/
│   │   │   │   ├── user.model.js
│   │   │   │   ├── refresh-token.model.js
│   │   │   │   ├── shopify-store.model.js
│   │   │   │   ├── customer.model.js
│   │   │   │   ├── order.model.js
│   │   │   │   ├── order-item.model.js
│   │   │   │   ├── product.model.js
│   │   │   │   ├── import-history.model.js
│   │   │   │   └── index.js             # Model associations & Sequelize instance
│   │   │   ├── migrations/
│   │   │   │   ├── 20261126000001-create-users.js
│   │   │   │   ├── 20261126000002-create-refresh-tokens.js
│   │   │   │   ├── 20261126000003-create-shopify-stores.js
│   │   │   │   ├── 20261126000004-create-customers.js
│   │   │   │   ├── 20261126000005-create-orders.js
│   │   │   │   ├── 20261126000006-create-order-items.js
│   │   │   │   ├── 20261126000007-create-products.js
│   │   │   │   └── 20261126000008-create-import-history.js
│   │   │   ├── seeders/
│   │   │   │   └── 20261126000001-admin-user.js
│   │   │   ├── database.providers.js    # Sequelize dependency injection
│   │   │   └── database.module.js
│   │   ├── modules/
│   │   │   ├── auth/                    # Authentication module
│   │   │   ├── users/                   # Users module
│   │   │   ├── shopify/                 # Shopify integration module
│   │   │   │   ├── shopify.module.js
│   │   │   │   ├── shopify.controller.js
│   │   │   │   ├── shopify.service.js
│   │   │   │   ├── shopify-auth.service.js  # OAuth & HMAC validation
│   │   │   │   ├── shopify-api.service.js   # GraphQL & REST Admin API client (/orders.json)
│   │   │   │   └── shopify-order.service.js # Order import & transactional sync
│   │   │   ├── orders/                  # Orders module (Phase 3)
│   │   │   │   ├── orders.module.js
│   │   │   │   ├── orders.controller.js     # Order creation & listing
│   │   │   │   └── orders.service.js        # Shopify creation & transactional DB persistence
│   │   │   ├── customers/               # Customers module (Phase 3)
│   │   │   │   ├── customers.module.js
│   │   │   │   ├── customers.controller.js  # Customer search & retrieval
│   │   │   │   └── customers.service.js
│   │   │   └── products/                # Products module (Phase 3)
│   │   │       ├── products.module.js
│   │   │       ├── products.controller.js   # Catalog search & retrieval
│   │   │       └── products.service.js
│   │   ├── app.controller.js
│   │   ├── app.module.js
│   │   └── main.js
│   ├── test/
│   │   ├── auth.spec.js                 # Authentication e2e test suite (13 tests)
│   │   ├── shopify.spec.js              # Shopify integration & order import test suite (15 tests)
│   │   └── orders.spec.js               # CRM order creation & persistence test suite (17 tests)
│   ├── .babelrc
│   ├── .sequelizerc
│   ├── .env.example
│   ├── jest.config.js
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/
│   │   │   │   ├── Alert.jsx
│   │   │   │   ├── LoadingSpinner.jsx
│   │   │   │   └── Navbar.jsx
│   │   │   └── layout/
│   │   │       ├── AuthLayout.jsx
│   │   │       └── DashboardLayout.jsx
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   │   ├── Login.jsx
│   │   │   │   └── Register.jsx
│   │   │   ├── shopify/
│   │   │   │   └── ShopifyIntegration.jsx   # Store connection & order sync UI
│   │   │   ├── orders/
│   │   │   │   └── CreateOrder.jsx          # Manual CRM order placement & confirmation UI
│   │   │   └── Dashboard.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── hooks/
│   │   │   └── useAuth.js
│   │   ├── services/
│   │   │   └── api.js                       # Axios client with refresh interceptor
│   │   ├── routes/
│   │   │   └── AppRoutes.jsx
│   │   ├── styles/
│   │   │   └── main.css
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── vite.config.js
│   ├── .env.example
│   └── package.json
│
├── .gitignore
└── README.md
```

---

## 4. Prerequisites

- **Node.js**: `v20.x` or `v22.x`
- **npm**: `v10.x` or `v11.x`
- **PostgreSQL**: `v15+` running locally or in Docker

---

## 5. Environment Configuration

### Backend Configuration (`backend/.env`)

```env
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:5173

DB_HOST=127.0.0.1
DB_PORT=5433
DB_NAME=shopify_order_crm
DB_USER=postgres
DB_PASSWORD=1234

JWT_ACCESS_SECRET=super_secret_access_jwt_key_change_in_production_123456
JWT_REFRESH_SECRET=super_secret_refresh_jwt_key_change_in_production_123456
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

ADMIN_NAME=Super Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=Admin@Password123

# Shopify Integration Settings
SHOPIFY_API_KEY=your_shopify_client_id
SHOPIFY_API_SECRET=your_shopify_client_secret
SHOPIFY_API_VERSION=2024-01
SHOPIFY_APP_URL=http://localhost:5000
SHOPIFY_REDIRECT_URI=http://localhost:5000/api/v1/shopify/callback
SHOPIFY_SCOPES=read_orders,write_orders,read_customers,read_products
SHOPIFY_TOKEN_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

### Frontend Configuration (`frontend/.env`)

```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

---

## 6. Shopify Partner Dashboard & App Setup

To connect a live development Shopify store:

1. Log into your **Shopify Partner Dashboard** ([partners.shopify.com](https://partners.shopify.com)).
2. Navigate to **Apps** → **Create App** → **Create App Manually**.
3. In **App Setup**:
   - **App URL**: `http://localhost:5000` (or your public tunnel URL like Ngrok in local dev)
   - **Allowed redirection URL(s)**: `http://localhost:5000/api/v1/shopify/callback`
4. Under **Configuration** → **Admin API access scopes**, configure:
   - `read_orders`
   - `write_orders`
   - `read_customers`
   - `read_products`
5. Under **App Credentials**, copy:
   - **Client ID** → `SHOPIFY_API_KEY` in `backend/.env`
   - **Client Secret** → `SHOPIFY_API_SECRET` in `backend/.env`
6. Install the app on your Shopify Development store.

---

## 7. Installation & Database Setup

```bash
# 1. Install Backend Dependencies
cd backend
npm install

# 2. Run Database Migrations
npm run migrate

# 3. Seed Administrator Account
npm run seed

# 4. Install Frontend Dependencies
cd ../frontend
npm install
```

Default administrator credentials:
- **Email:** `admin@example.com`
- **Password:** `Admin@Password123`
- **Role:** `ADMIN`

---

## 8. Starting the Application

```bash
# Start Backend (port 5000)
cd backend
npm run start:dev

# Start Frontend (port 5173)
cd ../frontend
npm run dev
```

- CRM Dashboard: `http://localhost:5173`
- Shopify Integration UI: `http://localhost:5173/shopify`
- Create Order UI: `http://localhost:5173/orders/create`
- Backend API Base: `http://localhost:5000/api/v1`
- Health Check: `http://localhost:5000/api/v1/health`

---

## 9. API Endpoint Reference

All endpoints are prefixed with `/api/v1`.

### Authentication Endpoints
| Method | Endpoint | Protection | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Public | System status, version, and uptime |
| `POST` | `/auth/register` | Public (Rate Limited) | Register user account |
| `POST` | `/auth/login` | Public (Rate Limited) | Authenticate user; sets `HttpOnly` refresh cookie |
| `POST` | `/auth/refresh` | Cookie / Body | Rotates refresh token in DB and issues new tokens |
| `POST` | `/auth/logout` | Public | Revokes refresh token in DB and clears cookie |
| `GET` | `/auth/me` | JWT Bearer | Retrieves currently authenticated profile |
| `GET` | `/users/me` | JWT Bearer | Retrieves current user profile |
| `GET` | `/users` | JWT Bearer (`ADMIN`) | Paginated user list with search |

### Shopify Integration Endpoints
| Method | Endpoint | Protection | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/shopify/connect` | JWT Bearer (`ADMIN`) | Initiates OAuth flow; returns authorization URL and nonce |
| `GET` | `/shopify/callback` | Public (Shopify Redirect) | Validates state and HMAC, exchanges token, and redirects |
| `GET` | `/shopify/status` | JWT Bearer | Returns store connection status without exposing tokens |
| `DELETE` | `/shopify/disconnect` | JWT Bearer (`ADMIN`) | Disconnects the active Shopify store |
| `POST` | `/shopify/orders/import` | JWT Bearer (`ADMIN`) | Synchronizes orders, customers, and items in DB transactions |
| `GET` | `/shopify/orders/import/status` | JWT Bearer | Returns latest synchronization status and stats |
| `GET` | `/shopify/orders/import/history` | JWT Bearer | Returns historical synchronization records |

### Orders Endpoints (Phase 3)
| Method | Endpoint | Protection | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/orders` | JWT Bearer | Creates order in Shopify and persists to PostgreSQL (`x-idempotency-key` supported) |
| `GET` | `/orders/:id` | JWT Bearer | Retrieves single order details with customer and line items |
| `GET` | `/orders` | JWT Bearer | Paginated order listing with status and search filters |

### Customers Endpoints (Phase 3)
| Method | Endpoint | Protection | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/customers` | JWT Bearer | Paginated customer listing with search by email/name/phone |
| `GET` | `/customers/:id` | JWT Bearer | Retrieves single customer details with order history |

### Products Endpoints (Phase 3)
| Method | Endpoint | Protection | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/products` | JWT Bearer | Catalog lookup from database (with Shopify fallback) |
| `GET` | `/products/:id` | JWT Bearer | Retrieves single product details |

---

## 10. Automated Testing

To run the complete automated test suite across all implemented phases:

```bash
cd backend
npm test
```

### Test Coverage Summary:
- **`test/auth.spec.js`** (13 tests):
  - Health check endpoint verification
  - Login success, credential rejection, inactive account blocking
  - User registration, password strength enforcement, duplicate email rejection
  - Profile retrieval with Bearer token, unauthenticated/forged token blocking
  - Refresh token rotation, replay-attack invalidation, and session logout
- **`test/shopify.spec.js`** (15 tests):
  - Shopify connection initiation & domain normalization
  - Invalid store domain rejection (400 Bad Request)
  - OAuth state tampering detection and rejection
  - OAuth callback HMAC signature validation and forgery rejection
  - Successful token exchange, AES-256-GCM encryption at rest, and database persistence
  - Store connection status check without exposing access tokens
  - Shopify Admin API communication and order parsing
  - Full order import with customer and order-item persistence
  - Safe re-running with duplicate order prevention (upsert on existing records)
  - Customer synchronization and order-item foreign key verification
  - Shopify API failure handling (502 / 429 rate limit) without data corruption
  - Database transaction rollback on write error
  - Role-based authorization checks (rejecting unauthenticated & non-admin operations)
- **`test/orders.spec.js`** (17 tests):
  - Scenario 1 & 8: Successful Shopify order creation via `/orders.json` and PostgreSQL persistence with correct calculated totals
  - Scenario 2: Validation rejection on missing customer information (400 Bad Request)
  - Scenario 3: Validation rejection on invalid customer email format (400 Bad Request)
  - Scenario 4: Validation rejection on missing or empty line items array (400 Bad Request)
  - Scenario 5: Validation rejection on missing line item product title (400 Bad Request)
  - Scenario 6: Validation rejection on zero or negative item quantities (400 Bad Request)
  - Validation rejection on negative item unit prices (400 Bad Request)
  - Scenario 15: Unauthorized order creation rejection without JWT (401 Unauthorized)
  - Scenario 7 & 11: Multi-line item handling and direct DB persistence verification (`Order`, `OrderItem`, `Customer`, `Product`)
  - Scenario 13: Duplicate submission protection using idempotency keys and payload fingerprints
  - Scenario 9: Shopify API validation failure handling (no local records created)
  - Scenario 10: Shopify network/gateway failure handling (502 Bad Gateway without corruption)
  - Scenario 12: Database transaction rollback on persistence failure
  - Scenario 14: Safe recovery reporting if Shopify order succeeded but DB write failed
  - Customer selection listing (`GET /api/v1/customers`)
  - Product catalog listing (`GET /api/v1/products`)
  - Order details retrieval with customer & items associations (`GET /api/v1/orders/:id`)
  - Order 404 handler for non-existent order ID
- **Total:** `45 passed, 45 total` across 3 suites (100% passing).

---

## 11. Phase 3: CRM Order Creation Architecture & Flow

### Architecture Highlights:
1. **Shopify Source of Truth**: When an order is submitted, the backend contacts the connected Shopify store via `POST https://{shopDomain}/admin/api/{version}/orders.json`. A local database record is only committed after Shopify confirms successful order creation.
2. **Authoritative Price Calculation**: Backend recalculates line item totals and the aggregate order amount (`quantity * unitPrice`) regardless of client payload to prevent pricing manipulation.
3. **Double Submission Protection**: Supports client-supplied `x-idempotency-key` header and automated payload fingerprinting with SHA-256 in memory to reject rapid duplicate clicks.
4. **Atomic Transactions**: Local database writes (`Customer`, `Order`, `OrderItem`, `Product`) execute inside `sequelize.transaction(...)`. A failure at any point rolls back all table modifications.
5. **Safe Failure Recovery**: In the unlikely event that Shopify creates an order but local persistence fails, a descriptive 500 error is returned with `shopifyOrderId` and `shopifyOrderNumber` so the administrator can reconcile during the next sync.
6. **Frontend Experience**: Multi-section form (`/orders/create`) with dynamic line items, customer mode toggle (new vs. existing with search), instant subtotal updates, loading states, error alerts, and a full order confirmation view with direct action to create subsequent orders.
