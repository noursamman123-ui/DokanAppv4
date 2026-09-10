import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, StatusBar, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import FastImage from 'react-native-fast-image';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { AccountStackParamList } from '../../../navigation/types';
import { OrdersService } from '../../../api/orders.service';
import { CartService } from '../../../api/cart.service';
import { CART_QUERY_KEY } from '../../../hooks/useCart';
import { Order } from '../../../types';
import { Colors } from '../../../theme/colors';
import { Typography, FontFamily } from '../../../theme/typography';
import { Spacing, BorderRadius } from '../../../theme/spacing';
import { Shadows } from '../../../theme/shadows';
import { formatPrice } from '../../../utils/formatters';
import { useAuthStore } from '../../../store/authStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import OrderStatusTimeline from '../../../components/orders/OrderStatusTimeline';

type RoutePropType = RouteProp<AccountStackParamList, 'OrderDetail'>;

export default function OrderDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RoutePropType>();
  const { orderId, orderKey } = route.params;
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accountPhone = (user?.phone ?? user?.shipping?.phone ?? user?.billing?.phone ?? '').trim();
  const queryClient = useQueryClient();
  const [isReordering, setIsReordering] = useState(false);

  // Guests have no session — the order's own key (saved on-device at
  // checkout) authorizes viewing it, same as WooCommerce's order-pay links.
  const { data: order, isLoading } = useQuery({
    queryKey: ['order', orderId, accountPhone, orderKey],
    queryFn: () =>
      isAuthenticated
        ? OrdersService.getOrder(orderId, accountPhone)
        : OrdersService.getGuestOrderByKey(orderId, orderKey ?? ''),
    enabled: isAuthenticated || !!orderKey,
  });

  if (isLoading || !order) {
    return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  const displayOrderNumber = order.number?.trim() || String(order.id);
  const getShippingDuration = (targetOrder: Order) => {
    if (targetOrder.shipping_duration?.trim()) {
      return targetOrder.shipping_duration.trim();
    }

    const directDuration = targetOrder.shipping_lines?.find((line) => line.delivery_time?.trim())?.delivery_time;
    if (directDuration?.trim()) {
      return directDuration.trim();
    }

    for (const line of targetOrder.shipping_lines ?? []) {
      for (const meta of line.meta_data ?? []) {
        const key = (meta.key ?? '').toLowerCase().trim();
        const value = (meta.value ?? '').trim();
        if (value && ['delivery_time', '_delivery_time', 'shipping_duration', '_shipping_duration', 'estimated_delivery', '_estimated_delivery'].includes(key)) {
          return value;
        }
      }
    }

    return 'غير محددة';
  };

  const handleReorder = async () => {
    setIsReordering(true);
    const failures: string[] = [];

    // Sequential for the same reason placeOrder's steps are sequential — the
    // WC Store API cart is a single shared session resource, and concurrent
    // add-item calls risk a lost update.
    for (const item of order.line_items) {
      try {
        await CartService.addItem(item.product_id, item.quantity, item.variation_id || undefined);
      } catch {
        failures.push(item.name);
      }
    }

    queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
    setIsReordering(false);

    if (failures.length === order.line_items.length) {
      Alert.alert('تعذّرت إعادة الطلب', 'تعذّر إضافة المنتجات إلى السلة. يرجى المحاولة مرة أخرى.');
      return;
    }
    if (failures.length > 0) {
      Alert.alert('تمت الإضافة جزئيًا', `تعذّرت إضافة: ${failures.join('، ')}`);
    }
    (navigation as any).getParent?.()?.navigate('Cart');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + Spacing[2] }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.title}>طلب #{displayOrderNumber}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>حالة الطلب</Text>
          <OrderStatusTimeline
            status={order.status}
            dateCreated={order.date_created}
            dateModified={order.date_modified}
          />
        </View>
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>المنتجات</Text>
            <TouchableOpacity
              style={styles.reorderBtn}
              onPress={handleReorder}
              disabled={isReordering}
              accessibilityRole="button"
              accessibilityLabel="اطلب مجدداً"
              accessibilityState={{ disabled: isReordering, busy: isReordering }}
            >
              {isReordering ? (
                <ActivityIndicator size="small" color={Colors.primaryDark} />
              ) : (
                <>
                  <MaterialCommunityIcons name="cart-plus" style={styles.reorderIcon} />
                  <Text style={styles.reorderText}>اطلب مجدداً</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          {order.line_items.map((item) => (
            <View key={item.id} style={styles.lineItem}>
              <FastImage source={{ uri: item.image?.src ?? '' }} style={styles.itemImage} resizeMode={FastImage.resizeMode.contain} />
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.itemQty}>الكمية: {item.quantity}</Text>
                <Text style={styles.itemTotal}>{formatPrice(item.total, order.currency_symbol)}</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>العنوان</Text>
          <Text style={styles.address}>{order.shipping.first_name} {order.shipping.last_name}</Text>
          <Text style={styles.address}>{order.shipping.address_1}, {order.shipping.city}</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ملخص</Text>
          <InfoRow label="طريقة الدفع" value={order.payment_method_title} />
          <InfoRow label="الشحن" value={formatPrice(order.shipping_total ?? '0', order.currency_symbol)} />
          <InfoRow label="مدة الشحن" value={getShippingDuration(order)} />
          <InfoRow label="الإجمالي" value={formatPrice(order.total, order.currency_symbol)} bold />
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, bold && styles.infoValueBold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: Colors.surface, paddingTop: Spacing[10], paddingBottom: Spacing[3],
    paddingHorizontal: Spacing[4], flexDirection: 'row-reverse', alignItems: 'center',
    justifyContent: 'space-between', ...Shadows.sm,
  },
  backIcon: { fontSize: 16, color: Colors.textPrimary },
  title: { ...Typography.h4, color: Colors.textPrimary, fontFamily: FontFamily.arabicBold },
  content: { padding: Spacing[4], gap: Spacing[3] },
  section: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing[4], ...Shadows.card },
  sectionTitle: { ...Typography.h4, color: Colors.textPrimary, fontFamily: FontFamily.arabicBold, textAlign: 'right', marginBottom: Spacing[3] },
  sectionHeaderRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  reorderBtn: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing[1],
    backgroundColor: Colors.primarySurface, borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[1.5], marginBottom: Spacing[3],
  },
  reorderIcon: { fontSize: 15, color: Colors.primaryDark },
  reorderText: { ...Typography.labelSmall, color: Colors.primaryDark, fontFamily: FontFamily.arabicBold },
  lineItem: { flexDirection: 'row-reverse', gap: Spacing[3], paddingVertical: Spacing[3], borderBottomWidth: 1, borderBottomColor: Colors.divider },
  itemImage: { width: 60, height: 60, borderRadius: BorderRadius.md, backgroundColor: Colors.surfaceSecondary },
  itemInfo: { flex: 1, gap: 2 },
  itemName: { ...Typography.bodySmall, color: Colors.textPrimary, fontFamily: FontFamily.arabicMedium, textAlign: 'right' },
  itemQty: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'right' },
  itemTotal: { ...Typography.priceSmall, color: Colors.sale, fontFamily: FontFamily.arabicBold, textAlign: 'right' },
  address: { ...Typography.body, color: Colors.textSecondary, textAlign: 'right', lineHeight: 22 },
  infoRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', paddingVertical: Spacing[1.5] },
  infoLabel: { ...Typography.body, color: Colors.textSecondary },
  infoValue: { ...Typography.body, color: Colors.textPrimary, fontFamily: FontFamily.arabicMedium },
  infoValueBold: { ...Typography.priceLarge, color: Colors.sale, fontFamily: FontFamily.arabicBold },
});
