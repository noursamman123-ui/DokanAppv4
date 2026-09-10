/**
 * Cart Screen – Full cart management with coupon and checkout flow.
 * The server cart (via useCart()) is the only cart — every action here talks
 * straight to it, so nothing shown here is guessed or synced from a separate
 * local copy.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import FastImage from 'react-native-fast-image';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { CartStackParamList } from '../../navigation/types';
import { useCart, useUpdateCartItem, useRemoveCartItem, useApplyCoupon, useRemoveCoupon } from '../../hooks/useCart';
import { BootstrapService } from '../../api/bootstrap.service';
import { Colors } from '../../theme/colors';
import { Typography, FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { Shadows } from '../../theme/shadows';
import { ApiError, CartItem } from '../../types';
import { formatPrice, formatNumber } from '../../utils/formatters';
import { resolveMediaUrl } from '../../utils/media';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type NavProp = NativeStackNavigationProp<CartStackParamList, 'CartScreen'>;

const parseMoney = (value: string | number | undefined, fallback = 0) => {
  if (value === undefined || value === null) return fallback;
  const numeric = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : fallback;
};

const mapCouponError = (error: unknown): string => {
  const apiError = error as Partial<ApiError> | null;
  if (apiError?.code === 'NETWORK_ERROR') {
    return 'تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مجددًا.';
  }
  return apiError?.message ?? 'كود الخصم غير صالح أو منتهي الصلاحية.';
};

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();

  const { data: cart, isLoading: isCartLoading, isError: isCartSyncError } = useCart();
  const updateItemMutation = useUpdateCartItem();
  const removeItemMutation = useRemoveCartItem();
  const applyCouponMutation = useApplyCoupon();
  const removeCouponMutation = useRemoveCoupon();

  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState('');

  const [pendingRemoval, setPendingRemoval] = useState<CartItem | null>(null);
  const removalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRemovalRef = useRef<CartItem | null>(null);

  useEffect(() => {
    pendingRemovalRef.current = pendingRemoval;
  }, [pendingRemoval]);

  useEffect(() => () => {
    if (removalTimerRef.current) {
      clearTimeout(removalTimerRef.current);
    }
    // A removal that was only deferred (for the undo window) still needs to
    // actually happen if the user navigates away before the timer fires.
    if (pendingRemovalRef.current) {
      removeItemMutation.mutate({ key: pendingRemovalRef.current.key });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = cart?.items ?? [];
  const visibleItems = items.filter((item) => item.key !== pendingRemoval?.key);
  const isEmpty = !isCartLoading && visibleItems.length === 0;

  const currencySymbol = cart?.totals?.currency_symbol || 'ل.س';
  const subtotal = parseMoney(cart?.totals.total_items);
  const shippingAmount = parseMoney(cart?.totals.total_shipping);
  const discountAmount = parseMoney(cart?.totals.total_discount);
  const total = parseMoney(cart?.totals.total_price);
  const hasSelectedShippingRate = !!cart?.shipping_rates?.some(
    (pkg) => pkg.shipping_rates?.some((rate) => rate.selected)
  );
  // shipping_total only reflects a *selected* rate — if rates exist but none is
  // selected yet (e.g. no shipping address entered), the total is 0 even though
  // shipping isn't actually free, so don't show "0" as if it were.
  const shippingUndetermined = !cart || (cart.needs_shipping && shippingAmount === 0 && !hasSelectedShippingRate);

  const { data: bootstrapData } = useQuery({
    queryKey: ['bootstrap'],
    queryFn: BootstrapService.getBootstrapData,
    staleTime: 5 * 60 * 1000,
  });

  const couponCode = cart?.coupons?.[0]?.code ?? null;

  const freeShippingMin = bootstrapData?.free_shipping_min ?? null;
  const freeShippingRemaining = freeShippingMin ? Math.max(0, freeShippingMin - subtotal) : 0;
  const freeShippingProgress = freeShippingMin ? Math.min(1, subtotal / freeShippingMin) : 0;
  const freeShippingQualified = !!freeShippingMin && freeShippingRemaining <= 0;

  const handleCheckout = () => {
    navigation.navigate('Checkout');
  };

  const handleRequestRemove = (item: CartItem) => {
    if (removalTimerRef.current) {
      clearTimeout(removalTimerRef.current);
    }
    if (pendingRemoval) {
      removeItemMutation.mutate({ key: pendingRemoval.key });
    }

    setPendingRemoval(item);
    removalTimerRef.current = setTimeout(() => {
      removeItemMutation.mutate({ key: item.key });
      setPendingRemoval(null);
      removalTimerRef.current = null;
    }, 5000);
  };

  const handleUndoRemove = () => {
    if (removalTimerRef.current) {
      clearTimeout(removalTimerRef.current);
      removalTimerRef.current = null;
    }
    setPendingRemoval(null);
  };

  const handleIncrement = (item: CartItem) => {
    const limit = item.quantity_limits?.maximum;
    if (typeof limit === 'number' && limit > 0 && item.quantity >= limit) {
      Alert.alert('الكمية المتوفرة محدودة', `الكمية المتوفرة في المخزون: ${limit} فقط.`);
      return;
    }
    updateItemMutation.mutate({ key: item.key, quantity: item.quantity + 1 });
  };

  const handleDecrement = (item: CartItem) => {
    if (item.quantity - 1 <= 0) {
      removeItemMutation.mutate({ key: item.key });
      return;
    }
    updateItemMutation.mutate({ key: item.key, quantity: item.quantity - 1 });
  };

  const handleApplyCoupon = () => {
    const code = couponInput.trim();
    if (!code) return;

    setCouponError('');
    applyCouponMutation.mutate(
      { code },
      {
        onSuccess: () => setCouponInput(''),
        onError: (error) => setCouponError(mapCouponError(error)),
      }
    );
  };

  const handleRemoveCoupon = () => {
    if (!couponCode) return;
    removeCouponMutation.mutate({ code: couponCode });
  };

  const renderCartItem = (item: CartItem) => {
    const stockLimit = item.quantity_limits?.maximum;
    const isAtStockLimit = typeof stockLimit === 'number' && stockLimit > 0 && item.quantity >= stockLimit;
    const isRowUpdating =
      (updateItemMutation.isPending && updateItemMutation.variables?.key === item.key) ||
      (removeItemMutation.isPending && removeItemMutation.variables?.key === item.key);
    const unitPrice = parseFloat(item.prices.price);
    const regularPrice = parseFloat(item.prices.regular_price);
    const isOnSale = regularPrice > unitPrice;

    return (
      <View key={item.key} style={styles.cartItem}>
        <FastImage source={{ uri: resolveMediaUrl(item.images[0]?.src ?? '') }} style={styles.itemImage} resizeMode={FastImage.resizeMode.contain} />
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
          <View style={styles.itemPriceRow}>
            <Text style={styles.itemPrice}>
              {formatNumber(unitPrice)} ل.س
            </Text>
            {isOnSale && (
              <Text style={styles.itemOldPrice}>
                {formatNumber(regularPrice)}
              </Text>
            )}
          </View>
          <View style={styles.itemActions}>
            <View style={styles.qtyControls}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => handleDecrement(item)}
                disabled={isRowUpdating}
                accessibilityRole="button"
                accessibilityLabel="إنقاص الكمية"
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text style={styles.qtyBtnText}>−</Text>
              </TouchableOpacity>
              {isRowUpdating ? (
                <ActivityIndicator size="small" color={Colors.textSecondary} style={styles.qtyValue} />
              ) : (
                <Text style={styles.qtyValue}>{item.quantity}</Text>
              )}
              <TouchableOpacity
                style={[styles.qtyBtn, isAtStockLimit && styles.qtyBtnDisabled]}
                onPress={() => handleIncrement(item)}
                disabled={isAtStockLimit || isRowUpdating}
                accessibilityRole="button"
                accessibilityLabel="زيادة الكمية"
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text style={[styles.qtyBtnText, isAtStockLimit && styles.qtyBtnTextDisabled]}>+</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => handleRequestRemove(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={`حذف ${item.name}`}
            >
              <Text style={styles.removeText}>حذف</Text>
            </TouchableOpacity>
          </View>
          {isAtStockLimit && (
            <Text style={styles.stockLimitText}>الكمية المتوفرة في المخزون: {stockLimit} فقط</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing[2] }]}>
        <Text style={styles.title}>سلة التسوق</Text>
        <Text style={styles.itemCount}>{visibleItems.length} منتج</Text>
      </View>

      {!isEmpty && freeShippingMin ? (
        <View style={styles.freeShippingCard}>
          {freeShippingQualified ? (
            <View style={styles.freeShippingRow}>
              <MaterialCommunityIcons name="truck-check-outline" style={styles.freeShippingIconDone} />
              <Text style={styles.freeShippingTextDone}>لقد حصلت على شحن مجاني!</Text>
            </View>
          ) : (
            <Text style={styles.freeShippingText}>
              أضف {formatPrice(freeShippingRemaining, currencySymbol)} أخرى للحصول على شحن مجاني
            </Text>
          )}
          <View style={styles.freeShippingTrack}>
            <View style={[styles.freeShippingFill, { width: `${freeShippingProgress * 100}%` }]} />
          </View>
        </View>
      ) : null}

      {isCartLoading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : isEmpty ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="cart-outline" style={styles.emptyIcon} />
          <Text style={styles.emptyTitle}>سلتك فارغة</Text>
          <Text style={styles.emptySubtitle}>ابدأ بإضافة المنتجات إلى سلة التسوق</Text>
          <TouchableOpacity
            style={styles.shopBtn}
            onPress={() => navigation.getParent()?.navigate('Home')}
          >
            <Text style={styles.shopBtnText}>تسوّق الآن</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Cart Items */}
            <View style={styles.itemsContainer}>
              {visibleItems.map(renderCartItem)}
            </View>

            {pendingRemoval && (
              <View style={styles.undoBanner}>
                <Text style={styles.undoText}>تم حذف "{pendingRemoval.name}"</Text>
                <TouchableOpacity onPress={handleUndoRemove}>
                  <Text style={styles.undoAction}>تراجع</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Coupon Section */}
            <View style={styles.couponSection}>
              <Text style={styles.couponLabel}>كود الخصم</Text>
              {couponCode ? (
                <View style={styles.couponApplied}>
                  <Text style={styles.couponCodeText}>{couponCode}</Text>
                  <TouchableOpacity
                    onPress={handleRemoveCoupon}
                    disabled={removeCouponMutation.isPending}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityRole="button"
                    accessibilityLabel="إزالة كود الخصم"
                    accessibilityState={{ disabled: removeCouponMutation.isPending, busy: removeCouponMutation.isPending }}
                  >
                    {removeCouponMutation.isPending ? (
                      <ActivityIndicator size="small" color={Colors.error} />
                    ) : (
                      <Text style={styles.couponRemove}>إزالة</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={styles.couponInputRow}>
                    <TextInput
                      style={styles.couponInput}
                      placeholder="أدخل كود الخصم"
                      placeholderTextColor={Colors.placeholder}
                      value={couponInput}
                      onChangeText={setCouponInput}
                      textAlign="right"
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={[styles.couponApplyBtn, applyCouponMutation.isPending && styles.disabledBtn]}
                      onPress={handleApplyCoupon}
                      disabled={applyCouponMutation.isPending}
                    >
                      {applyCouponMutation.isPending ? (
                        <ActivityIndicator size="small" color={Colors.textInverse} />
                      ) : (
                        <Text style={styles.couponApplyText}>تطبيق</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                  {couponError ? <Text style={styles.couponErrorText}>{couponError}</Text> : null}
                </>
              )}
            </View>

            {isCartSyncError && (
              <View style={styles.syncErrorBanner}>
                <MaterialCommunityIcons name="alert-circle-outline" style={styles.syncErrorIcon} />
                <Text style={styles.syncErrorText}>
                  تعذر تحديث الأسعار من الخادم. المبلغ الظاهر تقديري وسيُعاد التحقق منه عند إتمام الطلب.
                </Text>
              </View>
            )}

            <View style={styles.bottomSpacer} />
          </ScrollView>

          {/* Bottom Summary */}
          <View style={styles.bottomBar}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>المجموع الفرعي</Text>
              <Text style={styles.summaryValue}>{formatPrice(subtotal, currencySymbol)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>الشحن</Text>
              <Text style={styles.summaryValue}>
                {shippingUndetermined ? 'يُحسب عند الدفع' : formatPrice(shippingAmount, currencySymbol)}
              </Text>
            </View>
            {discountAmount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>الخصم</Text>
                <Text style={[styles.summaryValue, { color: Colors.success }]}>
                  - {formatPrice(discountAmount, currencySymbol)}
                </Text>
              </View>
            )}
            <View style={[styles.summaryRow, styles.summaryTotal]}>
              <Text style={styles.totalLabel}>الإجمالي</Text>
              <Text style={styles.totalValue}>{formatPrice(total, currencySymbol)}</Text>
            </View>
            <TouchableOpacity style={styles.checkoutBtn} onPress={handleCheckout}>
              <Text style={styles.checkoutText}>متابعة الشراء</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.secondary, paddingTop: Spacing[10], paddingBottom: Spacing[4],
    paddingHorizontal: Spacing[5], flexDirection: 'row-reverse', justifyContent: 'space-between',
    alignItems: 'baseline',
    borderBottomLeftRadius: BorderRadius['2xl'],
    borderBottomRightRadius: BorderRadius['2xl'],
  },
  title: { ...Typography.h2, color: Colors.textInverse, fontFamily: FontFamily.arabicBold },
  itemCount: { ...Typography.label, color: 'rgba(255,255,255,0.75)' },
  scrollView: { flex: 1 },

  // Empty State
  freeShippingCard: {
    backgroundColor: Colors.surface, marginHorizontal: Spacing[4], marginTop: Spacing[3],
    borderRadius: BorderRadius.lg, padding: Spacing[4], ...Shadows.xs, borderWidth: 1, borderColor: Colors.borderLight,
  },
  freeShippingText: { ...Typography.bodySmall, color: Colors.textPrimary, fontFamily: FontFamily.arabicMedium, textAlign: 'right', marginBottom: Spacing[2] },
  freeShippingRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing[1.5], marginBottom: Spacing[2] },
  freeShippingIconDone: { fontSize: 18, color: Colors.success },
  freeShippingTextDone: { ...Typography.bodySmall, color: Colors.success, fontFamily: FontFamily.arabicBold },
  freeShippingTrack: { height: 6, borderRadius: BorderRadius.full, backgroundColor: Colors.border, overflow: 'hidden' },
  freeShippingFill: { height: '100%', borderRadius: BorderRadius.full, backgroundColor: Colors.primary },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing[8] },
  emptyIcon: { fontSize: 64, marginBottom: Spacing[4] },
  emptyTitle: { ...Typography.h3, color: Colors.textPrimary, fontFamily: FontFamily.arabicBold, marginBottom: Spacing[2] },
  emptySubtitle: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing[6] },
  shopBtn: { backgroundColor: Colors.secondary, borderRadius: BorderRadius.xl, paddingHorizontal: Spacing[8], paddingVertical: Spacing[3] },
  shopBtnText: { ...Typography.button, color: Colors.textInverse, fontFamily: FontFamily.arabicBold },

  // Cart Items
  itemsContainer: { padding: Spacing[4], gap: Spacing[3] },
  cartItem: {
    flexDirection: 'row-reverse', backgroundColor: Colors.card, borderRadius: BorderRadius.lg,
    padding: Spacing[3], gap: Spacing[3], ...Shadows.xs, borderWidth: 1, borderColor: Colors.borderLight,
  },
  itemImage: { width: 90, height: 90, borderRadius: BorderRadius.md, backgroundColor: Colors.surfaceSecondary },
  itemInfo: { flex: 1, gap: Spacing[1.5] },
  itemName: { ...Typography.bodySmall, color: Colors.textPrimary, fontFamily: FontFamily.arabicMedium, textAlign: 'right' },
  itemPriceRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing[2] },
  itemPrice: { ...Typography.priceSmall, color: Colors.sale, fontFamily: FontFamily.arabicBold },
  itemOldPrice: { ...Typography.caption, color: Colors.textTertiary, textDecorationLine: 'line-through' },
  itemActions: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing[1] },
  qtyControls: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing[2], borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, paddingHorizontal: Spacing[1] },
  qtyBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  qtyBtnDisabled: { opacity: 0.4 },
  qtyBtnText: { fontSize: 16, color: Colors.textPrimary, fontWeight: '600' },
  qtyBtnTextDisabled: { color: Colors.textTertiary },
  qtyValue: { ...Typography.label, color: Colors.textPrimary, minWidth: 20, textAlign: 'center' },
  removeText: { ...Typography.labelSmall, color: Colors.error },
  stockLimitText: { ...Typography.caption, color: Colors.warning, textAlign: 'right', marginTop: Spacing[1] },

  // Undo banner
  undoBanner: {
    flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.secondary, marginHorizontal: Spacing[4], borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing[4], paddingVertical: Spacing[3], marginBottom: Spacing[2],
  },
  undoText: { ...Typography.bodySmall, color: Colors.textInverse, flex: 1, textAlign: 'right', marginRight: Spacing[3] },
  undoAction: { ...Typography.labelLarge, color: Colors.primary, fontFamily: FontFamily.arabicBold },

  // Coupon
  couponSection: {
    backgroundColor: Colors.surface, marginHorizontal: Spacing[4], marginTop: Spacing[2],
    borderRadius: BorderRadius.lg, padding: Spacing[4], ...Shadows.card,
  },
  couponLabel: { ...Typography.labelLarge, color: Colors.textPrimary, fontFamily: FontFamily.arabicMedium, textAlign: 'right', marginBottom: Spacing[2] },
  couponInputRow: { flexDirection: 'row-reverse', gap: Spacing[2] },
  couponInput: {
    flex: 1, backgroundColor: Colors.inputBackground, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.inputBorder, paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2], fontSize: FontSize.base, color: Colors.textPrimary,
  },
  couponApplyBtn: { backgroundColor: Colors.secondary, borderRadius: BorderRadius.md, paddingHorizontal: Spacing[4], justifyContent: 'center', minWidth: 80, alignItems: 'center' },
  couponApplyText: { ...Typography.buttonSmall, color: Colors.textInverse },
  disabledBtn: { opacity: 0.6 },
  couponErrorText: { ...Typography.caption, color: Colors.error, textAlign: 'right', marginTop: Spacing[2] },
  couponApplied: {
    flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.successLight, borderRadius: BorderRadius.md, padding: Spacing[3],
  },
  couponCodeText: { ...Typography.labelLarge, color: Colors.success, fontFamily: FontFamily.bold },
  couponRemove: { ...Typography.labelSmall, color: Colors.error },

  // Sync error
  syncErrorBanner: {
    flexDirection: 'row-reverse', alignItems: 'flex-start', gap: Spacing[2],
    marginHorizontal: Spacing[4], marginTop: Spacing[3], backgroundColor: Colors.warningLight,
    borderRadius: BorderRadius.md, padding: Spacing[3],
  },
  syncErrorIcon: { fontSize: 18, color: Colors.warning, marginTop: 2 },
  syncErrorText: { ...Typography.caption, color: Colors.textSecondary, flex: 1, textAlign: 'right' },

  // Bottom Bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surface, padding: Spacing[5], paddingBottom: Spacing[8],
    ...Shadows.xl, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  summaryRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: Spacing[2] },
  summaryLabel: { ...Typography.body, color: Colors.textSecondary },
  summaryValue: { ...Typography.bodySmall, color: Colors.textPrimary, fontFamily: FontFamily.arabicMedium },
  summaryTotal: { marginTop: Spacing[1], paddingTop: Spacing[3], borderTopWidth: 1, borderTopColor: Colors.divider, marginBottom: Spacing[3] },
  totalLabel: { ...Typography.bodyLarge, color: Colors.textPrimary, fontFamily: FontFamily.arabicMedium },
  totalValue: { ...Typography.priceLarge, color: Colors.textPrimary, fontFamily: FontFamily.arabicBold },
  checkoutBtn: {
    backgroundColor: Colors.secondary, borderRadius: BorderRadius.xl,
    paddingVertical: Spacing[4], alignItems: 'center',
  },
  checkoutText: { ...Typography.button, color: Colors.textInverse, fontFamily: FontFamily.arabicBold },
  bottomSpacer: { height: 220 },
});
