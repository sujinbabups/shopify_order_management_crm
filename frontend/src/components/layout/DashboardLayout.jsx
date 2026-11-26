import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Navbar } from '../common/Navbar';

export const DashboardLayout = ({ children }) => {
  const location = useLocation();

  return (
    <div className="dashboard-container">
      <Navbar />
      <div className="main-body">
        <aside className="sidebar">
          <div className="sidebar-title">CRM Navigation</div>
          <Link
            to="/dashboard"
            className={`nav-item ${location.pathname === '/dashboard' ? 'active' : ''}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="7" height="9" x="3" y="3" rx="1"/>
              <rect width="7" height="5" x="14" y="3" rx="1"/>
              <rect width="7" height="9" x="14" y="12" rx="1"/>
              <rect width="7" height="5" x="3" y="16" rx="1"/>
            </svg>
            Dashboard
          </Link>
          <Link
            to="/shopify"
            className={`nav-item ${location.pathname === '/shopify' ? 'active' : ''}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            Shopify Store
          </Link>
          <div className="nav-item disabled" title="Coming in Phase 3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="8" cy="21" r="1"/>
              <circle cx="19" cy="21" r="1"/>
              <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
            </svg>
            Orders
            <span className="badge-soon">Phase 3</span>
          </div>
          <div className="nav-item disabled" title="Coming in Phase 3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            Customers
            <span className="badge-soon">Phase 3</span>
          </div>
        </aside>
        <main className="content-area">{children}</main>
      </div>
    </div>
  );
};
