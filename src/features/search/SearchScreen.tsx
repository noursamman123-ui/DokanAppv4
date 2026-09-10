/**
 * Search Screen – Instant search with recent searches, trending products,
 * debounced queries, and quick add-to-cart on results.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ScrollView, StatusBar, Keyboard, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import FastImage from 'react-native-fast-image';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { HomeStackParamList } from '../../navigation/types';
import { ProductsService } from '../../api/products.service';
import { SearchHistory } from '../../utils/storage';
import { Product } from '../../types';
import { Colors } from '../../theme/colors';
import { Typography, FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { Shadows } from '../../theme/shadows';
import { buildFastImageSource, resolveMediaUrl } from '../../utils/media';
import FloatingCartBar from '../../components/cart/FloatingCartBar';
import AddToCartSuccessModal from '../../components/feedback/AddToCartSuccessModal';
import { useAddToCart } from '../../hooks/useCart';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatNumber } from '../../utils/formatters';
import { isProductUnavailable as isSimpleProductUnavailable } from '../../utils/productAvailability';

type NavProp = NativeStackNavigationProp<HomeStackParamList, 'Search'>;

const SEARCH_DEBOUNCE_MS = 300;

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showAddSuccessModal, setShowAddSuccessModal] = useState(false);
  const addToCartMutation = useAddToCart();

  useEffect(() => {
    setRecentSearches(SearchHistory.get());
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, isLoading } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => ProductsService.searchProducts(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30 * 1000,
  });

  const { data: trendingProducts } = useQuery({
    queryKey: ['search-trending'],
    queryFn: () => ProductsService.getProducts({ orderby: 'popularity', order: 'desc', per_page: 6 }),
    enabled: query.length < 2,
    staleTime: 5 * 60 * 1000,
  });

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
  }, []);

  const handleSubmit = useCallback(() => {
    if (query.trim().length >= 2) {
      SearchHistory.add(query.trim());
      setRecentSearches(SearchHistory.get());
      Keyboard.dismiss();
    }
  }, [query]);

  const handleProductPress = useCallback((product: Product) => {
    if (query.trim().length >= 2) {
      SearchHistory.add(query.trim());
    }
    navigation.navigate('ProductDetail', { productId: product.id, productName: product.name });
  }, [navigation, query]);

  const handleRecentPress = useCallback((term: string) => {
    setQuery(term);
  }, []);

  const handleQuickAdd = useCallback((product: Product) => {
    if (isSimpleProductUnavailable(product) || product.type === 'variable') {
      handleProductPress(product);
      return;
    }
    addToCartMutation.mutate(
      { productId: product.id, quantity: 1 },
      {
        onSuccess: () => setShowAddSuccessModal(true),
        onError: () => Alert.alert('تعذّرت الإضافة', 'حدث خطأ أثناء إضافة المنتج إلى السلة. يرجى المحاولة مرة أخرى.'),
      }
    );
  }, [addToCartMutation, handleProductPress]);

  const handleCartPress = useCallback(() => {
    navigation.getParent()?.navigate('Cart');
  }, [navigation]);

  const renderProduct = ({ item }: { item: Product }) => {
    const imageUri = resolveMediaUrl(item.images[0]?.src);
    const unavailable = isSimpleProductUnavailable(item);

    return (
      <TouchableOpacity style={styles.resultItem} onPress={() => handleProductPress(item)}>
        {imageUri ? (
          <FastImage
            source={buildFastImageSource(imageUri, 'normal')}
            style={styles.resultImage}
            resizeMode={FastImage.resizeMode.contain}
          />
        ) : (
          <View style={[styles.resultImage, styles.imageFallback]}>
            <MaterialCommunityIcons name="package-variant-closed" style={styles.imageFallbackText} />
          </View>
        )}
        <View style={styles.resultInfo}>
          <Text style={styles.resultName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.resultPrice}>
            {formatNumber(parseFloat(item.prices.sale_price || item.prices.price || '0'))} ل.س
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.quickAddBtn, unavailable && styles.quickAddBtnDisabled]}
          onPress={() => handleQuickAdd(item)}
          disabled={unavailable}
          accessibilityRole="button"
          accessibilityLabel={unavailable ? 'نفذت الكمية' : 'إضافة للسلة'}
        >
          <MaterialCommunityIcons
            name={unavailable ? 'close' : 'cart-plus'}
            style={[styles.quickAddIcon, unavailable && styles.quickAddIconDisabled]}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} />

      {/* Search Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing[2] }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="رجوع" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="arrow-right" style={styles.backIcon} />
        </TouchableOpacity>
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="ابحث عن منتجات..."
          placeholderTextColor={Colors.placeholder}
          value={query}
          onChangeText={handleSearch}
          onSubmitEditing={handleSubmit}
          returnKeyType="search"
          textAlign="right"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="مسح البحث">
            <MaterialCommunityIcons name="close" style={styles.clearBtn} />
          </TouchableOpacity>
        )}
      </View>

      {/* Recent Searches + Trending */}
      {query.length < 2 && (
        <ScrollView showsVerticalScrollIndicator={false}>
          {recentSearches.length > 0 && (
            <View style={styles.recentSection}>
              <View style={styles.recentHeader}>
                <Text style={styles.recentTitle}>عمليات بحث سابقة</Text>
                <TouchableOpacity onPress={() => { SearchHistory.clear(); setRecentSearches([]); }}>
                  <Text style={styles.clearAll}>مسح الكل</Text>
                </TouchableOpacity>
              </View>
              {recentSearches.map((term, i) => (
                <TouchableOpacity key={i} style={styles.recentRow} onPress={() => handleRecentPress(term)}>
                  <MaterialCommunityIcons name="history" style={styles.recentIcon} />
                  <Text style={styles.recentText}>{term}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {trendingProducts && trendingProducts.length > 0 && (
            <View style={styles.recentSection}>
              <Text style={styles.recentTitle}>الأكثر رواجاً</Text>
              <View style={styles.trendingList}>
                {trendingProducts.map((product) => (
                  <TouchableOpacity
                    key={product.id}
                    style={styles.trendingChip}
                    onPress={() => handleProductPress(product)}
                  >
                    <MaterialCommunityIcons name="trending-up" style={styles.trendingIcon} />
                    <Text style={styles.trendingText} numberOfLines={1}>{product.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* Search Results */}
      {debouncedQuery.length >= 2 && (
        <FlatList
          data={results ?? []}
          renderItem={renderProduct}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.resultsList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.noResults}>
                <MaterialCommunityIcons name="magnify" style={styles.noResultsIcon} />
                <Text style={styles.noResultsText}>لا توجد نتائج لـ "{debouncedQuery}"</Text>
              </View>
            ) : null
          }
        />
      )}

      <FloatingCartBar />

      <AddToCartSuccessModal
        visible={showAddSuccessModal}
        onContinueShopping={() => setShowAddSuccessModal(false)}
        onGoToCart={() => {
          setShowAddSuccessModal(false);
          handleCartPress();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.secondary, paddingBottom: Spacing[4],
    paddingHorizontal: Spacing[4], flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing[3],
    borderBottomLeftRadius: BorderRadius['2xl'],
    borderBottomRightRadius: BorderRadius['2xl'],
  },
  backBtn: {},
  backIcon: { fontSize: 22, color: Colors.textInverse },
  input: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing[4], paddingVertical: Spacing[2.5],
    fontSize: FontSize.base, color: Colors.textPrimary, fontFamily: FontFamily.arabicRegular,
    borderWidth: 1, borderColor: Colors.border,
  },
  clearBtn: { fontSize: 18, color: Colors.textInverse, padding: Spacing[2] },
  recentSection: { padding: Spacing[5] },
  recentHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: Spacing[3] },
  recentTitle: { ...Typography.h4, color: Colors.textPrimary, fontFamily: FontFamily.arabicBold, textAlign: 'right', marginBottom: Spacing[3] },
  clearAll: { ...Typography.label, color: Colors.primaryDark },
  recentRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing[3], paddingVertical: Spacing[3], borderBottomWidth: 1, borderBottomColor: Colors.divider },
  recentIcon: { fontSize: 16, color: Colors.textTertiary },
  recentText: { ...Typography.body, color: Colors.textPrimary, fontFamily: FontFamily.arabicRegular },
  trendingList: { gap: Spacing[2] },
  trendingChip: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing[2],
    backgroundColor: Colors.card, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.borderLight,
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[2.5],
  },
  trendingIcon: { fontSize: 16, color: Colors.primaryDark },
  trendingText: { ...Typography.bodySmall, color: Colors.textPrimary, fontFamily: FontFamily.arabicMedium, textAlign: 'right', flex: 1 },
  resultsList: { padding: Spacing[4], paddingBottom: 100 },
  resultItem: {
    flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg, padding: Spacing[3], gap: Spacing[3], marginBottom: Spacing[2],
    borderWidth: 1, borderColor: Colors.borderLight,
    ...Shadows.xs,
  },
  resultImage: { width: 70, height: 70, borderRadius: BorderRadius.md, backgroundColor: Colors.surfaceSecondary },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
  imageFallbackText: { fontSize: 24, color: Colors.textTertiary },
  resultInfo: { flex: 1, gap: Spacing[1] },
  resultName: { ...Typography.bodySmall, color: Colors.textPrimary, fontFamily: FontFamily.arabicMedium, textAlign: 'right' },
  resultPrice: { ...Typography.priceSmall, color: Colors.sale, fontFamily: FontFamily.arabicBold, textAlign: 'right' },
  quickAddBtn: {
    width: 40, height: 40, borderRadius: BorderRadius.full, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  quickAddBtnDisabled: { backgroundColor: Colors.border },
  quickAddIcon: { fontSize: 20, color: Colors.secondary },
  quickAddIconDisabled: { color: Colors.textSecondary },
  noResults: { alignItems: 'center', paddingTop: Spacing[16] },
  noResultsIcon: { fontSize: 48, marginBottom: Spacing[4], color: Colors.textTertiary },
  noResultsText: { ...Typography.body, color: Colors.textSecondary, fontFamily: FontFamily.arabicMedium },
});
