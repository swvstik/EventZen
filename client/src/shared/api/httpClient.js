import axios from 'axios';
import useAuthStore from '@/shared/store/authStore';
import { parseAuthPayload } from '@/shared/utils/auth';

const httpClient = axios.create({
  baseURL: '/api',
  timeout: 15000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const refreshClient = axios.create({
  baseURL: '/api',
  timeout: 15000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach access token
httpClient.interceptors.request.use(
  (config) => {
    const { accessToken } = useAuthStore.getState();
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: refresh on 401
let isRefreshing = false;
let failedQueue = [];

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

// Response interceptor: normalize nested { data: { ... } } wrappers
httpClient.interceptors.response.use(
  (response) => {
    // Many backend endpoints return { success: true, data: { ... } }.
    // Unwrap so callers can simply use `res.data` instead of `res.data?.data || res.data`.
    if (
      response.data &&
      typeof response.data === 'object' &&
      'data' in response.data &&
      !Array.isArray(response.data) &&
      response.config?.responseType !== 'blob'
    ) {
      response.data = response.data.data;
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config || {};

    // Don't retry on login/register/refresh endpoints
    const skipPaths = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/verify-email'];
    if (skipPaths.some((p) => originalRequest.url?.includes(p))) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return httpClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await refreshClient.post('/auth/refresh');
        const auth = parseAuthPayload(data);

        if (!auth.accessToken) {
          throw new Error('Refresh response missing accessToken');
        }

        const existingUser = useAuthStore.getState().user;
        const refreshedUser = auth.user || existingUser;

        useAuthStore.getState().setAuth(refreshedUser, auth.accessToken);

        processQueue(null, auth.accessToken);
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${auth.accessToken}`;
        return httpClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default httpClient;
