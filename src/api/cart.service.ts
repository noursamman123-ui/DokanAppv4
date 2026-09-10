import apiClient, { devWarnIfMissing } from './client';
import { Endpoints } from './endpoints';
import { Cart, UserAddress } from '../types';
import { TokenStorage } from '../utils/storage';

const toVariationPayload = (variation?: Record<string, string>) =>
  variation
    ? Object.entries(variation)
        .filter(([, value]) => Boolean(value))
        .map(([attribute, value]) => ({ attribute, value }))
    : undefined;

export const CartService = {
  getCart: async (): Promise<Cart> => {
    try {
      const response = await apiClient.get<Cart>(Endpoints.storeCart.get);
      devWarnIfMissing('CartService.getCart totals', response.data?.totals, [
        'total_items', 'total_shipping', 'total_discount', 'total_price',
      ]);
      return response.data;
    } catch {
      // A stale/invalid cart nonce or token (e.g. after a long time away)
      // makes the Store API reject the request outright — clear both and
      // retry once with a fresh session instead of surfacing a dead cart.
      TokenStorage.clearCartNonce();
      TokenStorage.clearCartToken();
      const response = await apiClient.get<Cart>(Endpoints.storeCart.get);
      return response.data;
    }
  },

  addItem: async (productId: number, quantity: number, variationId?: number, variation?: Record<string, string>): Promise<Cart> => {
    const response = await apiClient.post<Cart>(Endpoints.storeCart.addItem, {
      id: productId,
      quantity,
      variation_id: variationId,
      variation: toVariationPayload(variation),
    });
    return response.data;
  },

  removeItem: async (key: string): Promise<Cart> => {
    const response = await apiClient.post<Cart>(Endpoints.storeCart.removeItem, { key });
    return response.data;
  },

  updateItem: async (key: string, quantity: number): Promise<Cart> => {
    const response = await apiClient.post<Cart>(Endpoints.storeCart.updateItem, { key, quantity });
    return response.data;
  },

  applyCoupon: async (code: string): Promise<Cart> => {
    const response = await apiClient.post<Cart>(Endpoints.storeCart.applyCoupon, { code });
    return response.data;
  },

  removeCoupon: async (code: string): Promise<Cart> => {
    const response = await apiClient.delete<Cart>(Endpoints.storeCart.removeCoupon(code));
    return response.data;
  },

  selectShippingRate: async (packageId: number, rateId: string): Promise<Cart> => {
    const response = await apiClient.post<Cart>(Endpoints.storeCart.selectShipping, {
      package_id: packageId,
      rate_id: rateId,
    });
    return response.data;
  },

  updateCustomer: async (data: {
    billing_address?: UserAddress;
    shipping_address?: UserAddress;
  }): Promise<Cart> => {
    const response = await apiClient.post<Cart>(`${Endpoints.storeCart.get}/update-customer`, data);
    return response.data;
  },
};
