/**
 * Dokan App – Axios HTTP Client
 * Secure, production-ready API client with:
 * - JWT token injection
 * - Automatic token refresh
 * - WooCommerce Nonce for Store API
 * - Request cancellation
 * - Structured error handling
 */
import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
  AxiosResponse,
} from 'axios';
import { TokenStorage } from '../utils/storage';
import { ApiError } from '../types';
import { APP_BASE_URL } from '../config/environment';

const BASE_URL = APP_BASE_URL;

/**
 * Dev-only sanity check for API response shapes. Today's cart-totals bug
 * (the app silently read subtotal/shipping_total/total — fields that don't
 * exist on the real WC Store API response — and fell back to 0 for weeks
 * without anyone noticing) is exactly the failure mode this catches: a
 * missing field degrades silently into a wrong-but-plausible default instead
 * of surfacing anywhere. Call this at known-critical response sites; it's a
 * no-op in production builds.
 */
export const devWarnIfMissing = (label: string, obj: unknown, requiredKeys: string[]): void => {
  if (!__DEV__) return;
  if (!obj || typeof obj !== 'object') {
    console.warn(`[API shape] ${label}: response is not an object`, obj);
    return;
  }
  const missing = requiredKeys.filter((key) => !(key in (obj as Record<string, unknown>)));
  if (missing.length > 0) {
    console.warn(`[API shape] ${label}: missing expected field(s) — ${missing.join(', ')}`, obj);
  }
};

// ─── Create Axios Instance ────────────────────────────────────────────────
const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ─── Request Interceptor: Attach Auth Token ───────────────────────────────
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = TokenStorage.getToken();
    
    // Do not attach token for Auth endpoints to avoid backend parsing exceptions
    const isAuthEndpoint = config.url?.includes('/register') || config.url?.includes('/login') || config.url?.includes('/token');

    if (token && !isAuthEndpoint) {
      // Use a completely custom header to bypass any aggressive JWT plugins
      // that might be intercepting the standard 'Authorization' header.
      config.headers['X-Dokan-Mobile-Auth'] = token;
      
      // Also keep X-Dokan-Authorization for backward compatibility with v7/v8
      config.headers['X-Dokan-Authorization'] = token;
    }

    // Attach WooCommerce cart nonce and token for Store API calls
    const cartNonce = TokenStorage.getCartNonce();
    const cartToken = TokenStorage.getCartToken();

    if (config.url?.includes('/wc/store/')) {
      if (cartNonce) {
        // Send both variants for maximum compatibility
        config.headers['Nonce'] = cartNonce;
        config.headers['X-WC-Store-API-Nonce'] = cartNonce;
      }
      if (cartToken) {
        config.headers['Cart-Token'] = cartToken;
      }
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Response Interceptor: Handle Errors ─────────────────────────────────
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

// Axios lowercases header keys: 'x-wc-store-api-nonce' and 'nonce'
const storeCartHeadersFrom = (headers: Record<string, unknown> | undefined) => {
  if (!headers) return;
  const nonce = (headers['x-wc-store-api-nonce'] ?? headers['nonce']) as string | undefined;
  if (nonce) TokenStorage.setCartNonce(nonce);
  const cartToken = headers['cart-token'] as string | undefined;
  if (cartToken) TokenStorage.setCartToken(cartToken);
};

apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    storeCartHeadersFrom(response.headers as Record<string, unknown>);
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
      _cartRetry?: boolean;
    };

    // A cart mutation with no nonce yet (first-ever cart interaction this
    // session, before the boot-time cart prefetch has landed, or after a
    // long time away) gets rejected 401 by WooCommerce — it requires a
    // nonce established by a prior GET, not just valid auth. WooCommerce
    // conveniently returns a fresh nonce even on the 401 itself, so grab
    // that (or fall back to a real GET /cart) and retry once, instead of
    // surfacing this as a generic failure — or worse, falling through to
    // the branch below, which would log the user out entirely for what is
    // purely a cart-session hiccup, not an expired auth token.
    if (
      error.response?.status === 401 &&
      originalRequest.url?.includes('/wc/store/') &&
      !originalRequest._cartRetry
    ) {
      originalRequest._cartRetry = true;
      storeCartHeadersFrom(error.response.headers as Record<string, unknown>);

      if (!TokenStorage.getCartNonce()) {
        try {
          const cartResponse = await apiClient.get(`${BASE_URL}/wp-json/wc/store/v1/cart`);
          storeCartHeadersFrom(cartResponse.headers as Record<string, unknown>);
        } catch {
          // Fall through — retry with whatever we have; the error below
          // (if it still 401s) is a more honest failure than looping.
        }
      }

      const cartNonce = TokenStorage.getCartNonce();
      const cartToken = TokenStorage.getCartToken();
      if (cartNonce) {
        originalRequest.headers['Nonce'] = cartNonce;
        originalRequest.headers['X-WC-Store-API-Nonce'] = cartNonce;
      }
      if (cartToken) {
        originalRequest.headers['Cart-Token'] = cartToken;
      }

      return apiClient(originalRequest);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      // Token expired — try to refresh or force logout
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
        // Only logout if we're certain the token is non-refreshable or truly invalid
        // For standard JWT-auth (no refresh token), we signal expiry
        (globalThis as any).__onSessionExpired?.();
      } catch (refreshError) {
        processQueue(refreshError, null);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Parse WooCommerce / WordPress error format
    const apiError = parseApiError(error);
    return Promise.reject(apiError);
  },
);

// ─── Error Parser ─────────────────────────────────────────────────────────
function parseApiError(error: AxiosError): ApiError {
  if (error.response?.data) {
    const data = error.response.data as Record<string, unknown>;
    return {
      code: (data.code as string) ?? 'UNKNOWN_ERROR',
      message: (data.message as string) ?? 'An unexpected error occurred',
      data: data.data as Record<string, unknown> | undefined,
    };
  }

  if (error.code === 'ECONNABORTED') {
    return { code: 'TIMEOUT', message: 'Request timed out. Please check your connection.' };
  }

  if (!error.response) {
    return { code: 'NETWORK_ERROR', message: 'Network error. Please check your connection.' };
  }

  return { code: 'SERVER_ERROR', message: 'A server error occurred. Please try again.' };
}

// ─── Public Helpers ───────────────────────────────────────────────────────
export const createCancelToken = () => {
  const controller = new AbortController();
  return {
    signal: controller.signal,
    cancel: () => controller.abort(),
  };
};

export default apiClient;

// Augment global type for session expiry callback
declare global {
  var __onSessionExpired: (() => void) | undefined;
}
