import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ordersApi } from '../../services/api';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Alert } from '../../components/common/Alert';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export const OrdersList = () => {
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [financialStatus, setFinancialStatus] = useState('all');
  const [fulfillmentStatus, setFulfillmentStatus] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await ordersApi.list({
        search: searchTerm.trim(),
        financialStatus: financialStatus !== 'all' ? financialStatus : '',
        fulfillmentStatus: fulfillmentStatus !== 'all' ? fulfillmentStatus : '',
        startDate: startDate || '',
        endDate: endDate || '',
        sortBy,
        page: currentPage,
        limit: 10,
      });

      setOrders(response.data || []);
      if (response.pagination) {
        setPagination(response.pagination);
      }
    } catch (err) {
      setErrorMessage(
        err.response?.data?.message || err.message || 'Failed to load orders from CRM'
      );
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, financialStatus, fulfillmentStatus, startDate, endDate, sortBy, currentPage]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchOrders();
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setFinancialStatus('all');
    setFulfillmentStatus('all');
    setStartDate('');
    setEndDate('');
    setSortBy('date_desc');
    setCurrentPage(1);
  };

  const getFinancialBadgeStyle = (status) => {
    const s = (status || '').toLowerCase();
    switch (s) {
      case 'paid':
        return { backgroundColor: '#dcfce7', color: '#15803d' };
      case 'pending':
        return { backgroundColor: '#fef3c7', color: '#b45309' };
      case 'refunded':
        return { backgroundColor: '#fee2e2', color: '#b91c1c' };
      case 'partially_paid':
      case 'partially_refunded':
        return { backgroundColor: '#e0e7ff', color: '#3730a3' };
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
      case 'unfulfilled':
      case '':
      case 'null':
        return { backgroundColor: '#f1f5f9', color: '#64748b' };
      default:
        return { backgroundColor: '#f1f5f9', color: '#475569' };
    }
  };

  return (
    <DashboardLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>Order Management</h1>
          <p style={{ color: '#64748b', marginTop: '4px' }}>
            Browse, search, filter, and inspect Shopify and CRM-created orders.
          </p>
        </div>
        <div>
          <Link to="/orders/create" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Create New Order
          </Link>
        </div>
      </div>

      <Alert type="error" message={errorMessage} />

      {/* Filter and Search Bar Card */}
      <div className="stat-card" style={{ marginBottom: '24px', padding: '20px' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 260px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
              Search Orders
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search by order #, customer name, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '36px' }}
              />
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#94a3b8"
                strokeWidth="2"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
              >
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
          </div>

          <div style={{ width: '170px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
              Financial Status
            </label>
            <select
              className="form-input"
              value={financialStatus}
              onChange={(e) => {
                setFinancialStatus(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">All Financial</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="refunded">Refunded</option>
              <option value="partially_paid">Partially Paid</option>
            </select>
          </div>

          <div style={{ width: '170px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
              Fulfillment Status
            </label>
            <select
              className="form-input"
              value={fulfillmentStatus}
              onChange={(e) => {
                setFulfillmentStatus(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">All Fulfillment</option>
              <option value="fulfilled">Fulfilled</option>
              <option value="unfulfilled">Unfulfilled</option>
              <option value="partial">Partial</option>
            </select>
          </div>

          <div style={{ width: '160px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
              Start Date
            </label>
            <input
              type="date"
              className="form-input"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div style={{ width: '160px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
              End Date
            </label>
            <input
              type="date"
              className="form-input"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div style={{ width: '180px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
              Sort By
            </label>
            <select
              className="form-input"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="date_desc">Date (Newest first)</option>
              <option value="date_asc">Date (Oldest first)</option>
              <option value="total_desc">Total (Highest first)</option>
              <option value="total_asc">Total (Lowest first)</option>
              <option value="name_asc">Order # (A-Z)</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" className="btn-primary" style={{ padding: '9px 16px', height: '42px' }}>
              Search
            </button>
            {(searchTerm || financialStatus !== 'all' || fulfillmentStatus !== 'all' || startDate || endDate || sortBy !== 'date_desc') && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="btn-secondary"
                style={{ padding: '9px 14px', height: '42px' }}
              >
                Reset
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Orders Table Card */}
      <div className="stat-card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <LoadingSpinner primary />
            <p style={{ marginTop: '12px', color: '#64748b' }}>Loading orders from PostgreSQL...</p>
          </div>
        ) : orders.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#f1f5f9', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                <circle cx="8" cy="21" r="1"/>
                <circle cx="19" cy="21" r="1"/>
                <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
              </svg>
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>No orders found</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto 20px auto' }}>
              {searchTerm || financialStatus !== 'all' || fulfillmentStatus !== 'all'
                ? 'No orders match your current search and filter criteria. Try resetting filters.'
                : 'No orders have been recorded in the CRM yet. You can create your first order or sync with Shopify.'}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              {(searchTerm || financialStatus !== 'all' || fulfillmentStatus !== 'all') ? (
                <button onClick={handleResetFilters} className="btn-secondary">
                  Reset All Filters
                </button>
              ) : (
                <Link to="/orders/create" className="btn-primary">
                  Create First Order
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600 }}>
                    <th style={{ padding: '12px 16px' }}>Order</th>
                    <th style={{ padding: '12px 16px' }}>Date</th>
                    <th style={{ padding: '12px 16px' }}>Customer</th>
                    <th style={{ padding: '12px 16px' }}>Items</th>
                    <th style={{ padding: '12px 16px' }}>Total Amount</th>
                    <th style={{ padding: '12px 16px' }}>Payment</th>
                    <th style={{ padding: '12px 16px' }}>Fulfillment</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const customerName = order.customer
                      ? `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() || order.customer.email
                      : 'Guest Customer';
                    const itemsCount = (order.items || []).reduce((sum, item) => sum + (item.quantity || 1), 0);

                    return (
                      <tr key={order.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s' }}>
                        <td style={{ padding: '14px 16px' }}>
                          <Link
                            to={`/orders/${order.id}`}
                            style={{ fontWeight: 700, color: '#4f46e5', textDecoration: 'none' }}
                          >
                            {order.orderName || `#${order.shopifyOrderNumber}`}
                          </Link>
                          {order.shopifyOrderNumber && (
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                              #{order.shopifyOrderNumber}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#475569', whiteSpace: 'nowrap' }}>
                          {new Date(order.orderDate || order.createdAt).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>{customerName}</div>
                          {order.customer?.email && (
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{order.customer.email}</div>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#475569' }}>
                          <span style={{ fontWeight: 600 }}>{itemsCount}</span> {itemsCount === 1 ? 'item' : 'items'}
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                          ${parseFloat(order.totalAmount || 0).toFixed(2)} <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{order.currency || 'USD'}</span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
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
                        <td style={{ padding: '14px 16px' }}>
                          <span
                            className="role-pill"
                            style={{
                              ...getFulfillmentBadgeStyle(order.fulfillmentStatus),
                              fontSize: '0.75rem',
                              padding: '3px 8px',
                            }}
                          >
                            {order.fulfillmentStatus || 'unfulfilled'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <Link
                            to={`/orders/${order.id}`}
                            className="btn-secondary"
                            style={{ padding: '5px 10px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                          >
                            View Details →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  Showing page <strong style={{ color: '#0f172a' }}>{pagination.page}</strong> of <strong style={{ color: '#0f172a' }}>{pagination.totalPages}</strong> ({pagination.total} total orders)
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                    disabled={currentPage >= pagination.totalPages}
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};
