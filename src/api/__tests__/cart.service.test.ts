/**
 * Contract tests for CartService — thin wrappers around the WC Store API
 * cart endpoints. The server cart is the only cart (see src/hooks/useCart.ts),
 * so these just verify each method hits the right endpoint with the right
 * payload and returns the server's response untouched, plus the stale-token
 * retry behavior in getCart().
 */
import { CartService } from '../cart.service';
import { makeCartFixture } from '../__fixtures__/cart.fixture';

jest.mock('../client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
  devWarnIfMissing: jest.fn(),
}));

jest.mock('../../utils/storage', () => ({
  TokenStorage: {
    clearCartNonce: jest.fn(),
    clearCartToken: jest.fn(),
    getCartToken: jest.fn(),
    getCartNonce: jest.fn(),
  },
}));

import apiClient from '../client';
import { TokenStorage } from '../../utils/storage';

const mockedApi = apiClient as unknown as {
  get: jest.Mock;
  post: jest.Mock;
  delete: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CartService.getCart', () => {
  it('returns the cart on a normal successful call', async () => {
    const cart = makeCartFixture();
    mockedApi.get.mockResolvedValue({ data: cart });

    const result = await CartService.getCart();

    expect(mockedApi.get).toHaveBeenCalledTimes(1);
    expect(result.totals.total_price).toBe('10000');
  });

  it('clears the cart nonce/token and retries once when the first call fails', async () => {
    const cart = makeCartFixture();
    mockedApi.get
      .mockRejectedValueOnce(new Error('invalid nonce'))
      .mockResolvedValueOnce({ data: cart });

    const result = await CartService.getCart();

    expect(TokenStorage.clearCartNonce).toHaveBeenCalled();
    expect(TokenStorage.clearCartToken).toHaveBeenCalled();
    expect(mockedApi.get).toHaveBeenCalledTimes(2);
    expect(result.totals.total_price).toBe('10000');
  });

  it('propagates the error if the retry also fails', async () => {
    mockedApi.get.mockRejectedValue(new Error('still broken'));

    await expect(CartService.getCart()).rejects.toThrow('still broken');
    expect(mockedApi.get).toHaveBeenCalledTimes(2);
  });
});

describe('CartService mutation methods', () => {
  it('addItem posts id/quantity/variation_id to the add-item endpoint', async () => {
    const cart = makeCartFixture();
    mockedApi.post.mockResolvedValue({ data: cart });

    await CartService.addItem(101, 2, 55, { color: 'أحمر' });

    expect(mockedApi.post).toHaveBeenCalledWith(
      expect.stringContaining('add-item'),
      { id: 101, quantity: 2, variation_id: 55, variation: [{ attribute: 'color', value: 'أحمر' }] }
    );
  });

  it('removeItem posts the cart item key to the remove-item endpoint', async () => {
    mockedApi.post.mockResolvedValue({ data: makeCartFixture({ items: [] }) });

    await CartService.removeItem('abc123');

    expect(mockedApi.post).toHaveBeenCalledWith(expect.stringContaining('remove-item'), { key: 'abc123' });
  });

  it('updateItem posts key/quantity to the update-item endpoint', async () => {
    mockedApi.post.mockResolvedValue({ data: makeCartFixture() });

    await CartService.updateItem('abc123', 5);

    expect(mockedApi.post).toHaveBeenCalledWith(expect.stringContaining('update-item'), { key: 'abc123', quantity: 5 });
  });

  it('applyCoupon posts the code to the coupons endpoint', async () => {
    mockedApi.post.mockResolvedValue({ data: makeCartFixture() });

    await CartService.applyCoupon('SAVE10');

    expect(mockedApi.post).toHaveBeenCalledWith(expect.stringContaining('coupons'), { code: 'SAVE10' });
  });

  it('removeCoupon deletes the coupon by code', async () => {
    mockedApi.delete.mockResolvedValue({ data: makeCartFixture({ coupons: [] }) });

    await CartService.removeCoupon('SAVE10');

    expect(mockedApi.delete).toHaveBeenCalledWith(expect.stringContaining('coupons/SAVE10'));
  });

  it('selectShippingRate posts package_id/rate_id to select-shipping-rate', async () => {
    mockedApi.post.mockResolvedValue({ data: makeCartFixture() });

    await CartService.selectShippingRate(0, 'flat:1');

    expect(mockedApi.post).toHaveBeenCalledWith(
      expect.stringContaining('select-shipping-rate'),
      { package_id: 0, rate_id: 'flat:1' }
    );
  });

  it('updateCustomer posts billing/shipping addresses to update-customer', async () => {
    mockedApi.post.mockResolvedValue({ data: makeCartFixture() });
    const shipping_address = {
      first_name: 'أحمد', last_name: 'العلي', company: '', address_1: 'شارع بغداد',
      address_2: '', city: 'دمشق', state: 'دمشق', postcode: '00000', country: 'SY',
    };

    await CartService.updateCustomer({ shipping_address });

    expect(mockedApi.post).toHaveBeenCalledWith(
      expect.stringContaining('update-customer'),
      { shipping_address }
    );
  });
});
