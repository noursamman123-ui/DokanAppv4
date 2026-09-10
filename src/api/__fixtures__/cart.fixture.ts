import { Cart } from '../../types';

// Shape verified live against the real WC Store API (`GET /wc/store/v1/cart`)
// during the 2026-08 checkout-total bug investigation — field names here
// (total_items/total_shipping/total_price, not subtotal/shipping_total/total)
// are the ones that actually come back, not the ones the app used to assume.
export const makeCartFixture = (overrides: Partial<Cart> = {}): Cart => ({
  items: [
    {
      key: 'abc123',
      id: 101,
      type: 'simple',
      quantity: 2,
      quantity_limits: { minimum: 1, maximum: 10, multiple_of: 1, editable: true },
      name: 'قميص قطني',
      sku: 'SHIRT-101',
      low_stock_remaining: null,
      sold_individually: false,
      images: [{ id: 1, src: 'https://dokan.com.sy/img/shirt.jpg', name: '', alt: '' }],
      prices: {
        price: '5000',
        regular_price: '5000',
        sale_price: '',
        currency_code: 'SYP',
        currency_symbol: 'ل.س',
        currency_minor_unit: 0,
        currency_decimal_separator: '.',
        currency_thousand_separator: ',',
        currency_prefix: '',
        currency_suffix: ' ل.س',
      },
      totals: {
        line_subtotal: '10000',
        line_subtotal_tax: '0',
        line_total: '10000',
        line_total_tax: '0',
      },
      variation: [],
    },
  ],
  coupons: [],
  fees: [],
  totals: {
    total_items: '10000',
    total_items_tax: '0',
    total_fees: '0',
    total_fees_tax: '0',
    total_shipping: '0',
    total_shipping_tax: '0',
    total_discount: '0',
    total_discount_tax: '0',
    total_tax: '0',
    total_price: '10000',
    currency_code: 'SYP',
    currency_symbol: 'ل.س',
    currency_minor_unit: 0,
  },
  needs_shipping: true,
  items_count: 2,
  items_weight: 0,
  shipping_rates: [],
  ...overrides,
});
