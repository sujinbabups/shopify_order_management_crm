import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ordersApi } from '../../services/api';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Alert } from '../../components/common/Alert';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export const OrderDetail = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const fetchOrderDetail = async () => {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await ordersApi.getById(id);
        setOrder(response.data);
      } catch (err) {
        setErrorMessage(
          err.response?.data?.message || err.message || 'Failed to retrieve order details'
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrderDetail();
  }, [id]);

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

  const getFulfillmentBadgeStyle = (status) => {
    const s = (status || '').toLowerCase();
    switch (s) {
      case 'fulfilled':
        return { backgroundColor: '#dcfce7', color: '#15803d' };
      case 'partial':
        return { backgroundColor: '#fef3c7', color: '#b45309' };
      default:
        return { backgroundColor: '#f1f5f9', color: '#64748b' };
    }
  };

  return (
    <DashboardLayout>
      <div style={{ marginBottom: '20px' }}>
        <Link
          to="/orders"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', color: '#64748b', textDecoration: 'none', fontWeight: 600 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back to Orders List
        </Link>
      </div>

      <Alert type="error" message={errorMessage} />

      {isLoading ? (
        <div className="stat-card" style={{ padding: '60px', textAlign: 'center' }}>
          <LoadingSpinner primary />
          <p style={{ marginTop: '12px', color: '#64748b' }}>Loading order details from database...</p>
        </div>
      ) : !order ? (
        <div className="stat-card" style={{ padding: '40px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.25rem', color: '#0f172a' }}>Order Not Found</h2>
          <p style={{ color: '#64748b', marginTop: '8px' }}>The requested order could not be located in PostgreSQL.</p>
          <Link to="/orders" className="btn-secondary" style={{ marginTop: '16px', display: 'inline-block' }}>
            Return to Orders
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Header Card */}
          <div className="stat-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>
                    {order.orderName || `#${order.shopifyOrderNumber}`}
                  </h1>
                  <span
                    className="role-pill"
                    style={{ ...getFinancialBadgeStyle(order.financialStatus), fontSize: '0.8rem', padding: '4px 10px' }}
                  >
                    {order.financialStatus || 'PAID'}
                  </span>
                  <span
                    className="role-pill"
                    style={{ ...getFulfillmentBadgeStyle(order.fulfillmentStatus), fontSize: '0.8rem', padding: '4px 10px' }}
                  >
                    {order.fulfillmentStatus || 'UNFULFILLED'}
                  </span>
                </div>
                <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '6px' }}>
                  Placed on {new Date(order.orderDate || order.createdAt).toLocaleString()} • CRM Order UUID: <code style={{ fontSize: '0.8rem' }}>{order.id}</code>
                </p>
              </div>

              <div>
                <Link to="/orders/create" className="btn-secondary" style={{ padding: '8px 14px', fontSize: '0.875rem' }}>
                  + Create Another Order
                </Link>
              </div>
            </div>
          </div>

          {/* 3-Column Info Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {/* Customer Details */}
            <div className="stat-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>Customer Information</h3>
              </div>
              {order.customer ? (
                <div style={{ fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Name:</span>{' '}
                    <strong style={{ color: '#1e293b' }}>
                      {`${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() || '—'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Email:</span>{' '}
                    <a href={`mailto:${order.customer.email}`} style={{ color: '#4f46e5', fontWeight: 600 }}>
                      {order.customer.email}
                    </a>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Phone:</span>{' '}
                    <span style={{ color: '#1e293b' }}>{order.customer.phone || 'None provided'}</span>
                  </div>
                  {order.customer.shopifyCustomerId && (
                    <div style={{ marginTop: '4px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                      <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Shopify Customer ID:</span>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#475569', wordBreak: 'break-all' }}>
                        {order.customer.shopifyCustomerId}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>No customer details associated with this order.</p>
              )}
            </div>

            {/* Shopify Store Info */}
            <div className="stat-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>Shopify Synchronization</h3>
              </div>
              <div style={{ fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div>
                  <span style={{ color: '#64748b' }}>Store Domain:</span>{' '}
                  <strong style={{ color: '#0f172a' }}>{order.store?.shopDomain || 'Active Connected Store'}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Order Number:</span>{' '}
                  <strong style={{ color: '#1e293b' }}>#{order.shopifyOrderNumber || '—'}</strong>
                </div>
                {order.shopifyOrderId && (
                  <div>
                    <span style={{ color: '#64748b' }}>Shopify Order ID:</span>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#475569', marginTop: '2px', wordBreak: 'break-all' }}>
                      {order.shopifyOrderId}
                    </div>
                  </div>
                )}
                <div style={{ marginTop: '4px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#15803d', fontWeight: 600, fontSize: '0.8rem' }}>
                    ● Synchronized with Shopify Admin API
                  </span>
                </div>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="stat-card" style={{ padding: '20px', backgroundColor: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
                  <line x1="12" y1="1" x2="12" y2="23"/>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>Payment & Total</h3>
              </div>
              <div style={{ fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                  <span>Currency:</span>
                  <strong style={{ color: '#1e293b' }}>{order.currency || 'USD'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                  <span>Items Total:</span>
                  <strong style={{ color: '#1e293b' }}>
                    ${parseFloat(order.totalAmount || 0).toFixed(2)}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #e2e8f0', paddingTop: '10px', fontSize: '1.1rem' }}>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>Grand Total:</span>
                  <span style={{ fontWeight: 800, color: '#15803d' }}>
                    ${parseFloat(order.totalAmount || 0).toFixed(2)} {order.currency || 'USD'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="stat-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                Line Items ({(order.items || []).length})
              </h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600 }}>
                    <th style={{ padding: '12px 20px' }}>Product & Variant</th>
                    <th style={{ padding: '12px 20px' }}>SKU</th>
                    <th style={{ padding: '12px 20px', textAlign: 'right' }}>Unit Price</th>
                    <th style={{ padding: '12px 20px', textAlign: 'center' }}>Quantity</th>
                    <th style={{ padding: '12px 20px', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.items || []).map((item, idx) => (
                    <tr key={item.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontWeight: 700, color: '#1e293b' }}>
                          {item.productTitle || 'Product'}
                        </div>
                        {item.variantTitle && (
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                            Variant: {item.variantTitle}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '14px 20px', color: '#64748b', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        {item.sku || '—'}
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'right', color: '#334155' }}>
                        ${parseFloat(item.unitPrice || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 600 }}>
                        {item.quantity}
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                        ${parseFloat(item.totalPrice || item.quantity * item.unitPrice || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
