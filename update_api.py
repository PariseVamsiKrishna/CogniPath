import axios from 'axios';

const rawBase = (import.meta.env.VITE_API_BASE_URL || '').trim();
const isProd = import.meta.env.PROD;

if (isProd && !rawBase) {
  console.error('[COGNIPATH] CRITICAL CONFIG ERROR: VITE_API_BASE_URL environment variable is not set in production! Ensure VITE_API_BASE_URL is configured on Vercel dashboard to point to your backend API URL.');
}

const cleanBase = rawBase.replace(/\/+$/, '').replace(/\/api\/v1\/?$/, '');
const API_BASE_URL = cleanBase ? `${cleanBase}/api/v1` : '/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Ping health endpoint on load to wake up cold-start backend (e.g. Render free tier)
try {
  const wakeUrl = cleanBase ? `${cleanBase}/health` : '/health';
  axios.get(wakeUrl, { timeout: 10000 }).catch(() => {
    /* silent wake attempt */
  });
} catch (e) {
  /* ignore */
}

// Request Interceptor: Attach JWT Token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('cognipath_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle Unauthenticated
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('[COGNIPATH API] 401 Unauthorized encountered');
    }
    return Promise.reject(error);
  }
);
