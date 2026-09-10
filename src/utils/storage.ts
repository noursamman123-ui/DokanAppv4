/**
 * Dokan App – Secure Storage Utilities
 * MMKV-based fast, secure local storage with type-safe accessors.
 */
import { createMMKV } from 'react-native-mmkv';
import { GuestOrderRecord } from '../types';

// A minimal in-memory stand-in for the subset of MMKV's API this app uses.
// Only reached if MMKV itself fails to open (e.g. a storage file corrupted
// by a forced kill mid-write on flaky Android storage) — without this,
// createMMKV throwing at module load crashes app startup entirely, before
// React (and the ErrorBoundary) ever mounts, with no recovery UI possible.
// This keeps the app launchable; the cost is no persistence for that session.
class InMemoryMMKV {
  private store = new Map<string, string | boolean | number>();
  getString(key: string): string | undefined {
    const v = this.store.get(key);
    return typeof v === 'string' ? v : undefined;
  }
  getBoolean(key: string): boolean | undefined {
    const v = this.store.get(key);
    return typeof v === 'boolean' ? v : undefined;
  }
  set(key: string, value: string | boolean | number): void {
    this.store.set(key, value);
  }
  remove(key: string): void {
    this.store.delete(key);
  }
  clearAll(): void {
    this.store.clear();
  }
}

const createSafeMMKV = (id: string) => {
  try {
    return createMMKV({ id });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`MMKV store "${id}" failed to open — falling back to in-memory storage for this session.`, error);
    return new InMemoryMMKV() as unknown as ReturnType<typeof createMMKV>;
  }
};

// Separate storage instances for different concerns
export const authStorage = createSafeMMKV('dokan-auth');
export const appStorage = createSafeMMKV('dokan-app');
export const cacheStorage = createSafeMMKV('dokan-cache');

// ─── Storage Keys ─────────────────────────────────────────────────────────
export const STORAGE_KEYS = {
  // Auth
  ACCESS_TOKEN: 'auth.access_token',
  USER_DATA: 'auth.user_data',
  CART_NONCE: 'auth.cart_nonce',
  CART_TOKEN: 'auth.cart_token',

  // App
  ONBOARDED: 'app.onboarded',
  LANGUAGE: 'app.language',
  THEME: 'app.theme',

  // Wishlist (local, for guest users)
  LOCAL_WISHLIST: 'wishlist.local',

  // Search
  RECENT_SEARCHES: 'search.recent',

  // Guest order history (device-local, no account required)
  GUEST_ORDERS: 'orders.guest_list',

  // Pending checkout OTP session (see CheckoutOtpSessionStorage below)
  CHECKOUT_OTP_SESSION: 'checkout.otp_session',

  // Cache
  HOME_CACHE: 'cache.home',
  CATEGORIES_CACHE: 'cache.categories',
} as const;

// ─── Auth Storage Helpers ─────────────────────────────────────────────────
export const TokenStorage = {
  getToken: (): string | undefined => authStorage.getString(STORAGE_KEYS.ACCESS_TOKEN),
  setToken: (token: string): void => authStorage.set(STORAGE_KEYS.ACCESS_TOKEN, token),
  clearToken: () => { authStorage.remove(STORAGE_KEYS.ACCESS_TOKEN); },

  getCartNonce: (): string | undefined => authStorage.getString(STORAGE_KEYS.CART_NONCE),
  setCartNonce: (nonce: string): void => authStorage.set(STORAGE_KEYS.CART_NONCE, nonce),
  clearCartNonce: () => { authStorage.remove(STORAGE_KEYS.CART_NONCE); },

  getCartToken: (): string | undefined => authStorage.getString(STORAGE_KEYS.CART_TOKEN),
  setCartToken: (token: string): void => authStorage.set(STORAGE_KEYS.CART_TOKEN, token),
  clearCartToken: () => { authStorage.remove(STORAGE_KEYS.CART_TOKEN); },

  clearAll: (): void => authStorage.clearAll(),
};

// ─── Generic Cache Helpers ────────────────────────────────────────────────
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // seconds
}

export const CacheStorage = {
  set: <T>(key: string, data: T, ttlSeconds = 300): void => {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds,
    };
    cacheStorage.set(key, JSON.stringify(entry));
  },

  get: <T>(key: string): T | null => {
    const raw = cacheStorage.getString(key);
    if (!raw) return null;

    try {
      const entry: CacheEntry<T> = JSON.parse(raw);
      const ageSeconds = (Date.now() - entry.timestamp) / 1000;
      if (ageSeconds > entry.ttl) {
        cacheStorage.remove(key);
        return null;
      }
      return entry.data;
    } catch {
      return null;
    }
  },

  invalidate: (key: string) => { cacheStorage.remove(key); },
  clearAll: (): void => cacheStorage.clearAll(),
};

// ─── App Settings Helpers ─────────────────────────────────────────────────
export const AppSettings = {
  getLanguage: (): string => appStorage.getString(STORAGE_KEYS.LANGUAGE) ?? 'ar',
  setLanguage: (lang: string): void => appStorage.set(STORAGE_KEYS.LANGUAGE, lang),

  isOnboarded: (): boolean => appStorage.getBoolean(STORAGE_KEYS.ONBOARDED) ?? false,
  setOnboarded: (): void => appStorage.set(STORAGE_KEYS.ONBOARDED, true),
};

// ─── Guest Order History ──────────────────────────────────────────────────
// Client-only record of orders placed as a guest, so "My Orders" can show
// them immediately after checkout without requiring login. Recovery across
// devices/reinstalls goes through phone + WhatsApp OTP (see orders.service.ts).
export const GuestOrdersStorage = {
  get: (): GuestOrderRecord[] => {
    const raw = appStorage.getString(STORAGE_KEYS.GUEST_ORDERS);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  add: (record: GuestOrderRecord): void => {
    const existing = GuestOrdersStorage.get().filter((item) => item.orderId !== record.orderId);
    const updated = [record, ...existing].slice(0, 30);
    appStorage.set(STORAGE_KEYS.GUEST_ORDERS, JSON.stringify(updated));
  },

  merge: (records: GuestOrderRecord[]): void => {
    const existing = GuestOrdersStorage.get();
    const byId = new Map(existing.map((item) => [item.orderId, item]));
    records.forEach((record) => byId.set(record.orderId, record));
    const merged = Array.from(byId.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 30);
    appStorage.set(STORAGE_KEYS.GUEST_ORDERS, JSON.stringify(merged));
  },

  clear: (): void => { appStorage.remove(STORAGE_KEYS.GUEST_ORDERS); },
};

// ─── Pending Checkout OTP Session ─────────────────────────────────────────
// The OTP session previously lived only in React state — a user who
// backgrounds the app to read the code from WhatsApp risks Android
// reclaiming the JS context under memory pressure, which wipes that state
// even though the code (and its ~5 minute window) is still valid, forcing a
// full resend that burns the resend cooldown and rate-limit budget. This
// persists just enough to restore the OTP modal on the next mount.
export interface PendingCheckoutOtpSession {
  otpSessionId: string;
  otpMaskedPhone: string;
  otpExpiresAt: number;
  otpResendAt: number;
}

export const CheckoutOtpSessionStorage = {
  save: (session: PendingCheckoutOtpSession): void => {
    appStorage.set(STORAGE_KEYS.CHECKOUT_OTP_SESSION, JSON.stringify(session));
  },

  /** Returns the pending session only if it hasn't expired yet. */
  get: (): PendingCheckoutOtpSession | null => {
    const raw = appStorage.getString(STORAGE_KEYS.CHECKOUT_OTP_SESSION);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as PendingCheckoutOtpSession;
      if (!parsed.otpSessionId || !parsed.otpExpiresAt || parsed.otpExpiresAt <= Date.now()) {
        appStorage.remove(STORAGE_KEYS.CHECKOUT_OTP_SESSION);
        return null;
      }
      return parsed;
    } catch {
      appStorage.remove(STORAGE_KEYS.CHECKOUT_OTP_SESSION);
      return null;
    }
  },

  clear: (): void => { appStorage.remove(STORAGE_KEYS.CHECKOUT_OTP_SESSION); },
};

// ─── Search History ───────────────────────────────────────────────────────
export const SearchHistory = {
  get: (): string[] => {
    const raw = appStorage.getString(STORAGE_KEYS.RECENT_SEARCHES);
    return raw ? JSON.parse(raw) : [];
  },
  add: (query: string): void => {
    const existing = SearchHistory.get();
    const updated = [query, ...existing.filter(q => q !== query)].slice(0, 10);
    appStorage.set(STORAGE_KEYS.RECENT_SEARCHES, JSON.stringify(updated));
  },
  clear: () => { appStorage.remove(STORAGE_KEYS.RECENT_SEARCHES); },
};
