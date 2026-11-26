import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { ordersApi, customersApi, productsApi } from '../../services/api';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Alert } from '../../components/common/Alert';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export const CreateOrder = () => {
  const { user } = useAuth();

  // Mode: 'new' or 'existing'
  const [customerMode, setCustomerMode] = useState('new');
  const [existingCustomers, setExistingCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [availableProducts, setAvailableProducts] = useState([]);

  // Customer state
  const [customer, setCustomer] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });

  // Line items state
  const [lineItems, setLineItems] = useState([
    {
      productTitle: '',
      sku: '',
      quantity: 1,
      unitPrice: 10.0,
      productId: null,
    },
  ]);

  // Order settings
  const [financialStatus, setFinancialStatus] = useState('paid');
  const [currency, setCurrency] = useState('USD');
  const [note, setNote] = useState('');

  // UI status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [createdOrder, setCreatedOrder] = useState(null);

  // Load existing customers and products on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [custRes, prodRes] = await Promise.all([
          customersApi.list({ limit: 50 }),
          productsApi.list({ limit: 50 }),
        ]);
        setExistingCustomers(custRes.data || []);
        setAvailableProducts(prodRes.data || []);
      } catch (err) {
        console.warn('Could not preload customers or products:', err.message);
      }
    };

    loadInitialData();
  }, []);

  // Handle existing customer selection
  const handleSelectCustomer = (e) => {
    const custId = e.target.value;
    setSelectedCustomerId(custId);
    if (custId) {
      const selected = existingCustomers.find((c) => c.id === custId);
      if (selected) {
        setCustomer({
          firstName: selected.firstName || '',
          lastName: selected.lastName || '',
          email: selected.email || '',
          phone: selected.phone || '',
        });
      }
    }
  };

  // Line item handlers
  const handleAddLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        productTitle: '',
        sku: '',
        quantity: 1,
        unitPrice: 0.0,
        productId: null,
      },
    ]);
  };

  const handleRemoveLineItem = (index) => {
    if (lineItems.length <= 1) {
      setErrorMessage('Order must have at least one line item');
      return;
    }
    const updated = lineItems.filter((_, i) => i !== index);
    setLineItems(updated);
  };

  const handleLineItemChange = (index, field, value) => {
    const updated = [...lineItems];
    updated[index][field] = value;

    // If selecting an existing product
    if (field === 'productSelect') {
      const prod = availableProducts.find((p) => p.id === value);
      if (prod) {
        updated[index].productTitle = prod.title;
        updated[index].sku = prod.sku || '';
        updated[index].productId = prod.id;
      }
    }

    setLineItems(updated);
  };

  // Calculations
  const subtotal = lineItems.reduce((sum, item) => {
    const qty = parseInt(item.quantity, 10) || 0;
    const price = parseFloat(item.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

  const totalAmount = parseFloat(subtotal.toFixed(2));

  // Client validation
  const validateForm = () => {
    const errors = {};

    if (customerMode === 'new') {
      if (!customer.firstName.trim()) {
        errors.firstName = 'First name is required';
      }
      if (!customer.email.trim()) {
        errors.email = 'Email address is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim())) {
        errors.email = 'Invalid email address';
      }
    } else {
      if (!selectedCustomerId) {
        errors.customer = 'Please select a customer';
      }
    }

    if (lineItems.length === 0) {
      errors.lineItems = 'At least one line item is required';
    }

    lineItems.forEach((item, idx) => {
      if (!item.productTitle.trim()) {
        errors[`itemTitle_${idx}`] = 'Product title is required';
      }
      const qty = parseInt(item.quantity, 10);
      if (isNaN(qty) || qty <= 0) {
        errors[`itemQty_${idx}`] = 'Quantity must be ≥ 1';
      }
      const price = parseFloat(item.unitPrice);
      if (isNaN(price) || price < 0) {
        errors[`itemPrice_${idx}`] = 'Price must be ≥ 0';
      }
    });

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit order to Shopify & CRM
  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!validateForm()) {
      setErrorMessage('Please review and correct the errors below');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        customerId: customerMode === 'existing' ? selectedCustomerId : null,
        customer:
          customerMode === 'new'
            ? {
                firstName: customer.firstName.trim(),
                lastName: customer.lastName.trim(),
                email: customer.email.trim(),
                phone: customer.phone.trim() || null,
              }
            : customer,
        lineItems: lineItems.map((item) => ({
          productTitle: item.productTitle.trim(),
          sku: item.sku ? item.sku.trim() : null,
          quantity: parseInt(item.quantity, 10),
          unitPrice: parseFloat(parseFloat(item.unitPrice).toFixed(2)),
          productId: item.productId,
        })),
        financialStatus,
        currency,
        note: note.trim() || undefined,
      };

      const response = await ordersApi.create(payload);
      setCreatedOrder(response.data);
    } catch (err) {
      const msg =
        err.response?.data?.message || err.message || 'Failed to create order in Shopify';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setCreatedOrder(null);
    setCustomer({ firstName: '', lastName: '', email: '', phone: '' });
    setSelectedCustomerId('');
    setLineItems([
      {
        productTitle: '',
        sku: '',
        quantity: 1,
        unitPrice: 10.0,
        productId: null,
      },
    ]);
    setErrorMessage('');
    setFieldErrors({});
  };

  return (
    <DashboardLayout>
      <div className="dashboard-header">
        <h1>Create Order</h1>
        <p>Manually create and place a new customer order directly into Shopify and synchronize in CRM.</p>
      </div>

      <Alert type="error" message={errorMessage} />

      {/* Confirmation View */}
      {createdOrder ? (
        <div className="stat-card" style={{ maxWidth: '800px', margin: '0 auto', borderTop: '4px solid #10b981' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '50%', background: '#dcfce7', color: '#15803d', marginBottom: '12px' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
              Order Created Successfully!
            </h2>
            <p style={{ color: '#64748b', marginTop: '6px' }}>
              Shopify Order <strong>{createdOrder.orderName}</strong> (ID: {createdOrder.shopifyOrderId}) has been placed and persisted in PostgreSQL.
            </p>
          </div>

          <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Shopify Order</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>{createdOrder.orderName}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Financial Status</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#047857', marginTop: '4px', textTransform: 'uppercase' }}>
                  {createdOrder.financialStatus}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Customer</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1e293b', marginTop: '4px' }}>
                  {createdOrder.customer?.firstName} {createdOrder.customer?.lastName}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{createdOrder.customer?.email}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Total Amount</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#4f46e5', marginTop: '4px' }}>
                  {createdOrder.currency} ${parseFloat(createdOrder.totalAmount).toFixed(2)}
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Line Items:</h4>
              <ul style={{ paddingLeft: '20px', fontSize: '0.875rem', color: '#475569' }}>
                {(createdOrder.items || []).map((item) => (
                  <li key={item.id} style={{ marginBottom: '4px' }}>
                    <strong>{item.productTitle}</strong> × {item.quantity} — ${parseFloat(item.totalPrice).toFixed(2)}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button onClick={handleResetForm} className="btn-primary" style={{ width: 'auto' }}>
              Create Another Order
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmitOrder} noValidate>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
            {/* Left Column: Customer & Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Section A: Customer Info */}
              <div className="stat-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                    1. Customer Information
                  </h2>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '0.85rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="customerMode"
                        checked={customerMode === 'new'}
                        onChange={() => setCustomerMode('new')}
                      />
                      New Customer
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="customerMode"
                        checked={customerMode === 'existing'}
                        onChange={() => setCustomerMode('existing')}
                      />
                      Existing Customer
                    </label>
                  </div>
                </div>

                {customerMode === 'existing' ? (
                  <div className="form-group">
                    <label htmlFor="selectCustomer">Select Saved Customer</label>
                    <select
                      id="selectCustomer"
                      className={`form-input ${fieldErrors.customer ? 'error' : ''}`}
                      value={selectedCustomerId}
                      onChange={handleSelectCustomer}
                      disabled={isSubmitting}
                    >
                      <option value="">-- Choose Customer ({existingCustomers.length} available) --</option>
                      {existingCustomers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.firstName} {c.lastName} ({c.email})
                        </option>
                      ))}
                    </select>
                    {fieldErrors.customer && <div className="field-error">{fieldErrors.customer}</div>}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                      <label htmlFor="firstName">First Name *</label>
                      <input
                        id="firstName"
                        type="text"
                        className={`form-input ${fieldErrors.firstName ? 'error' : ''}`}
                        placeholder="Sarah"
                        value={customer.firstName}
                        onChange={(e) => setCustomer({ ...customer, firstName: e.target.value })}
                        disabled={isSubmitting}
                      />
                      {fieldErrors.firstName && <div className="field-error">{fieldErrors.firstName}</div>}
                    </div>

                    <div className="form-group">
                      <label htmlFor="lastName">Last Name</label>
                      <input
                        id="lastName"
                        type="text"
                        className="form-input"
                        placeholder="Connor"
                        value={customer.lastName}
                        onChange={(e) => setCustomer({ ...customer, lastName: e.target.value })}
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="email">Email Address *</label>
                      <input
                        id="email"
                        type="email"
                        className={`form-input ${fieldErrors.email ? 'error' : ''}`}
                        placeholder="sarah@example.com"
                        value={customer.email}
                        onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                        disabled={isSubmitting}
                      />
                      {fieldErrors.email && <div className="field-error">{fieldErrors.email}</div>}
                    </div>

                    <div className="form-group">
                      <label htmlFor="phone">Phone Number</label>
                      <input
                        id="phone"
                        type="tel"
                        className="form-input"
                        placeholder="+1 555-0199"
                        value={customer.phone}
                        onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Section B: Line Items */}
              <div className="stat-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                    2. Products & Line Items
                  </h2>
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="btn-secondary"
                    style={{ fontSize: '0.8rem' }}
                    disabled={isSubmitting}
                  >
                    + Add Product
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {lineItems.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '14px',
                        background: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        display: 'grid',
                        gridTemplateColumns: '2fr 1fr 1fr 1fr auto',
                        gap: '12px',
                        alignItems: 'center',
                      }}
                    >
                      {/* Product Title */}
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Product Title *</label>
                        <input
                          type="text"
                          className={`form-input ${fieldErrors[`itemTitle_${idx}`] ? 'error' : ''}`}
                          placeholder="e.g. Wireless Keyboard"
                          value={item.productTitle}
                          onChange={(e) => handleLineItemChange(idx, 'productTitle', e.target.value)}
                          disabled={isSubmitting}
                        />
                        {availableProducts.length > 0 && (
                          <select
                            style={{ marginTop: '4px', fontSize: '0.75rem', width: '100%' }}
                            onChange={(e) => handleLineItemChange(idx, 'productSelect', e.target.value)}
                            defaultValue=""
                          >
                            <option value="" disabled>-- Or pick from catalog --</option>
                            {availableProducts.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.title}
                              </option>
                            ))}
                          </select>
                        )}
                        {fieldErrors[`itemTitle_${idx}`] && (
                          <div className="field-error">{fieldErrors[`itemTitle_${idx}`]}</div>
                        )}
                      </div>

                      {/* SKU */}
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>SKU</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="KB-001"
                          value={item.sku}
                          onChange={(e) => handleLineItemChange(idx, 'sku', e.target.value)}
                          disabled={isSubmitting}
                        />
                      </div>

                      {/* Unit Price */}
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Price ($) *</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className={`form-input ${fieldErrors[`itemPrice_${idx}`] ? 'error' : ''}`}
                          value={item.unitPrice}
                          onChange={(e) => handleLineItemChange(idx, 'unitPrice', e.target.value)}
                          disabled={isSubmitting}
                        />
                        {fieldErrors[`itemPrice_${idx}`] && (
                          <div className="field-error">{fieldErrors[`itemPrice_${idx}`]}</div>
                        )}
                      </div>

                      {/* Quantity */}
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Qty *</label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          className={`form-input ${fieldErrors[`itemQty_${idx}`] ? 'error' : ''}`}
                          value={item.quantity}
                          onChange={(e) => handleLineItemChange(idx, 'quantity', e.target.value)}
                          disabled={isSubmitting}
                        />
                        {fieldErrors[`itemQty_${idx}`] && (
                          <div className="field-error">{fieldErrors[`itemQty_${idx}`]}</div>
                        )}
                      </div>

                      {/* Remove Button */}
                      <div>
                        <button
                          type="button"
                          onClick={() => handleRemoveLineItem(idx)}
                          className="btn-secondary"
                          style={{ color: '#ef4444', borderColor: '#fca5a5', padding: '8px 10px' }}
                          title="Remove item"
                          disabled={isSubmitting || lineItems.length <= 1}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Order Summary & Placement */}
            <div>
              <div className="stat-card" style={{ position: 'sticky', top: '88px' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '16px' }}>
                  3. Order Summary
                </h2>

                <div className="form-group">
                  <label htmlFor="financialStatus">Financial Status</label>
                  <select
                    id="financialStatus"
                    className="form-input"
                    value={financialStatus}
                    onChange={(e) => setFinancialStatus(e.target.value)}
                    disabled={isSubmitting}
                  >
                    <option value="paid">Paid (Mark as Paid)</option>
                    <option value="pending">Pending (Payment Pending)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="currency">Currency</label>
                  <select
                    id="currency"
                    className="form-input"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    disabled={isSubmitting}
                  >
                    <option value="USD">USD ($)</option>
                    <option value="CAD">CAD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="note">Order Note</label>
                  <textarea
                    id="note"
                    className="form-input"
                    rows="2"
                    placeholder="Optional notes for Shopify order..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', margin: '16px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem', color: '#64748b' }}>
                    <span>Line Items Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                    <span>Total Amount</span>
                    <span style={{ color: '#4f46e5' }}>${totalAmount.toFixed(2)} {currency}</span>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn-primary"
                  style={{ width: '100%', padding: '14px', fontSize: '1rem' }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <LoadingSpinner />
                      <span>Placing Order in Shopify...</span>
                    </>
                  ) : (
                    'Place Order in Shopify'
                  )}
                </button>
                <div style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'center', marginTop: '10px' }}>
                  Order will be created live in your connected Shopify store and persisted to CRM PostgreSQL.
                </div>
              </div>
            </div>
          </div>
        </form>
      )}
    </DashboardLayout>
  );
};
