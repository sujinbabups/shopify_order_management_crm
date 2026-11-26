import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { DashboardLayout } from '../components/layout/DashboardLayout';

export const Dashboard = () => {
  const { user } = useAuth();

  return (
    <DashboardLayout>
      <div className="welcome-banner">
        <h2>Welcome back, {user?.name || 'CRM User'}! 👋</h2>
        <p>
          You are currently signed in as an authenticated <strong>{user?.role}</strong> on Mini Order Management CRM.
        </p>
      </div>

      <div className="dashboard-header">
        <h1>CRM System Overview</h1>
        <p>Phase 1 Foundation: Secure Authentication & Architecture</p>
      </div>

      <div className="grid-cards">
        <div className="stat-card">
          <div className="stat-card-title">Authentication State</div>
          <div className="stat-card-value">Active</div>
          <div className="stat-card-desc">JWT Access + Rotated HttpOnly Refresh Tokens</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-title">Account Role</div>
          <div className="stat-card-value">{user?.role || 'STAFF'}</div>
          <div className="stat-card-desc">Email: {user?.email}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-title">Database Persistence</div>
          <div className="stat-card-value">PostgreSQL</div>
          <div className="stat-card-desc">Sequelize ORM with strict migrations</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-title">Shopify Integration</div>
          <div className="stat-card-value" style={{ color: '#64748b' }}>Phase 2</div>
          <div className="stat-card-desc">Order synchronization, search & webhooks</div>
        </div>
      </div>

      <div className="stat-card" style={{ marginTop: '24px' }}>
        <h3 style={{ fontSize: '1.05rem', marginBottom: '8px', color: '#1e293b' }}>
          Phase 1 System Architecture Summary
        </h3>
        <ul style={{ paddingLeft: '20px', color: '#475569', fontSize: '0.9rem', lineHeight: '1.8' }}>
          <li>
            <strong>Pure JavaScript NestJS Backend:</strong> CommonJS modules, Babel decorator compilation, central error handling, Helmet security headers, rate limiting, and CORS.
          </li>
          <li>
            <strong>Sequelize PostgreSQL Layer:</strong> Managed migrations for Users and RefreshTokens with cascade references, unique indexes, and automated seeding.
          </li>
          <li>
            <strong>Token Security:</strong> Short-lived access tokens (15m) in memory, rotated refresh tokens (7d) stored securely with SHA-256 hashes in DB and HttpOnly SameSite cookies.
          </li>
          <li>
            <strong>React JSX Frontend:</strong> Vite-powered single-page application with Axios request/response interceptors for automatic transparent token refresh and session invalidation handling.
          </li>
        </ul>
      </div>
    </DashboardLayout>
  );
};
