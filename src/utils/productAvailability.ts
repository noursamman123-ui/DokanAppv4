import { Product } from '../types';

/**
 * The real WC Store API product response (verified live against
 * /wp-json/wc/store/v1/products) does NOT have `stock_status`, `purchasable`,
 * or `stock_quantity` — those were assumed fields that never actually come
 * back. The real signal is `is_in_stock` / `is_purchasable` /
 * `stock_availability`. This was previously duplicated 3x (ProductCard,
 * ProductDetailScreen, SearchScreen) with SearchScreen's copy missing the
 * is_purchasable/stock_availability checks the other two had.
 */
export const isProductUnavailable = (item?: Product | null): boolean => {
  if (!item) return true;

  if (item.is_in_stock === false) return true;

  // Kept for the rare custom payload (e.g. the dokan-mobile home feed) that
  // might still send the legacy field name.
  if (item.stock_status === 'outofstock') return true;

  const isPurchasable = item.purchasable ?? item.is_purchasable;
  if (isPurchasable === false) return true;

  if (
    typeof item.stock_availability?.class === 'string'
    && item.stock_availability.class.includes('out-of-stock')
  ) {
    return true;
  }

  if (typeof item.stock_quantity === 'number' && item.stock_quantity <= 0) return true;

  return false;
};
