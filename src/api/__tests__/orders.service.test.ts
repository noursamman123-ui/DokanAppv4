/**
 * Contract tests for OrdersService.placeOrder — the four-step sequence
 * (empty-cart guard, update customer, select shipping, reconcile coupon,
 * submit) flagged in the risk audit for having no test coverage. CartService
 * is mocked at the module boundary so these tests exercise placeOrder's own
 * sequencing/branching logic against realistic Cart shapes, independent of
 * CartService's own (separately tested) internals.
 */
import { OrdersService } from '../orders.service';
import { makeCartFixture } from '../__fixtures__/cart.fixture';
import { CheckoutData } from '../../types';

jest.mock('../client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
  devWarnIfMissing: jest.fn(),
}));

jest.mock('../cart.service', () => ({
  CartService: {
    getCart: jest.fn(),
    updateCustomer: jest.fn(),
    selectShippingRate: jest.fn(),
    applyCoupon: jest.fn(),
    removeCoupon: jest.fn(),
  },
}));

import apiClient from '../client';
import { CartService } from '../cart.service';

const mockedApi = apiClient as unknown as { post: jest.Mock };
const mockedCart = CartService as unknown as {
  getCart: jest.Mock;
  updateCustomer: jest.Mock;
  selectShippingRate: jest.Mock;
  applyCoupon: jest.Mock;
  removeCoupon: jest.Mock;
};

const checkoutData: CheckoutData = {
  billing_address: {
    first_name: 'أحمد', last_name: 'العلي', company: '', address_1: 'شارع بغداد',
    address_2: '', city: 'دمشق', state: 'دمشق', postcode: '00000', country: 'SY',
    email: '963999999999@dokan.local', phone: '+963999999999',
  },
  shipping_address: {
    first_name: 'أحمد', last_name: 'العلي', company: '', address_1: 'شارع بغداد',
    address_2: '', city: 'دمشق', state: 'دمشق', postcode: '00000', country: 'SY',
    phone: '+963999999999',
  },
  customer_note: '',
  create_account: false,
  payment_method: 'cod',
  payment_data: [],
  coupon_code: undefined,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('OrdersService.placeOrder', () => {
  it('throws a clear Arabic error and never submits when the cart is empty', async () => {
    mockedCart.getCart.mockResolvedValue(makeCartFixture({ items: [] }));

    await expect(OrdersService.placeOrder(checkoutData)).rejects.toThrow('السلة فارغة');
    expect(mockedCart.updateCustomer).not.toHaveBeenCalled();
    expect(mockedApi.post).not.toHaveBeenCalled();
  });

  it('runs update-customer → shipping → coupon → submit in order and returns the created order', async () => {
    const cartNoShipping = makeCartFixture({ needs_shipping: false, shipping_rates: [] });
    mockedCart.getCart.mockResolvedValue(cartNoShipping);
    mockedCart.updateCustomer.mockResolvedValue(cartNoShipping);
    mockedApi.post.mockResolvedValue({ data: { id: 4521, number: '4521' } });

    const order = await OrdersService.placeOrder(checkoutData);

    expect(mockedCart.updateCustomer).toHaveBeenCalledWith({
      billing_address: checkoutData.billing_address,
      shipping_address: checkoutData.shipping_address,
    });
    expect(mockedCart.selectShippingRate).not.toHaveBeenCalled();
    expect(order).toEqual({ id: 4521, number: '4521' });
  });

  it('selects the pre-selected rate for every shipping package when shipping is needed', async () => {
    const cartWithShipping = makeCartFixture({
      needs_shipping: true,
      shipping_rates: [
        {
          package_id: 0,
          name: 'الحزمة 1',
          destination: { address_1: '', city: 'دمشق', state: 'دمشق', postcode: '00000', country: 'SY' },
          items: [],
          shipping_rates: [
            { rate_id: 'flat:1', name: 'توصيل عادي', description: '', delivery_time: '', price: '3000', taxes: '0', instance_id: 1, method_id: 'flat_rate', meta_data: [], selected: true, currency_code: 'SYP', currency_symbol: 'ل.س' },
            { rate_id: 'flat:2', name: 'توصيل سريع', description: '', delivery_time: '', price: '6000', taxes: '0', instance_id: 2, method_id: 'flat_rate', meta_data: [], selected: false, currency_code: 'SYP', currency_symbol: 'ل.س' },
          ],
        },
      ],
    });
    mockedCart.getCart.mockResolvedValue(cartWithShipping);
    mockedCart.updateCustomer.mockResolvedValue(cartWithShipping);
    mockedCart.selectShippingRate.mockResolvedValue(cartWithShipping);
    mockedApi.post.mockResolvedValue({ data: { id: 1 } });

    await OrdersService.placeOrder(checkoutData);

    expect(mockedCart.selectShippingRate).toHaveBeenCalledWith(0, 'flat:1');
  });

  it('throws a clear Arabic error when shipping is needed but no packages are returned', async () => {
    const cartNoPackages = makeCartFixture({ needs_shipping: true, shipping_rates: [] });
    mockedCart.getCart.mockResolvedValue(cartNoPackages);
    mockedCart.updateCustomer.mockResolvedValue(cartNoPackages);

    await expect(OrdersService.placeOrder(checkoutData)).rejects.toThrow(
      'يرجى إضافة عنوان شحن صالح'
    );
    expect(mockedApi.post).not.toHaveBeenCalled();
  });

  it('removes stale coupons and applies the newly desired one', async () => {
    const cartWithOldCoupon = makeCartFixture({
      needs_shipping: false,
      coupons: [{ code: 'OLD10', discount_type: 'percent', amount: '10', totals: { total_discount: '1000', total_discount_tax: '0' } }],
    });
    mockedCart.getCart.mockResolvedValue(cartWithOldCoupon);
    mockedCart.updateCustomer.mockResolvedValue(cartWithOldCoupon);
    mockedCart.removeCoupon.mockResolvedValue(makeCartFixture({ needs_shipping: false, coupons: [] }));
    mockedApi.post.mockResolvedValue({ data: { id: 1 } });

    await OrdersService.placeOrder({ ...checkoutData, coupon_code: 'NEW20' });

    expect(mockedCart.removeCoupon).toHaveBeenCalledWith('OLD10');
    expect(mockedCart.applyCoupon).toHaveBeenCalledWith('NEW20');
  });
});
