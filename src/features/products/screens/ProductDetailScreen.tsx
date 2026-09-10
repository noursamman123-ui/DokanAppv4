/**
 * Product Detail Screen – Full product view with images, price, variations,
 * add to cart, wishlist, reviews, and related/upsell/cross-sell products.
 */
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList,
  Dimensions, StatusBar, ActivityIndicator, Alert, Modal, Animated,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import FastImage from 'react-native-fast-image';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeStackParamList } from '../../../navigation/types';
import { ProductsService } from '../../../api/products.service';
import { Product, ProductReview, Cart, getDiscountPercent } from '../../../types';
import { Colors } from '../../../theme/colors';
import { Typography, FontFamily } from '../../../theme/typography';
import { Spacing, BorderRadius } from '../../../theme/spacing';
import { Shadows } from '../../../theme/shadows';
import { useAddToCart, CART_QUERY_KEY } from '../../../hooks/useCart';
import { useWishlistStore } from '../../../store/wishlistStore';
import ProductCard from '../../../components/cards/ProductCard';
import { buildFastImageSource, resolveMediaUrl } from '../../../utils/media';
import { formatDate, formatNumber, stripHtml, stripHtmlPreserveStructure } from '../../../utils/formatters';
import AddToCartSuccessModal from '../../../components/feedback/AddToCartSuccessModal';
import NotifyMeModal from '../../../components/feedback/NotifyMeModal';
import { useAuthStore } from '../../../store/authStore';
import { isProductUnavailable } from '../../../utils/productAvailability';

const { width } = Dimensions.get('window');

type RoutePropType = RouteProp<HomeStackParamList, 'ProductDetail'>;

/**
 * Build a {attributeName: {termSlug: termName}} lookup from the parent
 * product's own `attributes[].terms`. Needed because each variation's own
 * attribute value (from `product.variations[].attributes[].value`) is the
 * raw taxonomy term SLUG (e.g. "navy", or a percent-encoded Arabic slug for
 * "اسود") — never the human-readable name — so it can't be shown or matched
 * against directly.
 */
const buildTermNameBySlug = (attributes: Product['attributes']): Record<string, Record<string, string>> => {
  const map: Record<string, Record<string, string>> = {};
  attributes.forEach((attr) => {
    const inner: Record<string, string> = {};
    (attr.terms ?? []).forEach((term) => {
      if (!term.slug || !term.name) return;
      inner[term.slug] = term.name;
      try {
        inner[decodeURIComponent(term.slug)] = term.name;
      } catch {
        // slug wasn't percent-encoded — ignore
      }
    });
    map[attr.name] = inner;
  });
  return map;
};

function ImageViewerModal({
  visible,
  images,
  initialIndex,
  onClose,
}: {
  visible: boolean;
  images: { src: string }[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [isZoomed, setIsZoomed] = useState(false);
  const lastTapRef = useRef(0);

  useEffect(() => {
    if (visible) {
      setIndex(initialIndex);
      setIsZoomed(false);
      scaleAnim.setValue(1);
    }
  }, [visible, initialIndex, scaleAnim]);

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      const toValue = isZoomed ? 1 : 2.2;
      Animated.spring(scaleAnim, { toValue, useNativeDriver: true, friction: 6 }).start();
      setIsZoomed(!isZoomed);
    }
    lastTapRef.current = now;
  };

  const imageUri = resolveMediaUrl(images[index]?.src);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewerBackdrop}>
        <TouchableOpacity
          style={styles.viewerCloseBtn}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="إغلاق"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons name="close" style={styles.viewerCloseIcon} />
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={1} onPress={handleTap} style={styles.viewerImageWrap}>
          {imageUri ? (
            <Animated.Image
              source={{ uri: imageUri }}
              style={[styles.viewerImage, { transform: [{ scale: scaleAnim }] }]}
              resizeMode="contain"
            />
          ) : null}
        </TouchableOpacity>

        <Text style={styles.viewerHint}>انقر مرتين للتكبير</Text>

        {images.length > 1 && (
          <View style={styles.viewerDotsRow}>
            {images.map((_, i) => (
              <View key={i} style={[styles.viewerDot, i === index && styles.viewerDotActive]} />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

export default function ProductDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const route = useRoute<RoutePropType>();
  const { productId } = route.params;

  const galleryRef = useRef<FlatList>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isViewerVisible, setIsViewerVisible] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [selectedAttrs, setSelectedAttrs] = useState<Record<string, string>>({});
  const [showAddSuccessModal, setShowAddSuccessModal] = useState(false);
  const [isNotifyModalVisible, setIsNotifyModalVisible] = useState(false);

  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const addToCartMutation = useAddToCart();
  const wishlisted = useWishlistStore((s) =>
    s.items.some((item) => item.product_id === productId)
  );
  const addToWishlist = useWishlistStore((s) => s.addItem);
  const removeFromWishlist = useWishlistStore((s) => s.removeItem);

  const cleanPrice = (val: any) => {
    if (val === undefined || val === null || val === '') return '0';
    const str = String(val);
    const cleaned = str.replace(/[^\d.,]/g, '').replace(',', '.');
    return cleaned || '0';
  };

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => ProductsService.getProduct(productId),
  });

  const { data: relatedProducts } = useQuery({
    queryKey: ['related', productId],
    queryFn: () => ProductsService.getRelated(productId),
    enabled: !!product,
  });

  const { data: variations = [] } = useQuery({
    queryKey: ['product-variations', productId],
    queryFn: () => ProductsService.getVariations(productId),
    enabled: product?.type === 'variable',
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['product-reviews', productId],
    queryFn: () => ProductsService.getReviews(productId),
    enabled: !!product,
  });

  const { data: crossSellProducts } = useQuery({
    queryKey: ['cross-sell', productId, product?.cross_sell_ids],
    queryFn: () => ProductsService.getByIds(product?.cross_sell_ids ?? []),
    enabled: !!product && (product.cross_sell_ids?.length ?? 0) > 0,
  });

  const { data: upsellProducts } = useQuery({
    queryKey: ['upsell', productId, product?.upsell_ids],
    queryFn: () => ProductsService.getByIds(product?.upsell_ids ?? []),
    enabled: !!product && (product.upsell_ids?.length ?? 0) > 0,
  });

  // Group variation attribute values (e.g. "اللون" -> ["أحمر","أزرق"]) so the
  // customer picks a combination instead of a flat, unstructured chip list —
  // and nothing is pre-selected for them. Sourced from the parent product's
  // own `attributes[].terms` — NOT from the fetched `variations` list, whose
  // `attributes` field the Store API always returns empty on that endpoint.
  const termNameBySlug = useMemo(
    () => (product ? buildTermNameBySlug(product.attributes) : {}),
    [product]
  );

  const attributeGroups = useMemo(() => {
    if (!product) return [];
    return product.attributes
      .filter((attr) => (attr.terms?.length ?? 0) > 0)
      .map((attr) => ({
        name: attr.name,
        values: (attr.terms ?? []).map((term) => term.name).filter((v): v is string => !!v),
      }))
      .filter((group) => group.values.length > 0);
  }, [product]);

  const useGroupedSelector = attributeGroups.length > 0;

  // The parent product's `variations` summary gives {id, attributes: [{name,
  // value: termSlug}]} for every combination — resolve each slug to its
  // display name (via termNameBySlug) to match against what the customer
  // actually picked, then use that id to look up price/stock in `variations`
  // (the separately-fetched list, which has price/stock but empty attributes).
  const matchedVariation = useMemo(() => {
    if (!useGroupedSelector || !product) return null;
    const allChosen = attributeGroups.every((group) => selectedAttrs[group.name]);
    if (!allChosen) return null;

    const summary = product.variations.find((v) =>
      v.attributes.every((attr) => {
        const resolvedName = termNameBySlug[attr.name]?.[attr.value] ?? attr.value;
        return selectedAttrs[attr.name] === resolvedName;
      })
    );
    if (!summary) return null;

    return variations.find((v) => v.id === summary.id) ?? null;
  }, [useGroupedSelector, product, attributeGroups, selectedAttrs, termNameBySlug, variations]);

  // Fallback flat list for the rare case a variable product has no readable
  // attribute values on its variations (keeps the screen usable either way).
  const [flatSelectedVariationId, setFlatSelectedVariationId] = useState<number | null>(null);
  const flatSelectedVariation = variations.find((v) => v.id === flatSelectedVariationId) ?? null;

  const selectedVariation = useGroupedSelector ? matchedVariation : flatSelectedVariation;
  const isVariationIncomplete = product?.type === 'variable' && !selectedVariation;

  // Tapping a related/cross-sell product navigates to this same screen with a
  // new productId — React Navigation reuses this component instance rather
  // than remounting it, so local selection state must be reset explicitly or
  // it carries over from the previous product (stale variation mismatch).
  useEffect(() => {
    setSelectedImageIndex(0);
    setQuantity(1);
    setShowFullDesc(false);
    setSelectedAttrs({});
    setFlatSelectedVariationId(null);
  }, [productId]);

  const activeProductForActions = product?.type === 'variable'
    ? (selectedVariation ?? null)
    : (product ?? null);
  const isOutOfStock = isProductUnavailable(activeProductForActions);
  const discountPercent = product ? getDiscountPercent(product) : null;

  const parseVariationParams = (permalink?: string) => {
    if (!permalink) {
      return {};
    }

    const query = permalink.split('?')[1];
    if (!query) {
      return {};
    }

    return Object.fromEntries(
      query
        .split('&')
        .map((entry) => entry.split('='))
        .filter(([key, value]) => key?.startsWith('attribute_') && value)
        .map(([key, value]) => [decodeURIComponent(key), decodeURIComponent(value)])
    );
  };

  const getAttributeValueText = (attr: Product['attributes'][number]) => {
    if (Array.isArray(attr.options) && attr.options.length > 0) {
      return attr.options.join('، ');
    }

    if (Array.isArray(attr.terms) && attr.terms.length > 0) {
      return attr.terms
        .map((term) => term?.name)
        .filter(Boolean)
        .join('، ');
    }

    if (typeof attr.value === 'string' && attr.value.trim()) {
      return attr.value;
    }

    return 'غير متوفر';
  };

  const handleAddToCart = useCallback(() => {
    if (!product) return;
    const activeProduct = product.type === 'variable' ? selectedVariation : product;

    if (!activeProduct) {
      Alert.alert('تنبيه', 'يرجى اختيار جميع الخيارات قبل إضافة المنتج إلى السلة');
      return;
    }

    if (isProductUnavailable(activeProduct)) {
      Alert.alert('تنبيه', 'هذا المنتج غير متوفر حالياً');
      return;
    }

    if (
      typeof activeProduct.low_stock_remaining === 'number'
      && activeProduct.low_stock_remaining > 0
      && quantity > activeProduct.low_stock_remaining
    ) {
      Alert.alert('تنبيه', `الكمية المتوفرة في المخزون: ${activeProduct.low_stock_remaining} فقط`);
      return;
    }

    // The real cart item's `id` field IS the purchasable item's own id: the
    // product id for simple products, the variation's own id for variations.
    const targetId = product.type === 'variable' ? activeProduct.id : product.id;
    if (typeof activeProduct.low_stock_remaining === 'number' && activeProduct.low_stock_remaining > 0) {
      const cart = queryClient.getQueryData<Cart>(CART_QUERY_KEY);
      const existingQty = cart?.items.find((i) => i.id === targetId)?.quantity ?? 0;
      if (existingQty + quantity > activeProduct.low_stock_remaining) {
        Alert.alert('تنبيه', `الكمية المتوفرة في المخزون: ${activeProduct.low_stock_remaining} فقط`);
        return;
      }
    }

    addToCartMutation.mutate(
      {
        productId: product.id,
        quantity,
        variationId: product.type === 'variable' ? activeProduct.id : undefined,
        variation: product.type === 'variable' ? parseVariationParams(activeProduct.permalink) : undefined,
      },
      {
        onSuccess: () => setShowAddSuccessModal(true),
        onError: () => Alert.alert('تعذّرت الإضافة', 'حدث خطأ أثناء إضافة المنتج إلى السلة. يرجى المحاولة مرة أخرى.'),
      }
    );
  }, [addToCartMutation, product, quantity, selectedVariation, queryClient]);

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

    (navigation as any).navigate('Cart');
  }, [navigation]);

  const handleWishlistToggle = useCallback(() => {
    if (!product) return;
    if (wishlisted) {
      removeFromWishlist(product.id);
    } else {
      const priceVal = cleanPrice(product.prices.price);
      const regPriceVal = cleanPrice(product.prices.regular_price);
      const salePriceVal = cleanPrice(product.prices.sale_price);

      addToWishlist({
        product_id: product.id,
        name: product.name,
        image: resolveMediaUrl(product.images[0]?.src ?? ''),
        price: priceVal,
        regular_price: regPriceVal,
        sale_price: salePriceVal,
        on_sale: product.on_sale,
        in_stock: !isOutOfStock,
        slug: product.slug,
        added_at: new Date().toISOString(),
      });
    }
  }, [product, wishlisted, addToWishlist, removeFromWishlist, isOutOfStock]);

  const handleProductPress = useCallback((p: Product) => {
    (navigation as any).navigate('ProductDetail', { productId: p.id, productName: p.name });
  }, [navigation]);

  const handleSelectAttrValue = useCallback((groupName: string, value: string) => {
    setSelectedAttrs((prev) => ({ ...prev, [groupName]: prev[groupName] === value ? '' : value }));
  }, []);

  const handleThumbnailPress = useCallback((i: number) => {
    setSelectedImageIndex(i);
    galleryRef.current?.scrollToIndex({ index: i, animated: true });
  }, []);

  const handleGalleryScrollEnd = useCallback((event: any) => {
    const idx = Math.round(event.nativeEvent.contentOffset.x / width);
    setSelectedImageIndex(idx);
  }, []);

  React.useEffect(() => {
    if (!product) return;
    const activeProduct = product.type === 'variable'
      ? (selectedVariation ?? null)
      : product;

    if (
      activeProduct
      && typeof activeProduct.low_stock_remaining === 'number'
      && activeProduct.low_stock_remaining > 0
      && quantity > activeProduct.low_stock_remaining
    ) {
      setQuantity(activeProduct.low_stock_remaining);
    }
  }, [product, selectedVariation, quantity]);

  if (isLoading || !product) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const activeDisplayProduct = product.type === 'variable' && selectedVariation ? selectedVariation : product;
  const maxAvailableQuantity = (
    !isOutOfStock
    && typeof activeDisplayProduct.low_stock_remaining === 'number'
    && activeDisplayProduct.low_stock_remaining > 0
  ) ? activeDisplayProduct.low_stock_remaining : 99;
  const price = activeDisplayProduct.prices.price;

  // WC Store API only exposes an exact count via low_stock_remaining, and only
  // once stock is at/below the store's own "low stock threshold" setting —
  // stock_quantity isn't present on this endpoint's response at all.
  const stockQty = typeof activeDisplayProduct.low_stock_remaining === 'number'
    ? activeDisplayProduct.low_stock_remaining
    : null;
  const isLowStockUrgent = !isOutOfStock && stockQty === 1;
  const isLowStockWarning = !isOutOfStock && stockQty !== null && stockQty >= 2 && stockQty <= 3;
  const stockLabel = isOutOfStock
    ? 'غير متوفر'
    : isLowStockUrgent
      ? `اسرع متبقي ${stockQty} فقط`
      : isLowStockWarning
        ? `متبقي ${stockQty} فقط`
        : 'متوفر';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} />

      {/* Fixed Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing[2] }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="رجوع" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="arrow-right" style={styles.headerBtnIcon} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{product.name}</Text>
        <TouchableOpacity
          onPress={handleWishlistToggle}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel={wishlisted ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons
            name={wishlisted ? 'heart' : 'heart-outline'}
            style={[
              styles.headerBtnIcon,
              styles.wishlistHeaderIcon,
              wishlisted && styles.wishlistHeaderIconActive,
            ]}
          />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Image Gallery — swipeable, tap to zoom */}
        <View style={styles.imageSection}>
          {product.images.length > 0 ? (
            <FlatList
              ref={galleryRef}
              horizontal
              pagingEnabled
              data={product.images}
              keyExtractor={(img, i) => `gallery-${String(img.id ?? 'na')}-${i}`}
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleGalleryScrollEnd}
              getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
              renderItem={({ item, index }) => {
                const uri = resolveMediaUrl(item.src);
                return (
                  <TouchableOpacity
                    activeOpacity={0.95}
                    onPress={() => setIsViewerVisible(true)}
                    style={styles.mainImageSlide}
                    accessibilityRole="imagebutton"
                    accessibilityLabel={`صورة المنتج ${index + 1} من ${product.images.length}، انقر للتكبير`}
                  >
                    {uri ? (
                      <FastImage
                        source={buildFastImageSource(uri, 'high')}
                        style={styles.mainImage}
                        resizeMode={FastImage.resizeMode.contain}
                      />
                    ) : (
                      <View style={[styles.mainImage, styles.mainImageFallback]}>
                        <MaterialCommunityIcons name="package-variant-closed" style={styles.mainImageFallbackText} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          ) : (
            <View style={[styles.mainImage, styles.mainImageFallback]}>
              <MaterialCommunityIcons name="package-variant-closed" style={styles.mainImageFallbackText} />
            </View>
          )}

          {discountPercent && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>-{discountPercent}%</Text>
            </View>
          )}

          {/* Thumbnails */}
          {product.images.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailRow}>
              {product.images.map((img, i) => {
                const thumbnailUri = resolveMediaUrl(img.src);
                return (
                <TouchableOpacity
                  key={`img-${String(img.id ?? 'na')}-${i}`}
                  onPress={() => handleThumbnailPress(i)}
                  style={[styles.thumbnail, i === selectedImageIndex && styles.thumbnailActive]}
                >
                  {thumbnailUri ? (
                    <FastImage
                      source={buildFastImageSource(thumbnailUri, 'normal')}
                      style={styles.thumbnailImage}
                      resizeMode={FastImage.resizeMode.contain}
                    />
                  ) : (
                    <View style={[styles.thumbnailImage, styles.mainImageFallback]}>
                      <MaterialCommunityIcons name="package-variant-closed" style={styles.thumbnailFallbackText} />
                    </View>
                  )}
                </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Product Info */}
        <View style={styles.infoSection}>
          <Text style={styles.productName}>{product.name}</Text>

          {/* Rating */}
          {parseFloat(product.average_rating) > 0 && (
            <View style={styles.ratingRow}>
              <MaterialCommunityIcons name="star" style={styles.ratingStar} />
              <Text style={styles.ratingText}>{parseFloat(product.average_rating).toFixed(1)}</Text>
              <Text style={styles.ratingCount}>({product.review_count ?? product.rating_count ?? 0} تقييم)</Text>
            </View>
          )}

          {/* Price */}
          <View style={styles.priceSection}>
            <Text style={styles.currentPrice}>
              {formatNumber(parseFloat(cleanPrice(price)) || 0)} ل.س
            </Text>
            {product.on_sale && product.prices.regular_price && (
              <View style={styles.priceOldRow}>
                <Text style={styles.oldPrice}>
                  {formatNumber(parseFloat(cleanPrice(product.prices.regular_price)) || 0)} ل.س
                </Text>
                <View style={styles.saveBadge}>
                  <Text style={styles.saveText}>وفّر {discountPercent}%</Text>
                </View>
              </View>
            )}
          </View>

          {/* Stock Status */}
          <View style={[
            styles.stockBadge,
            isOutOfStock && styles.stockBadgeOut,
            isLowStockWarning && styles.stockBadgeWarning,
            isLowStockUrgent && styles.stockBadgeUrgent,
          ]}>
            <Text style={[
              styles.stockText,
              isOutOfStock && styles.stockTextOut,
              isLowStockWarning && styles.stockTextWarning,
              isLowStockUrgent && styles.stockTextUrgent,
            ]}>
              {stockLabel}
            </Text>
          </View>

          {/* Quantity Selector */}
          {!isOutOfStock && (
            <View style={styles.quantityRow}>
              <Text style={styles.quantityLabel}>الكمية:</Text>
              <View style={styles.quantityControls}>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => setQuantity(Math.max(1, quantity - 1))}
                  accessibilityRole="button"
                  accessibilityLabel="إنقاص الكمية"
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Text style={styles.qtyBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.qtyValue}>{quantity}</Text>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => {
                    if (quantity >= maxAvailableQuantity) {
                      Alert.alert('تنبيه', `الكمية المتوفرة في المخزون: ${maxAvailableQuantity} فقط`);
                      return;
                    }
                    setQuantity(quantity + 1);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="زيادة الكمية"
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <Text style={styles.qtyBtnText}>+</Text>
                </TouchableOpacity>
              </View>
              {stockQty !== null && quantity >= maxAvailableQuantity && (
                <Text style={styles.stockLimitInlineText}>الكمية المتوفرة في المخزون: {maxAvailableQuantity} فقط</Text>
              )}
            </View>
          )}

          {/* Variation Selector — grouped by attribute (color/size/...), nothing pre-selected */}
          {product.type === 'variable' && useGroupedSelector && (
            <View style={styles.descSection}>
              {attributeGroups.map((group) => (
                <View key={group.name} style={styles.variationGroup}>
                  <Text style={styles.descTitle}>{group.name}</Text>
                  <View style={styles.variationList}>
                    {group.values.map((value) => {
                      const isSelected = selectedAttrs[group.name] === value;
                      return (
                        <TouchableOpacity
                          key={value}
                          style={[styles.variationChip, isSelected && styles.variationChipActive]}
                          onPress={() => handleSelectAttrValue(group.name, value)}
                          accessibilityRole="button"
                          accessibilityLabel={`${group.name}: ${value}`}
                        >
                          <Text style={[styles.variationChipText, isSelected && styles.variationChipTextActive]}>
                            {value}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
              {isVariationIncomplete && (
                <Text style={styles.variationHint}>يرجى اختيار جميع الخيارات أعلاه لعرض السعر والتوفر</Text>
              )}
            </View>
          )}

          {/* Fallback flat variation list, only if grouping couldn't be built */}
          {product.type === 'variable' && !useGroupedSelector && variations.length > 0 && (
            <View style={styles.descSection}>
              <Text style={styles.descTitle}>الخيارات المتاحة</Text>
              <View style={styles.variationList}>
                {variations.map((variation, index) => (
                  <TouchableOpacity
                    key={`variation-${String(variation.id ?? 'na')}-${index}`}
                    style={[
                      styles.variationChip,
                      flatSelectedVariation?.id === variation.id && styles.variationChipActive,
                    ]}
                    onPress={() => setFlatSelectedVariationId(variation.id)}
                  >
                    <Text
                      style={[
                        styles.variationChipText,
                        flatSelectedVariation?.id === variation.id && styles.variationChipTextActive,
                      ]}
                    >
                      {variation.variation || variation.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Short Description */}
          {product.short_description ? (
            <View style={styles.descSection}>
              <Text style={styles.descTitle}>وصف مختصر</Text>
              <Text style={styles.descText}>
                {stripHtmlPreserveStructure(product.short_description)}
              </Text>
            </View>
          ) : null}

          {/* Full Description */}
          {product.description ? (
            <View style={styles.descSection}>
              <Text style={styles.descTitle}>تفاصيل المنتج</Text>
              <Text style={styles.descText} numberOfLines={showFullDesc ? undefined : 4}>
                {stripHtmlPreserveStructure(product.description)}
              </Text>
              <TouchableOpacity onPress={() => setShowFullDesc(!showFullDesc)}>
                <Text style={styles.readMore}>{showFullDesc ? 'أقل' : 'قراءة المزيد'}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Attributes */}
          {product.attributes.length > 0 && (
            <View style={styles.descSection}>
              <Text style={styles.descTitle}>المواصفات</Text>
              {product.attributes.map((attr, index) => (
                <View key={`attr-${String(attr.id ?? 'na')}-${attr.name}-${index}`} style={styles.attrRow}>
                  <Text style={styles.attrName}>{attr.name}:</Text>
                  <Text style={styles.attrValue}>{getAttributeValueText(attr)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Reviews */}
          {reviews.length > 0 && (
            <View style={styles.descSection}>
              <Text style={styles.descTitle}>التقييمات ({reviews.length})</Text>
              {reviews.slice(0, 5).map((review: ProductReview) => (
                <View key={review.id} style={styles.reviewItem}>
                  <View style={styles.reviewHeader}>
                    <Text style={styles.reviewDate}>{formatDate(review.date_created)}</Text>
                    <View style={styles.reviewHeaderRight}>
                      <Text style={styles.reviewerName}>{review.reviewer}</Text>
                      <View style={styles.reviewStars}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <MaterialCommunityIcons
                            key={i}
                            name={i < review.rating ? 'star' : 'star-outline'}
                            style={styles.reviewStarIcon}
                          />
                        ))}
                      </View>
                    </View>
                  </View>
                  {review.review ? (
                    <Text style={styles.reviewText}>{stripHtml(review.review)}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Cross-sell — "يُشترى معه غالباً" (store-curated, WooCommerce cross-sells) */}
        {crossSellProducts && crossSellProducts.length > 0 && (
          <View style={styles.relatedSection}>
            <Text style={styles.relatedTitle}>يُشترى معه غالباً</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {crossSellProducts.map((cp, index) => (
                <ProductCard key={`cross-${String(cp.id ?? 'na')}-${index}`} product={cp} onPress={handleProductPress} horizontal />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Upsell — "قد يعجبك أيضاً" */}
        {upsellProducts && upsellProducts.length > 0 && (
          <View style={styles.relatedSection}>
            <Text style={styles.relatedTitle}>قد يعجبك أيضاً</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {upsellProducts.map((up, index) => (
                <ProductCard key={`upsell-${String(up.id ?? 'na')}-${index}`} product={up} onPress={handleProductPress} horizontal />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Related Products */}
        {relatedProducts && relatedProducts.length > 0 && (
          <View style={styles.relatedSection}>
            <Text style={styles.relatedTitle}>منتجات ذات صلة</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {relatedProducts.map((rp, index) => (
                <ProductCard key={`related-${String(rp.id ?? 'na')}-${index}`} product={rp} onPress={handleProductPress} horizontal />
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.addToCartBtn, (isOutOfStock || isVariationIncomplete) && styles.btnDisabled]}
          onPress={isOutOfStock ? () => setIsNotifyModalVisible(true) : handleAddToCart}
          disabled={isVariationIncomplete || addToCartMutation.isPending}
        >
          {addToCartMutation.isPending ? (
            <ActivityIndicator size="small" color={Colors.secondary} />
          ) : (
            <>
              <Text style={styles.addToCartText}>
                {isVariationIncomplete
                  ? 'اختر الخيارات'
                  : isOutOfStock ? 'أعلمني عند التوفر' : 'إضافة للسلة'}
              </Text>
              {!isOutOfStock && !isVariationIncomplete && (
                <Text style={styles.addToCartPrice}>
                  {formatNumber(parseFloat(cleanPrice(price)) * quantity)} ل.س
                </Text>
              )}
            </>
          )}
        </TouchableOpacity>
      </View>

      <ImageViewerModal
        visible={isViewerVisible}
        images={product.images}
        initialIndex={selectedImageIndex}
        onClose={() => setIsViewerVisible(false)}
      />

      <AddToCartSuccessModal
        visible={showAddSuccessModal}
        onContinueShopping={() => setShowAddSuccessModal(false)}
        onGoToCart={handleGoToCart}
      />

      <NotifyMeModal
        visible={isNotifyModalVisible}
        defaultPhone={user?.phone ?? user?.shipping?.phone ?? user?.billing?.phone ?? ''}
        onClose={() => setIsNotifyModalVisible(false)}
        onSubmit={(phone) => ProductsService.requestStockNotification(product.id, phone)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },

  header: {
    backgroundColor: Colors.secondary,
    paddingBottom: Spacing[4],
    paddingHorizontal: Spacing[4],
    flexDirection: 'row-reverse', justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomLeftRadius: BorderRadius['2xl'],
    borderBottomRightRadius: BorderRadius['2xl'],
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  headerBtnDisabled: { opacity: 0.55 },
  headerBtnIcon: { fontSize: 22, color: Colors.textInverse, lineHeight: 24 },
  headerTitle: {
    ...Typography.h4,
    color: Colors.textInverse,
    fontFamily: FontFamily.arabicBold,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: Spacing[2],
  },
  headerBackText: { fontSize: 16, color: Colors.textPrimary, lineHeight: 18 },
  wishlistHeaderIcon: { color: Colors.textInverse, lineHeight: 22 },
  wishlistHeaderIconActive: { color: Colors.sale },
  wishlistHeaderIconDisabled: { color: Colors.textTertiary },

  scrollContent: {},

  imageSection: {
    backgroundColor: Colors.surface, paddingTop: Spacing[4], paddingBottom: Spacing[4],
  },
  mainImageSlide: { width, alignItems: 'center', justifyContent: 'center' },
  mainImage: { width: width, height: width * 0.75 },
  mainImageFallback: { alignItems: 'center', justifyContent: 'center' },
  mainImageFallbackText: { fontSize: 40, color: Colors.textTertiary },
  discountBadge: {
    position: 'absolute', top: Spacing[16], left: Spacing[4],
    backgroundColor: Colors.sale, borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing[2], paddingVertical: Spacing[1],
  },
  discountText: { ...Typography.label, color: Colors.textInverse, fontFamily: FontFamily.bold },
  thumbnailRow: { paddingHorizontal: Spacing[4], marginTop: Spacing[3] },
  thumbnail: {
    width: 64, height: 64, borderRadius: BorderRadius.md, borderWidth: 2,
    borderColor: Colors.border, marginRight: Spacing[2], overflow: 'hidden',
  },
  thumbnailActive: { borderColor: Colors.primary },
  thumbnailImage: { width: '100%', height: '100%' },
  thumbnailFallbackText: { fontSize: 14, color: Colors.textTertiary },

  infoSection: { backgroundColor: Colors.surface, marginTop: Spacing[2], padding: Spacing[5] },
  productName: { ...Typography.h3, color: Colors.textPrimary, fontFamily: FontFamily.arabicBold, textAlign: 'right', marginBottom: Spacing[2] },
  ratingRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, marginBottom: Spacing[3] },
  ratingStar: { fontSize: 14, color: Colors.rating },
  ratingText: { ...Typography.label, color: Colors.rating, fontFamily: FontFamily.bold },
  ratingCount: { ...Typography.caption, color: Colors.textTertiary },

  priceSection: { marginBottom: Spacing[3] },
  currentPrice: { ...Typography.priceLarge, color: Colors.sale, fontFamily: FontFamily.arabicBold, textAlign: 'right' },
  priceOldRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing[2], marginTop: Spacing[1] },
  oldPrice: { ...Typography.body, color: Colors.textTertiary, textDecorationLine: 'line-through', textAlign: 'right' },
  saveBadge: { backgroundColor: Colors.successLight, paddingHorizontal: Spacing[2], paddingVertical: 2, borderRadius: BorderRadius.sm },
  saveText: { ...Typography.caption, color: Colors.success, fontFamily: FontFamily.arabicBold },

  stockBadge: { alignSelf: 'flex-end', backgroundColor: Colors.successLight, paddingHorizontal: Spacing[3], paddingVertical: Spacing[1], borderRadius: BorderRadius.full, marginBottom: Spacing[4] },
  stockBadgeOut: { backgroundColor: Colors.errorLight },
  stockBadgeWarning: { backgroundColor: Colors.warningLight },
  stockBadgeUrgent: { backgroundColor: Colors.errorLight },
  stockText: { ...Typography.labelSmall, color: Colors.success, fontFamily: FontFamily.arabicMedium },
  stockTextOut: { color: Colors.error },
  stockTextWarning: { color: Colors.warning },
  stockTextUrgent: { color: Colors.error, fontFamily: FontFamily.arabicBold },
  stockLimitInlineText: { ...Typography.caption, color: Colors.warning, textAlign: 'right', marginTop: Spacing[1] },

  quantityRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing[5] },
  quantityLabel: { ...Typography.labelLarge, color: Colors.textPrimary, fontFamily: FontFamily.arabicMedium },
  quantityControls: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing[2], paddingVertical: Spacing[1] },
  qtyBtn: { width: 36, height: 36, borderRadius: BorderRadius.full, backgroundColor: Colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 20, color: Colors.textPrimary, fontWeight: '600' },
  qtyValue: { ...Typography.h4, color: Colors.textPrimary, minWidth: 32, textAlign: 'center' },

  descSection: { borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: Spacing[4], marginTop: Spacing[4] },
  descTitle: { ...Typography.h4, color: Colors.textPrimary, fontFamily: FontFamily.arabicBold, textAlign: 'right', marginBottom: Spacing[2] },
  descText: { ...Typography.body, color: Colors.textSecondary, textAlign: 'right', lineHeight: 22 },
  readMore: { ...Typography.labelLarge, color: Colors.secondary, textAlign: 'right', marginTop: Spacing[1] },
  variationGroup: { marginBottom: Spacing[3] },
  variationList: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: Spacing[2] },
  variationChip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    backgroundColor: Colors.surfaceSecondary,
  },
  variationChipActive: {
    borderColor: Colors.secondary,
    backgroundColor: '#EEF1F8',
  },
  variationChipText: {
    ...Typography.label,
    color: Colors.textPrimary,
    fontFamily: FontFamily.arabicMedium,
  },
  variationChipTextActive: {
    color: Colors.secondary,
  },
  variationHint: { ...Typography.caption, color: Colors.warning, textAlign: 'right', marginTop: Spacing[1] },

  attrRow: { flexDirection: 'row-reverse', gap: Spacing[2], marginBottom: Spacing[1] },
  attrName: { ...Typography.label, color: Colors.textPrimary, fontFamily: FontFamily.arabicMedium },
  attrValue: { ...Typography.body, color: Colors.textSecondary },

  reviewItem: { borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: Spacing[3], marginTop: Spacing[3] },
  reviewHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing[1.5] },
  reviewHeaderRight: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing[2] },
  reviewerName: { ...Typography.labelLarge, color: Colors.textPrimary, fontFamily: FontFamily.arabicBold },
  reviewStars: { flexDirection: 'row-reverse' },
  reviewStarIcon: { fontSize: 13, color: Colors.rating },
  reviewDate: { ...Typography.caption, color: Colors.textTertiary },
  reviewText: { ...Typography.body, color: Colors.textSecondary, textAlign: 'right', lineHeight: 20 },

  relatedSection: { backgroundColor: Colors.surface, marginTop: Spacing[2], padding: Spacing[5] },
  relatedTitle: { ...Typography.h4, color: Colors.textPrimary, fontFamily: FontFamily.arabicBold, textAlign: 'right', marginBottom: Spacing[4] },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surface, padding: Spacing[4],
    paddingBottom: Spacing[8], ...Shadows.xl, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  addToCartBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.xl,
    paddingVertical: Spacing[4], flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: Spacing[3],
  },
  btnDisabled: { backgroundColor: Colors.border },
  addToCartText: { ...Typography.button, color: Colors.secondary, fontFamily: FontFamily.arabicBold },
  addToCartPrice: { ...Typography.label, color: 'rgba(26,26,46,0.82)' },
  bottomSpacer: { height: 120 },

  // Fullscreen image viewer
  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' },
  viewerCloseBtn: {
    position: 'absolute', top: Spacing[12], left: Spacing[4], zIndex: 10,
    width: 40, height: 40, borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  viewerCloseIcon: { fontSize: 22, color: Colors.textInverse },
  viewerImageWrap: { width, height: width, alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '100%' },
  viewerHint: { ...Typography.caption, color: 'rgba(255,255,255,0.6)', position: 'absolute', bottom: Spacing[10] },
  viewerDotsRow: { flexDirection: 'row', position: 'absolute', bottom: Spacing[6], gap: Spacing[1] },
  viewerDot: { width: 6, height: 6, borderRadius: BorderRadius.full, backgroundColor: 'rgba(255,255,255,0.4)' },
  viewerDotActive: { backgroundColor: Colors.primary, width: 18 },
});
