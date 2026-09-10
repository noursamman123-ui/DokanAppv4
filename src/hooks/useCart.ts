/**
 * Cart data access — the WooCommerce Store API cart (via CartService) is the
 * single source of truth. There is no separate local cart state to keep in
 * sync: every mutation here writes the server's own response straight into
 * the shared `['cart']` query cache, so every screen reading `useCart()`
 * reflects the same real state a moment later, with nothing to reconcile.
 *
 * This replaces the old Zustand `cartStore` (a parallel local item list,
 * corrected after the fact by a reconciliation loop in `syncLocalCart`) —
 * that dual-state design was the root of several 2026-08 bugs where the
 * on-screen total didn't match what checkout actually charged.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CartService } from '../api/cart.service';
import { Cart } from '../types';

export const CART_QUERY_KEY = ['cart'] as const;

export const useCart = () =>
  useQuery({
    queryKey: CART_QUERY_KEY,
    queryFn: CartService.getCart,
    staleTime: 0,
  });

function useCartMutation<TVars>(mutationFn: (vars: TVars) => Promise<Cart>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (updatedCart) => {
      queryClient.setQueryData(CART_QUERY_KEY, updatedCart);
    },
  });
}

export interface AddToCartVars {
  productId: number;
  quantity: number;
  variationId?: number;
  variation?: Record<string, string>;
}

export const useAddToCart = () =>
  useCartMutation((vars: AddToCartVars) =>
    CartService.addItem(vars.productId, vars.quantity, vars.variationId, vars.variation)
  );

export const useUpdateCartItem = () =>
  useCartMutation((vars: { key: string; quantity: number }) =>
    CartService.updateItem(vars.key, vars.quantity)
  );

export const useRemoveCartItem = () =>
  useCartMutation((vars: { key: string }) => CartService.removeItem(vars.key));

export const useApplyCoupon = () =>
  useCartMutation((vars: { code: string }) => CartService.applyCoupon(vars.code));

export const useRemoveCoupon = () =>
  useCartMutation((vars: { code: string }) => CartService.removeCoupon(vars.code));
