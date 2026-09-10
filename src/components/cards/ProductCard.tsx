/**
 * ProductCard – Noon-inspired professional product card.
 * Displays image, name, price, discount badge, and action buttons.
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert, ActivityIndicator,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { Product, Cart, getDiscountPercent } from '../../types';
import { Colors } from '../../theme/colors';
import { Typography, FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { Shadows } from '../../theme/shadows';
import { useAddToCart, CART_QUERY_KEY } from '../../hooks/useCart';
import { useWishlistStore } from '../../store/wishlistStore';
import { buildFastImageSource, resolveMediaUrl } from '../../utils/media';
import { formatNumber } from '../../utils/formatters';
import AddToCartSuccessModal from '../feedback/AddToCartSuccessModal';
import NotifyMeModal from '../feedback/NotifyMeModal';
import { ProductsService } from '../../api/products.service';
import { isProductUnavailable } from '../../utils/productAvailability';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - Spacing[5] * 2 - Spacing[3]) / 2;

interface ProductCardProps {
  product: Product;
  onPress: (product: Product) => void;
  horizontal?: boolean; // For horizontal lists
}

function ProductCard({ product, onPress, horizontal = false }: ProductCardProps) {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const addToCartMutation = useAddToCart();
  const wishlisted = useWishlistStore((s) =>
    s.items.some((item) => item.product_id === product.id)
  );
  const addToWishlist = useWishlistStore((s) => s.addItem);
  const removeFromWishlist = useWishlistStore((s) => s.removeItem);
  const legacyProduct = product as Product & {
    price?: string;
    regular_price?: string;
    sale_price?: string;
  };

  const discountPercent = getDiscountPercent(product);
  const isOutOfStock = isProductUnavailable(product);
  const imageUrl = resolveMediaUrl(product.images[0]?.src);
  const [showAddSuccessModal, setShowAddSuccessModal] = useState(false);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  
  const pickFirstNonEmpty = (...values: Array<string | number | undefined | null>) =>
    values.find((value) => value !== undefined && value !== null && String(value).trim() !== '');

  // Clean price string: handle strings, Arabic digits, and thousand separators safely
  const cleanPrice = (val: any) => {
    if (val === undefined || val === null || val === '') return '0';
    const str = String(val)
      .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
      .replace(/٫/g, '.')
      .replace(/٬/g, ',');

    // Remove currency/extra chars, keep separators then normalize them
    const stripped = str.replace(/[^\d.,]/g, '');
    const hasDot = stripped.includes('.');
    const hasComma = stripped.includes(',');

    let normalized = stripped;
    if (hasDot && hasComma) {
      normalized = stripped.replace(/,/g, '');
    } else if (!hasDot && hasComma) {
      const commas = stripped.match(/,/g)?.length ?? 0;
      const [intPart = '', decPart = ''] = stripped.split(',');
      const looksLikeDecimal = commas === 1 && decPart.length > 0 && decPart.length <= 2;
      normalized = looksLikeDecimal ? `${intPart}.${decPart}` : stripped.replace(/,/g, '');
    }

    // Keep only the first decimal dot (if any)
    const firstDot = normalized.indexOf('.');
    const cleaned = firstDot >= 0
      ? `${normalized.slice(0, firstDot + 1)}${normalized.slice(firstDot + 1).replace(/\./g, '')}`
      : normalized;

    return cleaned || '0';
  };

  const price = cleanPrice(
    pickFirstNonEmpty(
      product.prices?.price,
      product.on_sale ? legacyProduct.sale_price : undefined,
      legacyProduct.price,
      legacyProduct.regular_price,
      product.prices?.regular_price,
      '0',
    )
  );

  const regularPrice = cleanPrice(
    pickFirstNonEmpty(
      product.prices?.regular_price,
      legacyProduct.regular_price,
      legacyProduct.price,
      product.prices?.price,
      price,
      '0',
    )
  );

  const salePrice = cleanPrice(
    pickFirstNonEmpty(
      product.prices?.sale_price,
      legacyProduct.sale_price,
      product.prices?.price,
      legacyProduct.price,
      price,
      '0',
    )
  );

  const handleAddToCart = useCallback(() => {
    if (isOutOfStock) return;
    if (product.type === 'variable') {
      onPress(product);
      return;
    }

    const lowStockRemaining = product.low_stock_remaining;
    if (typeof lowStockRemaining === 'number' && lowStockRemaining > 0) {
      const cart = queryClient.getQueryData<Cart>(CART_QUERY_KEY);
      const existingQty = cart?.items.find((i) => i.id === product.id)?.quantity ?? 0;
      if (existingQty >= lowStockRemaining) {
        Alert.alert('تنبيه', `الكمية المتوفرة في المخزون: ${lowStockRemaining} فقط`);
        return;
      }
    }

    addToCartMutation.mutate(
      { productId: product.id, quantity: 1 },
      {
        onSuccess: () => setShowAddSuccessModal(true),
        onError: () => Alert.alert('تعذّرت الإضافة', 'حدث خطأ أثناء إضافة المنتج إلى السلة. يرجى المحاولة مرة أخرى.'),
      }
    );
  }, [addToCartMutation, onPress, product, isOutOfStock, queryClient]);

  const handleGoToCart = useCallback(() => {
    setShowAddSuccessModal(false);

    const parent = navigation.getParent?.();
    const grandParent = parent?.getParent?.();

    if (parent?.getState?.()?.routeNames?.includes('Cart')) {
      parent.navigate('Cart');
      return;
    }

    if (grandParent?.getState?.()?.routeNames?.includes('Cart')) {
      grandParent.navigate('Cart');
      return;
    }

    navigation.navigate('Cart');
  }, [navigation]);

  const handleWishlistToggle = useCallback(() => {
    if (wishlisted) {
      removeFromWishlist(product.id);
    } else {
      addToWishlist({
        product_id: product.id,
        name: product.name,
        image: imageUrl,
        price: price,
        regular_price: regularPrice,
        sale_price: salePrice,
        on_sale: product.on_sale,
        in_stock: !isOutOfStock,
        slug: product.slug,
        added_at: new Date().toISOString(),
      });
    }
  }, [wishlisted, product, price, regularPrice, salePrice, imageUrl, isOutOfStock, addToWishlist, removeFromWishlist]);

  const cardStyle = horizontal
    ? [styles.card, styles.cardHorizontal]
    : [styles.card, { width: CARD_WIDTH }];

  return (
    <>
      <TouchableOpacity
        style={cardStyle}
        onPress={() => onPress(product)}
        activeOpacity={0.9}
      >
      {/* Image Container */}
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <FastImage
            source={buildFastImageSource(imageUrl, horizontal ? 'high' : 'normal')}
            style={horizontal ? styles.imageHorizontal : styles.image}
            resizeMode={FastImage.resizeMode.contain}
          />
        ) : (
          <View style={[horizontal ? styles.imageHorizontal : styles.image, styles.imageFallbackContainer]}>
            <MaterialCommunityIcons name="package-variant-closed" style={styles.imageFallbackText} />
          </View>
        )}

        {/* Discount Badge */}
        {discountPercent && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>-{discountPercent}%</Text>
          </View>
        )}

        {/* Out of Stock Overlay */}
        {isOutOfStock && (
          <View style={styles.outOfStockOverlay}>
            <Text style={styles.outOfStockText}>نفذت الكمية</Text>
          </View>
        )}

        {/* Wishlist Button */}
        <TouchableOpacity
          style={styles.wishlistBtn}
          onPress={handleWishlistToggle}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={wishlisted ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
        >
          <MaterialCommunityIcons
            name={wishlisted ? 'heart' : 'heart-outline'}
            style={[styles.wishlistIcon, wishlisted && styles.wishlistActive]}
          />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>

        {/* Rating */}
        {parseFloat(product.average_rating) > 0 && (
          <View style={styles.ratingRow}>
            <MaterialCommunityIcons name="star" style={styles.ratingStar} />
            <Text style={styles.ratingText}>{parseFloat(product.average_rating).toFixed(1)}</Text>
            {(() => {
              const reviewCount = product.review_count ?? product.rating_count ?? 0;
              return reviewCount > 0 ? (
                <Text style={styles.ratingCount}>({reviewCount})</Text>
              ) : null;
            })()}
          </View>
        )}

        {/* Price */}
        <View style={styles.priceRow}>
          <Text style={styles.price}>
            {parseFloat(price) > 0
              ? formatNumber(parseFloat(price) || 0)
              : '0'} ل.س
          </Text>
          {product.on_sale && regularPrice && parseFloat(regularPrice) > 0 && parseFloat(regularPrice) > parseFloat(price) && (
            <Text style={styles.regularPrice}>
              {formatNumber(parseFloat(regularPrice) || 0)}
            </Text>
          )}
        </View>

        {/* Add to Cart */}
        <TouchableOpacity
          style={[styles.cartBtn, isOutOfStock && styles.cartBtnOutOfStock]}
          onPress={isOutOfStock ? () => setShowNotifyModal(true) : handleAddToCart}
          disabled={addToCartMutation.isPending}
        >
          {addToCartMutation.isPending ? (
            <ActivityIndicator size="small" color={Colors.secondary} />
          ) : (
            <Text style={styles.cartBtnText}>
              {isOutOfStock
                ? 'أعلمني عند التوفر'
                : product.type === 'variable'
                  ? 'عرض الخيارات'
                  : 'إضافة للسلة'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
      </TouchableOpacity>

      <NotifyMeModal
        visible={showNotifyModal}
        onClose={() => setShowNotifyModal(false)}
        onSubmit={(phone) => ProductsService.requestStockNotification(product.id, phone)}
      />

      <AddToCartSuccessModal
        visible={showAddSuccessModal}
        onContinueShopping={() => setShowAddSuccessModal(false)}
        onGoToCart={handleGoToCart}
      />
    </>
  );
}

export default React.memo(ProductCard);

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
    ...Shadows.xs,
    marginBottom: Spacing[3],
  },
  cardHorizontal: {
    width: 180,
    marginRight: Spacing[3],
  },
  imageContainer: {
    position: 'relative',
    backgroundColor: Colors.surfaceSecondary,
  },
  image: {
    width: '100%',
    height: CARD_WIDTH - 16,
    backgroundColor: Colors.surfaceSecondary,
  },
  imageHorizontal: {
    width: 180,
    height: 160,
    backgroundColor: Colors.surfaceSecondary,
  },
  imageFallbackContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageFallbackText: {
    fontSize: 28,
    color: Colors.textTertiary,
  },
  discountBadge: {
    position: 'absolute',
    top: Spacing[2],
    left: Spacing[2],
    backgroundColor: Colors.sale,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing[1.5],
    paddingVertical: 2,
    zIndex: 10,
  },
  discountText: {
    ...Typography.caption,
    color: Colors.textInverse,
    fontFamily: FontFamily.bold,
  },
  outOfStockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outOfStockText: {
    ...Typography.label,
    color: Colors.textSecondary,
    fontFamily: FontFamily.arabicSemiBold,
  },
  wishlistBtn: {
    position: 'absolute',
    top: Spacing[2],
    right: Spacing[2],
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.overlayWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wishlistIcon: {
    fontSize: 20,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  wishlistActive: {
    color: Colors.error,
  },

  content: {
    padding: Spacing[3],
    gap: Spacing[1.5],
  },
  name: {
    ...Typography.bodySmall,
    color: Colors.textPrimary,
    fontFamily: FontFamily.arabicMedium,
    textAlign: 'right',
    lineHeight: 18,
  },
  ratingRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
  },
  ratingStar: { fontSize: 12, color: Colors.rating },
  ratingText: {
    ...Typography.labelSmall,
    color: Colors.rating,
    fontFamily: FontFamily.bold,
  },
  ratingCount: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  priceRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: Spacing[2],
  },
  price: {
    ...Typography.priceSmall,
    color: Colors.sale,
    fontFamily: FontFamily.arabicBold,
  },
  regularPrice: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  cartBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing[2.5],
    alignItems: 'center',
    marginTop: Spacing[1],
  },
  cartBtnOutOfStock: {
    backgroundColor: Colors.border,
  },
  cartBtnText: {
    fontSize: FontSize.xs,
    color: Colors.secondary,
    fontFamily: FontFamily.arabicBold,
    fontWeight: '700',
  },
});
