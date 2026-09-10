/**
 * Wishlist Screen – Saved items with move-to-cart and remove actions.
 */
import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import FastImage from 'react-native-fast-image';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useQuery } from '@tanstack/react-query';
import { HomeStackParamList } from '../../navigation/types';
import { useWishlistStore } from '../../store/wishlistStore';
import { useAddToCart } from '../../hooks/useCart';
import { ProductsService } from '../../api/products.service';
import { WishlistItem } from '../../types';
import { Colors } from '../../theme/colors';
import { Typography, FontFamily } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { Shadows } from '../../theme/shadows';
import FloatingCartBar from '../../components/cart/FloatingCartBar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatNumber } from '../../utils/formatters';

/** Read a product's current effective price (sale price if on sale). */
const getCurrentPrice = (prices: { price?: string; sale_price?: string } | undefined): number | null => {
  const raw = prices?.price ?? prices?.sale_price;
  const parsed = raw ? parseFloat(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

export default function WishlistScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const { items, removeItem } = useWishlistStore();
  const addToCartMutation = useAddToCart();

  // Compare each wishlist item's saved price snapshot against its live
  // current price so a real drop can be surfaced — this is in-app only
  // (checked whenever this screen is viewed), not a push/WhatsApp alert,
  // since the wishlist isn't synced to the server with a phone number.
  const { data: livePrices } = useQuery({
    queryKey: ['wishlist-live-prices', items.map((i) => i.product_id).join(',')],
    queryFn: async () => {
      const results = await Promise.all(
        items.map((item) => ProductsService.getProduct(item.product_id).catch(() => null))
      );
      const map = new Map<number, number>();
      results.forEach((product, idx) => {
        const currentPrice = product ? getCurrentPrice(product.prices) : null;
        if (currentPrice !== null) {
          map.set(items[idx].product_id, currentPrice);
        }
      });
      return map;
    },
    enabled: items.length > 0,
    staleTime: 60 * 1000,
  });

  const handleMoveToCart = useCallback((item: WishlistItem) => {
    if (!item.in_stock) return;

    addToCartMutation.mutate(
      { productId: item.product_id, quantity: 1 },
      {
        onSuccess: () => removeItem(item.product_id),
        onError: () => Alert.alert('تعذّر النقل', 'حدث خطأ أثناء نقل المنتج إلى السلة. يرجى المحاولة مرة أخرى.'),
      }
    );
  }, [addToCartMutation, removeItem]);

  const renderItem = ({ item }: { item: WishlistItem }) => {
    const savedPrice = parseFloat(item.on_sale ? item.sale_price : item.price);
    const livePrice = livePrices?.get(item.product_id) ?? null;
    const priceDropped = livePrice !== null && Number.isFinite(savedPrice) && livePrice < savedPrice;
    const displayPrice = priceDropped ? livePrice : savedPrice;

    return (
    <View style={styles.card}>
      <TouchableOpacity
        onPress={() => (navigation as any).navigate('ProductDetail', { productId: item.product_id })}
        style={styles.cardInner}
        accessibilityRole="button"
        accessibilityLabel={item.name}
      >
        <FastImage source={{ uri: item.image }} style={styles.image} resizeMode={FastImage.resizeMode.contain} />
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatNumber(displayPrice)} ل.س</Text>
            {priceDropped ? (
              <Text style={styles.oldPrice}>{formatNumber(savedPrice)}</Text>
            ) : item.on_sale && (
              <Text style={styles.oldPrice}>{formatNumber(parseFloat(item.regular_price))}</Text>
            )}
          </View>
          {priceDropped && (
            <View style={styles.priceDropBadge}>
              <MaterialCommunityIcons name="trending-down" style={styles.priceDropIcon} />
              <Text style={styles.priceDropText}>انخفض السعر!</Text>
            </View>
          )}
          <Text style={[styles.stock, !item.in_stock && styles.outOfStock]}>
            {item.in_stock ? 'متوفر' : 'غير متوفر'}
          </Text>
        </View>
      </TouchableOpacity>
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.moveBtn, !item.in_stock && styles.moveBtnDisabled]}
          onPress={() => handleMoveToCart(item)}
          disabled={!item.in_stock}
          accessibilityRole="button"
          accessibilityLabel={item.in_stock ? 'نقل للسلة' : 'غير متوفر'}
          accessibilityState={{ disabled: !item.in_stock }}
        >
          <View style={styles.moveBtnContent}>
            <MaterialCommunityIcons name="cart-outline" style={styles.moveBtnIcon} />
            <Text style={styles.moveBtnText}>{item.in_stock ? 'نقل للسلة' : 'غير متوفر'}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => removeItem(item.product_id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={`إزالة ${item.name} من المفضلة`}
        >
          <Text style={styles.removeText}>إزالة</Text>
        </TouchableOpacity>
      </View>
    </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} />
      <View style={[styles.header, { paddingTop: insets.top + Spacing[2] }]}>
        <Text style={styles.title}>المفضلة</Text>
        <Text style={styles.count}>{items.length} منتج</Text>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="heart-outline" style={styles.emptyIcon} />
          <Text style={styles.emptyTitle}>قائمة المفضلة فارغة</Text>
          <Text style={styles.emptySubtitle}>أضف منتجاتك المفضلة هنا لتتمكن من الوصول إليها بسهولة</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.product_id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      <FloatingCartBar />
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
  count: { ...Typography.label, color: 'rgba(255,255,255,0.75)' },
  list: { padding: Spacing[4], paddingBottom: 100 },
  card: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, marginBottom: Spacing[3], ...Shadows.xs, overflow: 'hidden', borderWidth: 1, borderColor: Colors.borderLight },
  cardInner: { flexDirection: 'row-reverse', padding: Spacing[3], gap: Spacing[3] },
  image: { width: 90, height: 90, borderRadius: BorderRadius.md, backgroundColor: Colors.surfaceSecondary },
  info: { flex: 1, gap: Spacing[1] },
  name: { ...Typography.bodySmall, color: Colors.textPrimary, fontFamily: FontFamily.arabicMedium, textAlign: 'right' },
  priceRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing[2] },
  price: { ...Typography.priceSmall, color: Colors.sale, fontFamily: FontFamily.arabicBold },
  oldPrice: { ...Typography.caption, color: Colors.textTertiary, textDecorationLine: 'line-through' },
  priceDropBadge: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, alignSelf: 'flex-end' },
  priceDropIcon: { fontSize: 13, color: Colors.success },
  priceDropText: { ...Typography.caption, color: Colors.success, fontFamily: FontFamily.arabicBold },
  stock: { ...Typography.caption, color: Colors.success, textAlign: 'right' },
  outOfStock: { color: Colors.error },
  actions: {
    flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: Colors.divider, paddingHorizontal: Spacing[3], paddingVertical: Spacing[2],
  },
  moveBtnContent: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing[1.5] },
  moveBtnIcon: { fontSize: 16, color: Colors.secondary },
  moveBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingHorizontal: Spacing[4], paddingVertical: Spacing[2] },
  moveBtnDisabled: { backgroundColor: Colors.textTertiary },
  moveBtnText: { ...Typography.buttonSmall, color: Colors.secondary, fontFamily: FontFamily.arabicBold },
  removeText: { ...Typography.labelSmall, color: Colors.error },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing[8] },
  emptyIcon: { fontSize: 64, marginBottom: Spacing[4], color: Colors.textTertiary },
  emptyTitle: { ...Typography.h3, color: Colors.textPrimary, fontFamily: FontFamily.arabicBold, marginBottom: Spacing[2] },
  emptySubtitle: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },
});
