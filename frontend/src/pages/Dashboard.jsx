import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ordersApi } from '../services/api';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Alert } from '../components/common/Alert';

export const Dashboard = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const fetchMetrics = async () => {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await ordersApi.getDashboardMetrics();
        setMetrics(response.data);
      } catch (err) {
        setErrorMessage(
          err.response?.data?.message || err.message || 'Failed to load dashboard metrics'
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  const getFinancialBadgeStyle = (status) => {
    const s = (status || '').toLowerCase();
    switch (s) {
      case 'paid':
        return { backgroundColor: '#dcfce7', color: '#15803d' };
      case 'pending':
        return { backgroundColor: '#fef3c7', color: '#b45309' };
      case 'refunded':
        return { backgroundColor: '#fee2e2', color: '#b91c1c' };
      default:
        return { backgroundColor: '#f1f5f9', color: '#475569' };
    }
  };

  return (
    <DashboardLayout>
      <div className="welcome-banner">
        <h2>Welcome back, {user?.name || 'CRM User'}! 👋</h2>
        <p>
          You are currently signed in as an authenticated <strong>{user?.role}</strong> on Mini Order Management CRM.
        </p>
      </div>

      <div className="dashboard-header" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1>CRM Business Dashboard</h1>
            <p>Real-time order synchronization, Shopify store status, and revenue analytics.</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Link to="/orders/create" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              New Order
            </Link>
            <Link to="/shopify" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
              Sync Shopify
            </Link>
          </div>
        </div>
      </div>

      <Alert type="error" message={errorMessage} />

      {isLoading ? (
        <div className="stat-card" style={{ padding: '60px', textAlign: 'center' }}>
          <LoadingSpinner primary />
          <p style={{ marginTop: '12px', color: '#64748b' }}>Aggregating CRM metrics from PostgreSQL...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Top Stat Cards */}
          <div className="grid-cards" style={{ marginBottom: 0 }}>
            {/* Total Revenue */}
            <div className="stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="stat-card-title">Total Sales Revenue</div>
                <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: '#ecfdf5', color: '#059669' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="1" x2="12" y2="23"/>
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                  </svg>
                </div>
              </div>
              <div className="stat-card-value" style={{ color: '#047857' }}>
                ${(metrics?.totalRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="stat-card-desc">Gross order amount across all stores</div>
            </div>

            {/* Total Orders */}
            <div className="stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="stat-card-title">Total Orders</div>
                <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: '#eef2ff', color: '#4f46e5' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="8" cy="21" r="1"/>
                    <circle cx="19" cy="21" r="1"/>
                    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
                  </svg>
                </div>
              </div>
              <div className="stat-card-value">{metrics?.totalOrders || 0}</div>
              <div className="stat-card-desc">
                {metrics?.statusCounts?.paid || 0} paid • {metrics?.statusCounts?.pending || 0} pending
              </div>
            </div>

            {/* Total Customers */}
            <div className="stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="stat-card-title">Active Customers</div>
                <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: '#f0f9ff', color: '#0284c7' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
              </div>
              <div className="stat-card-value">{metrics?.totalCustomers || 0}</div>
              <div className="stat-card-desc">Synced from Shopify & CRM entries</div>
            </div>

            {/* Shopify Store Connection */}
            <div className="stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="stat-card-title">Connected Store</div>
                <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: metrics?.activeStore ? '#ecfdf5' : '#fee2e2', color: metrics?.activeStore ? '#15803d' : '#b91c1c' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>
                    <path d="M3 6h18"/>
                    <path d="M16 10a4 4 0 0 1-8 0"/>
                  </svg>
                </div>
              </div>
              <div className="stat-card-value" style={{ fontSize: '1.25rem', wordBreak: 'break-all' }}>
                {metrics?.activeStore ? (
                  <span style={{ color: '#15803d' }}>● Connected</span>
                ) : (
                  <span style={{ color: '#b91c1c' }}>○ Disconnected</span>
                )}
              </div>
              <div className="stat-card-desc">
                {metrics?.activeStore?.shopDomain || 'No active Shopify store connected'}
              </div>
            </div>
          </div>

          {/* Recent Orders Section */}
          <div className="stat-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Recent Orders</h3>
                <p style={{ fontSize: '0.825rem', color: '#64748b', marginTop: '2px' }}>
                  Latest orders imported or created directly in CRM
                </p>
              </div>
              <Link to="/orders" className="btn-secondary" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
                View All Orders →
              </Link>
            </div>

            {(!metrics?.recentOrders || metrics.recentOrders.length === 0) ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No orders recorded yet.</p>
                <Link to="/orders/create" className="btn-primary" style={{ marginTop: '12px', display: 'inline-block' }}>
                  Create First Order
                </Link>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600 }}>
                      <th style={{ padding: '12px 20px' }}>Order</th>
                      <th style={{ padding: '12px 20px' }}>Date</th>
                      <th style={{ padding: '12px 20px' }}>Customer</th>
                      <th style={{ padding: '12px 20px' }}>Total Amount</th>
                      <th style={{ padding: '12px 20px' }}>Payment</th>
                      <th style={{ padding: '12px 20px', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.recentOrders.map((order) => {
                      const customerName = order.customer
                        ? `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() || order.customer.email
                        : 'Guest Customer';

                      return (
                        <tr key={order.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '14px 20px' }}>
                            <Link to={`/orders/${order.id}`} style={{ fontWeight: 700, color: '#4f46e5' }}>
                              {order.orderName || `#${order.shopifyOrderNumber}`}
                            </Link>
                          </td>
                          <td style={{ padding: '14px 20px', color: '#64748b' }}>
                            {new Date(order.orderDate || order.createdAt).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '14px 20px' }}>
                            <div style={{ fontWeight: 600, color: '#1e293b' }}>{customerName}</div>
                            {order.customer?.email && (
                              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{order.customer.email}</div>
                            )}
                          </td>
                          <td style={{ padding: '14px 20px', fontWeight: 700, color: '#0f172a' }}>
                            ${parseFloat(order.totalAmount || 0).toFixed(2)} {order.currency || 'USD'}
                          </td>
                          <td style={{ padding: '14px 20px' }}>
                            <span
                              className="role-pill"
                              style={{
                                ...getFinancialBadgeStyle(order.financialStatus),
                                fontSize: '0.75rem',
                                padding: '3px 8px',
                              }}
                            >
                              {order.financialStatus || 'paid'}
                            </span>
                          </td>
                          <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                            <Link
                              to={`/orders/${order.id}`}
                              className="btn-secondary"
                              style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                            >
                              Details
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
