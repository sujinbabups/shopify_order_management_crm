import axios from 'axios';

const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1').replace(/\/$/, '');
const API_BASE_URL = rawBaseUrl.endsWith('/api/v1') ? rawBaseUrl : `${rawBaseUrl}/api/v1`;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

let inMemoryToken = null;
let isRefreshing = false;
let failedQueue = [];

export const setAccessToken = (token) => {
  inMemoryToken = token;
};

export const getAccessToken = () => inMemoryToken;

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request interceptor: attach bearer access token
apiClient.interceptors.request.use(
  (config) => {
    if (inMemoryToken) {
      config.headers.Authorization = `Bearer ${inMemoryToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 and refresh token rotation
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    const isAuthRoute =
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/register') ||
      originalRequest?.url?.includes('/auth/refresh');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const newAccessToken = data.data.accessToken;
        setAccessToken(newAccessToken);
        processQueue(null, newAccessToken);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        setAccessToken(null);
        window.dispatchEvent(new CustomEvent('auth:session-expired'));
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export const authApi = {
  login: async (credentials) => {
    const response = await apiClient.post('/auth/login', credentials);
    return response.data;
  },
  register: async (userData) => {
    const response = await apiClient.post('/auth/register', userData);
    return response.data;
  },
  getMe: async () => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },
  refresh: async () => {
    const response = await apiClient.post('/auth/refresh');
    return response.data;
  },
  logout: async () => {
    const response = await apiClient.post('/auth/logout');
    return response.data;
  },
};

export const shopifyApi = {
  connect: async (shopDomain) => {
    const response = await apiClient.post('/shopify/connect', { shopDomain });
    return response.data;
  },
  getStatus: async () => {
    const response = await apiClient.get('/shopify/status');
    return response.data;
  },
  disconnect: async () => {
    const response = await apiClient.delete('/shopify/disconnect');
    return response.data;
  },
  importOrders: async () => {
    const response = await apiClient.post('/shopify/orders/import');
    return response.data;
  },
  getImportStatus: async () => {
    const response = await apiClient.get('/shopify/orders/import/status');
    return response.data;
  },
  getImportHistory: async (page = 1, limit = 10) => {
    const response = await apiClient.get(`/shopify/orders/import/history?page=${page}&limit=${limit}`);
    return response.data;
  },
  registerWebhooks: async () => {
    const response = await apiClient.post('/shopify/webhooks/register');
    return response.data;
  },
  getRegisteredWebhooks: async () => {
    const response = await apiClient.get('/shopify/webhooks');
    return response.data;
  },
};

export const webhooksApi = {
  getStatus: async () => {
    const response = await apiClient.get('/webhooks/status');
    return response.data;
  },
  listEvents: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const response = await apiClient.get(`/webhooks/events?${query}`);
    return response.data;
  },
  retryEvent: async (id) => {
    const response = await apiClient.post(`/webhooks/retry/${id}`);
    return response.data;
  },
};

export const ordersApi = {
  getDashboardMetrics: async () => {
    const response = await apiClient.get('/orders/metrics/dashboard');
    return response.data;
  },
  create: async (orderData, idempotencyKey = null) => {
    const headers = idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : {};
    const response = await apiClient.post('/orders', orderData, { headers });
    return response.data;
  },
  getById: async (id) => {
    const response = await apiClient.get(`/orders/${id}`);
    return response.data;
  },
  list: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const response = await apiClient.get(`/orders?${query}`);
    return response.data;
  },
};

export const customersApi = {
  list: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const response = await apiClient.get(`/customers?${query}`);
    return response.data;
  },
  getById: async (id) => {
    const response = await apiClient.get(`/customers/${id}`);
    return response.data;
  },
};

export const productsApi = {
  list: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const response = await apiClient.get(`/products?${query}`);
    return response.data;
  },
  getById: async (id) => {
    const response = await apiClient.get(`/products/${id}`);
    return response.data;
  },
};

export default apiClient;
