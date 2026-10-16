import apiClient, { devWarnIfMissing } from './client';
import { Endpoints } from './endpoints';
import { Cart, UserAddress } from '../types';

const toVariationPayload = (variation?: Record<string, string>) =>
  variation
    ? Object.entries(variation)
        .filter(([, value]) => Boolean(value))
        .map(([attribute, value]) => ({ attribute, value }))
    : undefined;

export const CartService = {
  getCart: async (): Promise<Cart> => {
    // No catch-and-wipe fallback here on purpose: the client.ts response
    // interceptor already recovers from a stale/missing nonce (the one real
    // reason this call can legitimately 401) by fetching a fresh nonce and
    // retrying — narrowly, only for that case. This used to also catch here
    // and unconditionally clear both the nonce AND the cart-token on *any*
    // failure (a timeout, a 500, a momentary network drop switching networks
    // in the background) — which throws away the real cart-token and starts
    // a brand-new empty cart on the very next successful request. That was
    // the actual cause of "the cart empties itself when I leave and come
    // back" — every cart-screen focus triggers a getCart() refetch, and any
    // transient blip permanently destroyed the session, not just that call.
    const response = await apiClient.get<Cart>(Endpoints.storeCart.get);
    devWarnIfMissing('CartService.getCart totals', response.data?.totals, [
      'total_items', 'total_shipping', 'total_discount', 'total_price',
    ]);
    return response.data;
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
