/**
 * Dokan App – TypeScript Type Definitions
 * All API response and app model types.
 */

// ─── Generic API Response ─────────────────────────────────────────────────
export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  totalPages: number;
  currentPage: number;
  perPage: number;
}

export interface ApiError {
  code: string;
  message: string;
  data?: Record<string, unknown>;
}

// ─── Category ─────────────────────────────────────────────────────────────
export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  parent: number;
  count: number;
  image: {
    id: number;
    src: string;
    name: string;
    alt: string;
  } | null;
  display: string;
}

export interface CategoryTreeNode extends Category {
  children: Category[];
}

// ─── Product ──────────────────────────────────────────────────────────────
export interface ProductImage {
  id: number;
  src: string;
  name: string;
  alt: string;
}

export interface ProductAttribute {
  id: number;
  name: string;
  slug?: string;
  taxonomy?: string;
  position?: number;
  visible?: boolean;
  variation?: boolean;
  has_variations?: boolean;
  options?: string[];
  terms?: Array<{
    id?: number;
    name?: string;
    slug?: string;
  }>;
  value?: string;
}

/** A parent variable product's own summary of each variation's attribute combination (name + term slug) — no price/stock, just enough to resolve which variation ID a chosen combination maps to. */
export interface ProductVariationSummary {
  id: number;
  attributes: Array<{ name: string; value: string }>;
}

export interface ProductVariation {
  id: number;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  stock_status: 'instock' | 'outofstock' | 'onbackorder';
  stock_quantity: number | null;
  variations: Record<string, string>; // e.g. { "pa_color": "red", "pa_size": "M" }
  image: ProductImage | null;
}

export interface ProductDimensions {
  length: string;
  width: string;
  height: string;
}

export interface ProductRating {
  rating: string;
  count: number | null;
}

export interface ProductReview {
  id: number;
  date_created: string;
  product_id: number;
  product_name: string;
  reviewer: string;
  review: string;
  rating: number;
  verified: boolean;
  reviewer_avatar_urls?: Record<string, string>;
}

export interface ProductPrices {
  price: string;
  regular_price: string;
  sale_price: string;
  currency_code: string;
  currency_symbol: string;
  currency_minor_unit: number;
  currency_decimal_separator: string;
  currency_thousand_separator: string;
  currency_prefix: string;
  currency_suffix: string;
}

// Two structurally different real payloads get typed as `Product` in this
// app: the WC Store API (product list/detail/related/reviews — nested
// `prices`, `is_in_stock`/`is_purchasable`/`stock_availability`,
// `review_count`) and the custom dokan-mobile-api home feed (flat
// `price`/`regular_price`/`sale_price`, `stock_status`, `rating_count`,
// no `low_stock_remaining` as of the last verified live check). Verified
// live via `scripts/check-api-schema.js` against both — fields that don't
// actually exist on either payload (the old `status`/`purchasable`/
// `stock_status`-as-required/`stock_quantity`/`manage_stock`/`featured`/
// `rating_count`-as-required/`date_created`/`date_modified`) have been
// removed or marked optional. `related_ids`/`upsell_ids`/`cross_sell_ids`
// are NOT present on the Store API response at all (WooCommerce omits them
// from the public Store API by design) — the cross-sell/upsell sections in
// ProductDetailScreen are effectively dead code until/unless a custom
// backend endpoint exposes them.
export interface Product {
  id: number;
  parent?: number;
  name: string;
  slug: string;
  type: 'simple' | 'variable' | 'grouped' | 'external';
  variation?: string;
  /** @deprecated not present on any verified live response */
  status?: string;
  permalink?: string;
  description: string;
  short_description: string;
  sku: string;
  prices: ProductPrices; // WC Store API uses nested prices
  /** Flat price fields — only present on the dokan-mobile-api home feed shape, not the Store API. */
  price?: string;
  regular_price?: string;
  sale_price?: string;
  price_html?: string;
  on_sale: boolean;
  /** @deprecated real field is `is_purchasable` (Store API) — kept for the home-feed shape, if it ever sends it. */
  purchasable?: boolean;
  is_purchasable?: boolean;
  is_in_stock?: boolean;
  is_on_backorder?: boolean;
  stock_availability?: { class?: string; text?: string };
  sold_individually?: boolean;
  has_options?: boolean;
  /** @deprecated real field on the Store API is `is_in_stock`; the home feed does send this one flat. */
  stock_status?: 'instock' | 'outofstock' | 'onbackorder';
  /** @deprecated not present on any verified live response — stock count isn't exposed publicly. */
  stock_quantity?: number | null;
  // Only the WC Store API's real field — populated when stock is at/below the
  // store's configured "low stock threshold", null otherwise (stock_quantity
  // above doesn't exist on this endpoint's response at all).
  low_stock_remaining?: number | null;
  categories: Pick<Category, 'id' | 'name' | 'slug'>[];
  images: ProductImage[];
  attributes: ProductAttribute[];
  variations: ProductVariationSummary[];
  /** Real Store API field name for review count — NOT `rating_count` (which only the home feed sends). */
  review_count?: number;
  /** @deprecated only present on the home-feed shape; Store API sends `review_count`. */
  rating_count?: number;
  average_rating: string;
  /** @deprecated WooCommerce's public Store API never returns these — see interface comment above. */
  related_ids?: number[];
  upsell_ids?: number[];
  cross_sell_ids?: number[];
  weight: string;
  dimensions: ProductDimensions;
}

// Computed discount percentage
export const getDiscountPercent = (product: Product): number | null => {
  if (!product.on_sale) return null;
  const legacyProduct = product as Product & {
    price?: string;
    regular_price?: string;
    sale_price?: string;
  };
  const regularSource = product.prices?.regular_price ?? legacyProduct.regular_price ?? legacyProduct.price ?? '0';
  const saleSource = product.prices?.price ?? legacyProduct.sale_price ?? legacyProduct.price ?? '0';
  const regular = parseFloat(String(regularSource).replace(/[^\d.]/g, ''));
  const sale = parseFloat(String(saleSource).replace(/[^\d.]/g, ''));
  
  if (isNaN(regular) || regular <= 0) return null;
  if (isNaN(sale) || sale >= regular) return null;
  
  return Math.round(((regular - sale) / regular) * 100);
};

// ─── Cart ─────────────────────────────────────────────────────────────────
// Matches the real WC Store API cart item shape — it has no product_id,
// stock_quantity, or in_stock fields. `id` is the purchasable item's own id
// (the product id for simple items, the variation's id for variation lines;
// there is no parent id exposed on a variation line).
export interface CartItem {
  key: string;           // WooCommerce cart item key
  id: number;
  type: string;
  quantity: number;
  quantity_limits: {
    minimum: number;
    maximum: number;
    multiple_of: number;
    editable: boolean;
  };
  name: string;
  sku: string;
  low_stock_remaining: number | null;
  sold_individually: boolean;
  images: ProductImage[];
  prices: ProductPrices;
  totals: {
    line_subtotal: string;
    line_subtotal_tax: string;
    line_total: string;
    line_total_tax: string;
  };
  variation: Array<{
    attribute: string;
    value: string;
  }>;
}

export interface CartCoupon {
  code: string;
  discount_type: string;
  amount: string;
  totals: {
    total_discount: string;
    total_discount_tax: string;
  };
}

// Real WC Store API cart totals field names — note these don't match the
// naming used by the checkout/order response (subtotal/shipping_total/total),
// which is why every screen reading these was silently falling back to 0.
export interface CartTotals {
  total_items: string;
  total_items_tax: string;
  total_fees: string;
  total_fees_tax: string;
  total_shipping: string;
  total_shipping_tax: string;
  total_discount: string;
  total_discount_tax: string;
  total_tax: string;
  total_price: string;
  currency_code: string;
  currency_symbol: string;
  currency_minor_unit: number;
}

export interface Cart {
  items: CartItem[];
  coupons: CartCoupon[];
  fees: unknown[];
  totals: CartTotals;
  shipping_address?: UserAddress;
  billing_address?: UserAddress;
  needs_shipping: boolean;
  has_calculated_shipping?: boolean;
  items_count: number;
  items_weight: number;
  shipping_rates?: ShippingPackage[];
  payment_methods?: string[];
}

// ─── Wishlist ─────────────────────────────────────────────────────────────
export interface WishlistItem {
  product_id: number;
  name: string;
  image: string;
  price: string;
  regular_price: string;
  sale_price: string;
  on_sale: boolean;
  in_stock: boolean;
  slug: string;
  added_at: string; // ISO date
}

// ─── User & Auth ─────────────────────────────────────────────────────────
export interface UserAddress {
  first_name: string;
  last_name: string;
  company: string;
  address_1: string;
  address_2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  email?: string;
  phone?: string;
}

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  username: string;
  display_name: string;
  avatar_url: string;
  billing: UserAddress;
  shipping: UserAddress;
  date_registered: string;
}

export interface AuthTokens {
  token: string;            // JWT access token
  refresh_token?: string;
  expires_in?: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// ─── Order ────────────────────────────────────────────────────────────────
export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'on-hold'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'failed'
  | 'trash';

export interface OrderLineItem {
  id: number;
  name: string;
  product_id: number;
  variation_id: number;
  quantity: number;
  sku: string;
  price: number;
  subtotal: string;
  total: string;
  image: {
    id: number;
    src: string;
  };
  meta_data: Array<{
    id: number;
    key: string;
    value: string;
    display_key: string;
    display_value: string;
  }>;
}

export interface OrderShippingLine {
  id: number;
  method_title: string;
  method_id: string;
  instance_id: string;
  total: string;
  total_tax: string;
  delivery_time?: string;
  meta_data?: Array<{
    id?: number;
    key?: string;
    value?: string;
    display_key?: string;
    display_value?: string;
  }>;
}

export interface Order {
  id: number;
  parent_id?: number;
  number: string;
  order_key?: string;
  status: OrderStatus;
  date_created: string;
  date_modified: string;
  discount_total: string;
  discount_tax: string;
  shipping_total: string;
  shipping_duration?: string;
  shipping_tax: string;
  cart_tax: string;
  total: string;
  total_tax: string;
  currency: string;
  currency_symbol: string;
  payment_method: string;
  payment_method_title: string;
  transaction_id: string;
  customer_note: string;
  billing: UserAddress;
  shipping: UserAddress;
  line_items: OrderLineItem[];
  shipping_lines: OrderShippingLine[];
  coupon_lines: Array<{ code: string; discount: string }>;
}

// ─── Checkout ─────────────────────────────────────────────────────────────
export interface ShippingRate {
  rate_id: string;
  name: string;
  description: string;
  delivery_time: string;
  price: string;
  taxes: string;
  instance_id: number;
  method_id: string;
  meta_data: unknown[];
  selected: boolean;
  currency_code: string;
  currency_symbol: string;
}

export interface ShippingPackage {
  package_id: number;
  name: string;
  destination: {
    address_1: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  items: Array<{ key: string; name: string; quantity: number }>;
  shipping_rates: ShippingRate[];
}

export interface PaymentMethod {
  id: string;
  title: string;
  description: string;
  order_button_text: string;
  supports: string[];
}

export interface PaymentGateway {
  id: string;
  title: string;
  description: string;
  icon: string;
  enabled: boolean;
}

export interface BootstrapData {
  store: {
    name: string;
    description: string;
    url: string;
    logo: string;
  };
  currency: {
    code: string;
    symbol: string;
    position: string;
    thousand_separator: string;
    decimal_separator: string;
    decimals: number;
  };
  payment_gateways: PaymentGateway[];
  shipping_zones: Array<{
    id: number;
    name: string;
    methods: Array<{
      id: string;
      title: string;
      cost: string;
      min_amount?: string;
    }>;
  }>;
  /**
   * Lowest free-shipping minimum-order amount found across all zones.
   * Approximate: not zone-specific to the customer's actual address (the
   * cart doesn't have one yet), just a general "spend X more" nudge.
   */
  free_shipping_min?: number | null;
  tax: {
    enabled: boolean;
    prices_include: boolean;
    display_in: string;
  };
  config: {
    min_app_version: string;
    maintenance_mode: boolean;
    registration_open: boolean;
    api_version: string;
  };
}

export interface CheckoutData {
  billing_address: UserAddress;
  shipping_address: UserAddress;
  customer_note: string;
  create_account: boolean;
  payment_method: string;
  payment_data: unknown[];
  shipping_rate_id?: string;
  coupon_code?: string;
}

export interface CheckoutOtpSendPayload {
  first_name?: string;
  last_name?: string;
  city?: string;
  address_1?: string;
  phone: string;
  phone_country?: string;
  cart_token?: string;
  purpose?: 'checkout' | 'orders_lookup';
}

export interface OtpSendResponse {
  otp_session_id: string;
  expires_in: number;
  resend_after: number;
  masked_phone: string;
}

export interface OtpVerifyResponse {
  otp_proof_token: string;
  expires_in: number;
}

// ─── Guest Order Recovery ─────────────────────────────────────────────────
// Saved on-device right after a guest checkout so "My Orders" can show it
// immediately without re-authentication. `orderKey` is WooCommerce's own
// per-order secret and doubles as the guest's access token for that order.
export interface GuestOrderRecord {
  orderId: number;
  orderNumber: string;
  orderKey: string;
  phone: string;
  createdAt: string;
}

export interface ContactInfo {
  source_url: string;
  title: string;
  description: string;
  phones: string[];
  emails: string[];
  whatsapp_links: string[];
}

export interface PrivacyPolicyContent {
  source_url: string;
  title: string;
  body: string;
}

// ─── Home / Banner ────────────────────────────────────────────────────────
export interface Banner {
  id: number;
  title: string;
  image: string;
  url: string;
  type: 'product' | 'category' | 'external' | 'none';
  target_id?: number;
}

export interface HomeData {
  banners: Banner[];
  featured_categories: Category[];
  featured_products: Product[];
  latest_products: Product[];
  sale_products: Product[];
  best_sellers: Product[];
}

// ─── Search ───────────────────────────────────────────────────────────────
export interface SearchResult {
  id: number;
  type: 'product' | 'category';
  name: string;
  slug: string;
  image?: string;
  price?: string;
}

// ─── Notification ─────────────────────────────────────────────────────────
export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: 'order' | 'promotion' | 'system';
  read: boolean;
  data?: Record<string, string>;
  created_at: string;
}

// ─── Filters ─────────────────────────────────────────────────────────────
export interface ProductFilters {
  category?: number;
  min_price?: number;
  max_price?: number;
  orderby?: 'date' | 'price' | 'rating' | 'popularity';
  order?: 'asc' | 'desc';
  on_sale?: boolean;
  featured?: boolean;
  search?: string;
  per_page?: number;
  page?: number;
}
