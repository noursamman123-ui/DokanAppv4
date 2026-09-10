/**
 * Dokan App – API Endpoints
 * All endpoint definitions in one place. Never hardcode URLs in services.
 */

// Base URL comes from environment — never from this file directly.
// In .env: API_BASE_URL=https://dokan.com.sy

export const WC_API = '/wp-json/wc/v3';
export const WC_STORE_API = '/wp-json/wc/store/v1';
export const CUSTOM_API = '/wp-json/dokan-mobile/v1';
export const JWT_API = '/wp-json/jwt-auth/v1';

export const Endpoints = {
  // ─── JWT Auth ───────────────────────────────────────────────────────────
  auth: {
    login: `${CUSTOM_API}/login`,
    validate: `${JWT_API}/token/validate`,
    register: `${CUSTOM_API}/register`,
    me: `${CUSTOM_API}/profile`,
    forgotPassword: `${CUSTOM_API}/auth/forgot-password`,
    updateProfile: `${CUSTOM_API}/profile/update`,
    changePassword: `${CUSTOM_API}/auth/change-password`,
    deleteAccount: `${CUSTOM_API}/auth/delete-account`,
  },

  // ─── WooCommerce Store API (no consumer key needed) ─────────────────────
  storeCart: {
    get: `${WC_STORE_API}/cart`,
    addItem: `${WC_STORE_API}/cart/add-item`,
    removeItem: `${WC_STORE_API}/cart/remove-item`,
    updateItem: `${WC_STORE_API}/cart/update-item`,
    applyCoupon: `${WC_STORE_API}/cart/coupons`,
    removeCoupon: (code: string) => `${WC_STORE_API}/cart/coupons/${code}`,
    selectShipping: `${WC_STORE_API}/cart/select-shipping-rate`,
  },

  storeCheckout: {
    get: `${WC_STORE_API}/checkout`,
    order: `${WC_STORE_API}/checkout`,
    paymentMethods: `${WC_STORE_API}/payment-methods`,
    shippingMethods: `${WC_STORE_API}/cart/shipping-rates`,
  },

  checkoutOtp: {
    send: `${CUSTOM_API}/checkout/otp/send`,
    verify: `${CUSTOM_API}/checkout/otp/verify`,
  },

  storeProducts: {
    list: `${WC_STORE_API}/products`,
    detail: (id: number) => `${WC_STORE_API}/products/${id}`,
    related: (id: number) => `${WC_STORE_API}/products/${id}/related`,
    reviews: (id: number) => `${WC_STORE_API}/products/reviews?product_id=${id}`,
  },

  storeCategories: {
    list: `${WC_STORE_API}/products/categories`,
    detail: (id: number) => `${WC_STORE_API}/products/categories/${id}`,
  },

  // ─── Custom Mobile API ───────────────────────────────────────────────────
  home: {
    data: `${CUSTOM_API}/home`,
    banners: `${CUSTOM_API}/banners`,
    bootstrap: `${CUSTOM_API}/bootstrap`,
  },

  account: {
    orders: `${CUSTOM_API}/orders`,
    orderDetail: (id: number) => `${CUSTOM_API}/orders/${id}`,
    guestOrders: `${CUSTOM_API}/orders/guest`,
    guestOrderDetail: (id: number) => `${CUSTOM_API}/orders/guest/${id}`,
    addresses: `${CUSTOM_API}/addresses`,
    updateAddress: (type: 'billing' | 'shipping') => `${CUSTOM_API}/addresses/${type}`,
  },

  wishlist: {
    get: `${CUSTOM_API}/wishlist`,
    add: `${CUSTOM_API}/wishlist`,
    remove: (productId: number) => `${CUSTOM_API}/wishlist/${productId}`,
  },

  search: {
    query: `${WC_STORE_API}/products`,
  },

  notifications: {
    list: `${CUSTOM_API}/notifications`,
    markRead: (id: string) => `${CUSTOM_API}/notifications/${id}/read`,
    markAllRead: `${CUSTOM_API}/notifications/read-all`,
  },

  notifyMe: {
    request: `${CUSTOM_API}/notify-me`,
  },

  pages: {
    privacyPolicy: `${CUSTOM_API}/pages/privacy-policy`,
    terms: `${CUSTOM_API}/pages/terms`,
    contact: '/contact/',
    policiesPage: '/wp-json/wp/v2/pages',
    policiesUrl: '/%d8%a7%d9%84%d8%b3%d9%8a%d8%a7%d8%b3%d8%a7%d8%aa/',
  },
} as const;
