/**
 * FloatingCartBar – Persistent cart summary shown while browsing
 * (Home, Categories, product lists, wishlist, search) so the cart
 * is never more than one tap away, and the running total stays visible.
 *
 * Positioned with a small fixed offset from the screen's own bottom edge —
 * NOT tab-bar-height + offset. React Navigation's bottom tabs (opaque,
 * non-translucent here) already size each screen's content area to stop
 * above the tab bar on both iOS and Android, so adding the tab bar's
 * height again double-subtracts and pushes this bar up into the content.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useCart } from '../../hooks/useCart';
import { Colors } from '../../theme/colors';
import { Typography, FontFamily } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { Shadows } from '../../theme/shadows';
import { formatPrice } from '../../utils/formatters';

export default function FloatingCartBar() {
  const navigation = useNavigation<any>();
  const { data: cart } = useCart();
  const count = cart?.items_count ?? 0;
  const total = parseFloat(cart?.totals?.total_price ?? '0') || 0;

  if (count === 0) {
    return null;
  }

  const handlePress = () => {
    navigation.getParent()?.navigate('Cart');
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.9}
    >
      <View style={styles.countBadge}>
        <Text style={styles.countText}>{count > 99 ? '99+' : count}</Text>
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {count} منتج · {formatPrice(total)}
      </Text>
      <Text style={styles.cta}>إتمام الشراء</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing[4],
    right: Spacing[4],
    bottom: Spacing[5],
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[4],
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: Spacing[2],
    ...Shadows.xl,
  },
  countBadge: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countText: {
    ...Typography.labelSmall,
    color: Colors.secondary,
    fontFamily: FontFamily.bold,
  },
  label: {
    ...Typography.bodySmall,
    color: Colors.textInverse,
    flex: 1,
    textAlign: 'right',
    fontFamily: FontFamily.arabicMedium,
  },
  cta: {
    ...Typography.labelLarge,
    color: Colors.primary,
    fontFamily: FontFamily.arabicBold,
  },
});
