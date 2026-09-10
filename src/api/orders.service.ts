import apiClient, { devWarnIfMissing } from './client';
import { Endpoints } from './endpoints';
import { Order, CheckoutData } from '../types';
import { CartService } from './cart.service';

export const OrdersService = {
  getOrders: async (page = 1, phone?: string): Promise<Order[]> => {
    const normalizedPhone = (phone ?? '').replace(/[^\d+]/g, '').trim();
    const response = await apiClient.get<Order[]>(Endpoints.account.orders, {
      params: {
        page,
        ...(normalizedPhone
          ? {
              phone: normalizedPhone,
              billing_phone: normalizedPhone,
              shipping_phone: normalizedPhone,
              customer_phone: normalizedPhone,
            }
          : {}),
      },
    });

    const orders = Array.isArray(response.data) ? response.data : [];
    const groupedByRoot = new Map<number, Order>();

    for (const order of orders) {
      const parentId = Number(order.parent_id ?? 0);
      const rootId = parentId > 0 ? parentId : order.id;
      const existing = groupedByRoot.get(rootId);

      if (!existing) {
        groupedByRoot.set(rootId, order);
        continue;
      }

      const existingParentId = Number(existing.parent_id ?? 0);
      const existingIsParent = existingParentId === 0;
      const currentIsParent = parentId === 0;

      if (currentIsParent && !existingIsParent) {
        groupedByRoot.set(rootId, order);
      }
    }

    return Array.from(groupedByRoot.values()).sort(
      (first, second) =>
        new Date(second.date_created).getTime() - new Date(first.date_created).getTime()
    );
  },

  getOrder: async (id: number, phone?: string): Promise<Order> => {
    const normalizedPhone = (phone ?? '').replace(/[^\d+]/g, '').trim();
    const response = await apiClient.get<Order>(Endpoints.account.orderDetail(id), {
      params: normalizedPhone
        ? {
            phone: normalizedPhone,
            billing_phone: normalizedPhone,
            shipping_phone: normalizedPhone,
            customer_phone: normalizedPhone,
          }
        : undefined,
    });
    devWarnIfMissing('OrdersService.getOrder', response.data, ['date_modified']);
    if (response.data?.line_items?.[0]) {
      devWarnIfMissing('OrdersService.getOrder line_items[0]', response.data.line_items[0], ['sku', 'price', 'subtotal']);
    }
    return response.data;
  },

  /**
   * Fetch a single guest order using its WooCommerce order_key as the
   * access token — the same model WooCommerce itself uses for order-pay
   * links. No OTP needed: possessing the key (saved on-device right after
   * checkout) is the proof.
   */
  getGuestOrderByKey: async (orderId: number, orderKey: string): Promise<Order> => {
    const response = await apiClient.get<Order>(Endpoints.account.guestOrderDetail(orderId), {
      params: { key: orderKey },
    });
    return response.data;
  },

  /**
   * Recover a guest's full order history on a new device by re-verifying
   * phone ownership via WhatsApp OTP. `otpProofToken` must come from
   * CheckoutOtpService.verifyOtp() after sendOrdersLookupOtp().
   */
  getGuestOrdersByPhone: async (phone: string, otpProofToken: string): Promise<Order[]> => {
    const response = await apiClient.get<Order[]>(Endpoints.account.guestOrders, {
      params: { phone },
      headers: { 'X-Dokan-OTP-Proof': otpProofToken },
    });
    return Array.isArray(response.data) ? response.data : [];
  },

  placeOrder: async (
    checkoutData: CheckoutData,
    otpProofToken?: string
  ): Promise<Order> => {
    // The cart is already server-authoritative by this point (every add/
    // remove/quantity change already went straight to the server) — just
    // guard against placing an order against an empty cart.
    const initialCart = await CartService.getCart();
    if (initialCart.items.length === 0) {
      throw new Error('السلة فارغة. يرجى إضافة منتجات قبل إتمام الطلب.');
    }

    let syncedCart = await CartService.updateCustomer({
      billing_address: checkoutData.billing_address,
      shipping_address: checkoutData.shipping_address,
    });

    if (syncedCart.needs_shipping) {
      const packages = syncedCart.shipping_rates ?? [];

      if (packages.length === 0) {
        throw new Error('يرجى إضافة عنوان شحن صالح أو اختيار عنوان محفوظ لعرض خيارات الشحن.');
      }

      for (const shippingPackage of packages) {
        const selectedRate =
          shippingPackage.shipping_rates.find((rate) => rate.selected) ??
          shippingPackage.shipping_rates[0];

        if (!selectedRate) {
          throw new Error('لا توجد طريقة شحن متاحة لهذا العنوان. جرّب تعديل الدولة أو المدينة أو المنطقة أو الرمز البريدي.');
        }

        syncedCart = await CartService.selectShippingRate(
          shippingPackage.package_id,
          selectedRate.rate_id
        );
      }
    }

    const desiredCoupon = checkoutData.coupon_code?.trim();

    for (const coupon of syncedCart.coupons) {
      if (!desiredCoupon || coupon.code.toLowerCase() !== desiredCoupon.toLowerCase()) {
        await CartService.removeCoupon(coupon.code);
      }
    }

    if (
      desiredCoupon &&
      !syncedCart.coupons.some((coupon) => coupon.code.toLowerCase() === desiredCoupon.toLowerCase())
    ) {
      await CartService.applyCoupon(desiredCoupon);
    }

    const response = await apiClient.post<Order>(Endpoints.storeCheckout.order, checkoutData, {
      headers: otpProofToken
        ? {
            'X-Dokan-OTP-Proof': otpProofToken,
          }
        : undefined,
    });
    return response.data;
  },
};
