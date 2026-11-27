import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { shopifyApi, webhooksApi } from '../../services/api';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Alert } from '../../components/common/Alert';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export const ShopifyIntegration = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [shopDomain, setShopDomain] = useState('');
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const [importStats, setImportStats] = useState(null);
  const [importHistory, setImportHistory] = useState([]);
  const [webhookSummary, setWebhookSummary] = useState(null);
  const [webhookEvents, setWebhookEvents] = useState([]);
  const [isRegisteringWebhooks, setIsRegisteringWebhooks] = useState(false);
  const [retryingEventId, setRetryingEventId] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const isAdmin = user?.role === 'ADMIN';

  // Load store status & import history
  const loadStatusAndHistory = useCallback(async () => {
    try {
      setErrorMessage('');
      const statusRes = await shopifyApi.getStatus();
      setConnectionStatus(statusRes.data);

      if (statusRes.data?.isConnected) {
        const [historyRes, webhookStatsRes, webhookEventsRes] = await Promise.all([
          shopifyApi.getImportHistory(1, 5),
          webhooksApi.getStatus().catch(() => ({ data: null })),
          webhooksApi.listEvents({ limit: 5 }).catch(() => ({ data: [] })),
        ]);
        setImportHistory(historyRes.data || []);
        setWebhookSummary(webhookStatsRes.data || null);
        setWebhookEvents(webhookEventsRes.data || []);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to load Shopify status');
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    // Check URL parameters from OAuth callback redirect
    const statusParam = searchParams.get('status');
    const shopParam = searchParams.get('shop');
    const messageParam = searchParams.get('message');

    if (statusParam === 'connected') {
      setSuccessMessage(`Successfully connected store: ${shopParam || ''}`);
      searchParams.delete('status');
      searchParams.delete('shop');
      setSearchParams(searchParams, { replace: true });
    } else if (statusParam === 'error') {
      setErrorMessage(messageParam || 'Shopify authorization failed');
      searchParams.delete('status');
      searchParams.delete('message');
      setSearchParams(searchParams, { replace: true });
    }

    loadStatusAndHistory();
  }, [searchParams, setSearchParams, loadStatusAndHistory]);

  const handleConnect = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!shopDomain.trim()) {
      setErrorMessage('Please enter your Shopify store domain');
      return;
    }

    setIsConnecting(true);
    try {
      const response = await shopifyApi.connect(shopDomain.trim());
      const { authUrl } = response.data;
      if (authUrl) {
        // Redirect browser to Shopify OAuth page
        window.location.href = authUrl;
      } else {
        throw new Error('Authorization URL was not returned by server');
      }
    } catch (err) {
      setErrorMessage(
        err.response?.data?.message || err.message || 'Failed to initiate Shopify connection'
      );
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect this Shopify store?')) {
      return;
    }

    setIsDisconnecting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await shopifyApi.disconnect();
      setSuccessMessage('Shopify store disconnected successfully');
      setImportStats(null);
      await loadStatusAndHistory();
    } catch (err) {
      setErrorMessage(
        err.response?.data?.message || err.message || 'Failed to disconnect Shopify store'
      );
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleImportOrders = async () => {
    setIsImporting(true);
    setErrorMessage('');
    setSuccessMessage('');
    setImportStats(null);

    try {
      const response = await shopifyApi.importOrders();
      setImportStats(response.stats);
      setSuccessMessage(
        `Import completed successfully! Fetched: ${response.stats.totalFetched}, New: ${response.stats.successfullyImported}, Updated: ${response.stats.updatedExisting}`
      );
      await loadStatusAndHistory();
    } catch (err) {
      setErrorMessage(
        err.response?.data?.message || err.message || 'Failed to import orders from Shopify'
      );
    } finally {
      setIsImporting(false);
    }
  };

  const handleRegisterWebhooks = async () => {
    setIsRegisteringWebhooks(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await shopifyApi.registerWebhooks();
      setSuccessMessage('Successfully registered orders/create and orders/updated webhook subscriptions on Shopify');
      await loadStatusAndHistory();
    } catch (err) {
      setErrorMessage(
        err.response?.data?.message || err.message || 'Failed to register webhooks on Shopify'
      );
    } finally {
      setIsRegisteringWebhooks(false);
    }
  };

  const handleRetryWebhook = async (eventId) => {
    setRetryingEventId(eventId);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await webhooksApi.retryEvent(eventId);
      setSuccessMessage(`Successfully reprocessed webhook event: ${eventId}`);
      await loadStatusAndHistory();
    } catch (err) {
      setErrorMessage(
        err.response?.data?.message || err.message || 'Failed to reprocess webhook event'
      );
    } finally {
      setRetryingEventId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="dashboard-header">
        <h1>Shopify Store Integration</h1>
        <p>Connect your Shopify store, authenticate via OAuth, and synchronize customer orders into PostgreSQL.</p>
      </div>

      <Alert type="error" message={errorMessage} />
      <Alert type="success" message={successMessage} />

      {isLoadingStatus ? (
        <div className="stat-card" style={{ textAlign: 'center', padding: '40px' }}>
          <LoadingSpinner primary />
          <p style={{ marginTop: '12px', color: '#64748b' }}>Checking Shopify connection state...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Connection Card */}
          <div className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                  Store Connection Status
                </h2>
                <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '4px' }}>
                  {connectionStatus?.isConnected
                    ? 'Your CRM is currently linked to an active Shopify store.'
                    : 'Connect a Shopify store using your myshopify.com domain.'}
                </p>
              </div>
              <div>
                <span
                  className="role-pill"
                  style={{
                    backgroundColor: connectionStatus?.isConnected ? '#dcfce7' : '#fee2e2',
                    color: connectionStatus?.isConnected ? '#15803d' : '#b91c1c',
                    fontSize: '0.8rem',
                    padding: '6px 12px',
                  }}
                >
                  {connectionStatus?.isConnected ? '● Connected' : '○ Not Connected'}
                </span>
              </div>
            </div>

            {connectionStatus?.isConnected ? (
              <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Store Domain</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                      {connectionStatus.store?.shopDomain}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Connected Date</div>
                    <div style={{ fontSize: '0.95rem', color: '#334155', marginTop: '4px' }}>
                      {new Date(connectionStatus.store?.connectedAt).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Granted Scopes</div>
                    <div style={{ fontSize: '0.85rem', color: '#4f46e5', marginTop: '4px', wordBreak: 'break-all' }}>
                      {connectionStatus.store?.scopes || 'read_orders, write_orders'}
                    </div>
                  </div>
                </div>

                {isAdmin && (
                  <div style={{ marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={handleDisconnect}
                      disabled={isDisconnecting}
                      className="btn-secondary"
                      style={{ color: '#b91c1c', borderColor: '#fca5a5' }}
                    >
                      {isDisconnecting ? 'Disconnecting...' : 'Disconnect Store'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div>
                {!isAdmin ? (
                  <div className="alert alert-error">
                    Only administrators can initiate Shopify store connections.
                  </div>
                ) : (
                  <form onSubmit={handleConnect} style={{ maxWidth: '520px', marginTop: '16px' }}>
                    <div className="form-group">
                      <label htmlFor="shopDomain">Shopify Store Domain</label>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <input
                          id="shopDomain"
                          type="text"
                          className="form-input"
                          placeholder="your-shop-name.myshopify.com"
                          value={shopDomain}
                          onChange={(e) => setShopDomain(e.target.value)}
                          disabled={isConnecting}
                        />
                        <button
                          type="submit"
                          className="btn-primary"
                          style={{ width: 'auto', whiteSpace: 'nowrap' }}
                          disabled={isConnecting}
                        >
                          {isConnecting ? (
                            <>
                              <LoadingSpinner />
                              <span>Connecting...</span>
                            </>
                          ) : (
                            'Connect to Shopify'
                          )}
                        </button>
                      </div>
                      <div className="password-hints">
                        Format: <code>example.myshopify.com</code>. You will be redirected to Shopify to authorize CRM permissions.
                      </div>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Order Synchronization Card */}
          {connectionStatus?.isConnected && (
            <div className="stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                    Shopify Order Synchronization
                  </h2>
                  <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '4px' }}>
                    Fetch orders, line items, and customers from Shopify Admin API into PostgreSQL.
                  </p>
                </div>
                {isAdmin && (
                  <button
                    onClick={handleImportOrders}
                    disabled={isImporting}
                    className="btn-primary"
                    style={{ width: 'auto' }}
                  >
                    {isImporting ? (
                      <>
                        <LoadingSpinner />
                        <span>Synchronizing Orders...</span>
                      </>
                    ) : (
                      'Sync Orders Now'
                    )}
                  </button>
                )}
              </div>

              {/* Import Progress Indicator */}
              {isImporting && (
                <div style={{ padding: '20px', backgroundColor: '#eef2ff', borderRadius: '8px', marginBottom: '20px', textAlign: 'center' }}>
                  <LoadingSpinner primary />
                  <p style={{ marginTop: '10px', fontWeight: 600, color: '#4338ca' }}>
                    Importing orders and resolving customers in transaction...
                  </p>
                  <p style={{ fontSize: '0.825rem', color: '#64748b', marginTop: '4px' }}>
                    Using cursor-based pagination. Existing orders will be updated to prevent duplication.
                  </p>
                </div>
              )}

              {/* Live / Last Import Statistics */}
              {importStats && (
                <div style={{ marginTop: '16px', marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '12px', color: '#334155' }}>
                    Latest Import Summary
                  </h3>
                  <div className="grid-cards" style={{ marginBottom: 0 }}>
                    <div className="stat-card" style={{ padding: '16px', backgroundColor: '#f8fafc' }}>
                      <div className="stat-card-title">Total Fetched</div>
                      <div className="stat-card-value" style={{ fontSize: '1.5rem' }}>{importStats.totalFetched}</div>
                    </div>
                    <div className="stat-card" style={{ padding: '16px', backgroundColor: '#ecfdf5' }}>
                      <div className="stat-card-title" style={{ color: '#047857' }}>New Orders Created</div>
                      <div className="stat-card-value" style={{ fontSize: '1.5rem', color: '#047857' }}>{importStats.successfullyImported}</div>
                    </div>
                    <div className="stat-card" style={{ padding: '16px', backgroundColor: '#f0f9ff' }}>
                      <div className="stat-card-title" style={{ color: '#0369a1' }}>Existing Orders Updated</div>
                      <div className="stat-card-value" style={{ fontSize: '1.5rem', color: '#0369a1' }}>{importStats.updatedExisting}</div>
                    </div>
                    <div className="stat-card" style={{ padding: '16px', backgroundColor: importStats.failed > 0 ? '#fef2f2' : '#f8fafc' }}>
                      <div className="stat-card-title" style={{ color: importStats.failed > 0 ? '#b91c1c' : '#64748b' }}>Failed</div>
                      <div className="stat-card-value" style={{ fontSize: '1.5rem', color: importStats.failed > 0 ? '#b91c1c' : '#64748b' }}>
                        {importStats.failed}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Import History Table */}
              <div style={{ marginTop: '20px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '12px', color: '#334155' }}>
                  Recent Synchronization Runs
                </h3>
                {importHistory.length === 0 ? (
                  <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>No synchronization runs recorded yet.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                          <th style={{ padding: '8px 12px' }}>Status</th>
                          <th style={{ padding: '8px 12px' }}>Total</th>
                          <th style={{ padding: '8px 12px' }}>Imported</th>
                          <th style={{ padding: '8px 12px' }}>Updated</th>
                          <th style={{ padding: '8px 12px' }}>Failed</th>
                          <th style={{ padding: '8px 12px' }}>Started At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importHistory.map((run) => (
                          <tr key={run.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 12px' }}>
                              <span
                                className="role-pill"
                                style={{
                                  backgroundColor: run.status === 'COMPLETED' ? '#dcfce7' : run.status === 'FAILED' ? '#fee2e2' : '#e0e7ff',
                                  color: run.status === 'COMPLETED' ? '#15803d' : run.status === 'FAILED' ? '#b91c1c' : '#3730a3',
                                }}
                              >
                                {run.status}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', fontWeight: 600 }}>{run.totalFetched}</td>
                            <td style={{ padding: '10px 12px', color: '#047857' }}>+{run.successfullyImported}</td>
                            <td style={{ padding: '10px 12px', color: '#0369a1' }}>{run.updatedExisting}</td>
                            <td style={{ padding: '10px 12px', color: run.failed > 0 ? '#b91c1c' : '#64748b' }}>{run.failed}</td>
                            <td style={{ padding: '10px 12px', color: '#64748b' }}>
                              {new Date(run.startedAt).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Webhook Real-Time Synchronization Card */}
          {connectionStatus?.isConnected && (
            <div className="stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                    Shopify Webhook Integration & Real-Time Sync
                  </h2>
                  <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '4px' }}>
                    Automated real-time synchronization for Shopify order creation and update events.
                  </p>
                </div>
                {isAdmin && (
                  <button
                    onClick={handleRegisterWebhooks}
                    disabled={isRegisteringWebhooks}
                    className="btn-primary"
                    style={{ width: 'auto', backgroundColor: '#0284c7', borderColor: '#0284c7' }}
                  >
                    {isRegisteringWebhooks ? (
                      <>
                        <LoadingSpinner />
                        <span>Registering Webhooks...</span>
                      </>
                    ) : (
                      'Register Webhooks on Shopify'
                    )}
                  </button>
                )}
              </div>

              {/* Webhook Configuration & Topic Badges */}
              <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Webhook Endpoint</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', marginTop: '4px', fontFamily: 'monospace' }}>
                      POST /api/v1/webhooks/shopify
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Security Verification</div>
                    <div style={{ fontSize: '0.875rem', color: '#15803d', fontWeight: 600, marginTop: '4px' }}>
                      ● HMAC-SHA256 (Raw Request Body)
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>Active Subscribed Topics</div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <span className="role-pill" style={{ backgroundColor: '#e0e7ff', color: '#3730a3', fontSize: '0.75rem' }}>orders/create</span>
                      <span className="role-pill" style={{ backgroundColor: '#e0e7ff', color: '#3730a3', fontSize: '0.75rem' }}>orders/updated</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Webhook Metrics Summary */}
              {webhookSummary && (
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '12px', color: '#334155' }}>
                    Webhook Activity Summary
                  </h3>
                  <div className="grid-cards" style={{ marginBottom: 0 }}>
                    <div className="stat-card" style={{ padding: '16px', backgroundColor: '#f8fafc' }}>
                      <div className="stat-card-title">Total Webhooks</div>
                      <div className="stat-card-value" style={{ fontSize: '1.5rem' }}>{webhookSummary.total}</div>
                    </div>
                    <div className="stat-card" style={{ padding: '16px', backgroundColor: '#ecfdf5' }}>
                      <div className="stat-card-title" style={{ color: '#047857' }}>Successfully Processed</div>
                      <div className="stat-card-value" style={{ fontSize: '1.5rem', color: '#047857' }}>{webhookSummary.processed}</div>
                    </div>
                    <div className="stat-card" style={{ padding: '16px', backgroundColor: webhookSummary.failed > 0 ? '#fef2f2' : '#f8fafc' }}>
                      <div className="stat-card-title" style={{ color: webhookSummary.failed > 0 ? '#b91c1c' : '#64748b' }}>Failed Events</div>
                      <div className="stat-card-value" style={{ fontSize: '1.5rem', color: webhookSummary.failed > 0 ? '#b91c1c' : '#64748b' }}>
                        {webhookSummary.failed}
                      </div>
                    </div>
                    <div className="stat-card" style={{ padding: '16px', backgroundColor: '#f0f9ff' }}>
                      <div className="stat-card-title" style={{ color: '#0369a1' }}>Pending / In-Flight</div>
                      <div className="stat-card-value" style={{ fontSize: '1.5rem', color: '#0369a1' }}>{webhookSummary.pending + webhookSummary.processing}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Recent Webhook Events Log */}
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '12px', color: '#334155' }}>
                  Recent Webhook Deliveries
                </h3>
                {webhookEvents.length === 0 ? (
                  <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>No webhook events received yet.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                          <th style={{ padding: '8px 12px' }}>Topic</th>
                          <th style={{ padding: '8px 12px' }}>Status</th>
                          <th style={{ padding: '8px 12px' }}>Order ID</th>
                          <th style={{ padding: '8px 12px' }}>Attempts</th>
                          <th style={{ padding: '8px 12px' }}>Received At</th>
                          <th style={{ padding: '8px 12px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {webhookEvents.map((evt) => (
                          <tr key={evt.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                              <code>{evt.topic}</code>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span
                                className="role-pill"
                                style={{
                                  backgroundColor:
                                    evt.status === 'PROCESSED'
                                      ? '#dcfce7'
                                      : evt.status === 'FAILED'
                                      ? '#fee2e2'
                                      : '#e0e7ff',
                                  color:
                                    evt.status === 'PROCESSED'
                                      ? '#15803d'
                                      : evt.status === 'FAILED'
                                      ? '#b91c1c'
                                      : '#3730a3',
                                }}
                              >
                                {evt.status}
                              </span>
                              {evt.errorMessage && (
                                <div style={{ fontSize: '0.75rem', color: '#b91c1c', marginTop: '4px', maxWidth: '240px' }}>
                                  {evt.errorMessage}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '10px 12px', color: '#64748b', fontSize: '0.8rem' }}>
                              {evt.shopifyOrderId || '—'}
                            </td>
                            <td style={{ padding: '10px 12px' }}>{evt.attempts || 1}</td>
                            <td style={{ padding: '10px 12px', color: '#64748b' }}>
                              {new Date(evt.createdAt).toLocaleString()}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              {evt.status === 'FAILED' && isAdmin && (
                                <button
                                  onClick={() => handleRetryWebhook(evt.id)}
                                  disabled={retryingEventId === evt.id}
                                  className="btn-secondary"
                                  style={{ padding: '4px 8px', fontSize: '0.75rem', color: '#b91c1c', borderColor: '#fca5a5' }}
                                >
                                  {retryingEventId === evt.id ? 'Retrying...' : 'Retry'}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
};
