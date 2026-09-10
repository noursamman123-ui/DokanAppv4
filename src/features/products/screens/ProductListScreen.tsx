/**
 * Product Listing Screen – Grid with infinite scroll, sorting, and filtering.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, StatusBar, RefreshControl, ScrollView,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useInfiniteQuery } from '@tanstack/react-query';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { HomeStackParamList } from '../../../navigation/types';
import { ProductsService } from '../../../api/products.service';
import { Product, ProductFilters, getDiscountPercent } from '../../../types';
import ProductCard from '../../../components/cards/ProductCard';
import { ProductCardSkeleton } from '../../../components/feedback/Skeleton';
import FloatingCartBar from '../../../components/cart/FloatingCartBar';
import { Colors } from '../../../theme/colors';
import { Typography, FontFamily } from '../../../theme/typography';
import { Spacing, BorderRadius } from '../../../theme/spacing';
import { Shadows } from '../../../theme/shadows';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type NavProp = NativeStackNavigationProp<HomeStackParamList, 'ProductList'>;
type RoutePropType = RouteProp<HomeStackParamList, 'ProductList'>;
type SortOrderBy = NonNullable<ProductFilters['orderby']> | 'discount';
type SortOption = { label: string; orderby: SortOrderBy; order: NonNullable<ProductFilters['order']> };

const SORT_OPTIONS: SortOption[] = [
  { label: 'الأحدث', orderby: 'date', order: 'desc' },
  { label: 'الأقل سعراً', orderby: 'price', order: 'asc' },
  { label: 'الأعلى سعراً', orderby: 'price', order: 'desc' },
  { label: 'الأعلى تقييماً', orderby: 'rating', order: 'desc' },
  { label: 'الأكثر مبيعاً', orderby: 'popularity', order: 'desc' },
  { label: 'الأعلى خصماً', orderby: 'discount', order: 'desc' },
];

export default function ProductListScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RoutePropType>();
  const { categoryId, categoryName, title, filter } = route.params ?? {};

  const normalizedFilter = filter === 'featured' ? 'best_sellers' : filter;

  const getDefaultSortIndex = useCallback((activeFilter?: RoutePropType['params']['filter']) => {
    if (activeFilter === 'sale') {
      return SORT_OPTIONS.findIndex((opt) => opt.orderby === 'discount');
    }
    if (activeFilter === 'best_sellers' || activeFilter === 'featured') {
      return SORT_OPTIONS.findIndex((opt) => opt.orderby === 'popularity');
    }
    return 0;
  }, []);

  const [sortIndex, setSortIndex] = useState(() => Math.max(0, getDefaultSortIndex(normalizedFilter)));
  const sort = SORT_OPTIONS[sortIndex];

  useEffect(() => {
    setSortIndex(Math.max(0, getDefaultSortIndex(normalizedFilter)));
  }, [normalizedFilter, getDefaultSortIndex]);

  const buildFilters = useCallback(
    (page: number): ProductFilters => ({
      page,
      per_page: 50,
      category: categoryId,
      orderby:
        normalizedFilter === 'best_sellers'
          ? 'popularity'
          : (sort.orderby === 'discount' ? 'date' : sort.orderby),
      order: normalizedFilter === 'best_sellers' ? 'desc' : sort.order,
      on_sale: normalizedFilter === 'sale' ? true : undefined,
      featured: undefined,
    }),
    [categoryId, normalizedFilter, sort.orderby, sort.order],
  );

  const {
    data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch,
  } = useInfiniteQuery({
    queryKey: ['products', categoryId, normalizedFilter, sort.orderby, sort.order],
    queryFn: ({ pageParam = 1 }) => ProductsService.getProducts(buildFilters(pageParam)),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length >= 50 ? allPages.length + 1 : undefined,
    initialPageParam: 1,
  });

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const apiProducts = useMemo(() => data?.pages.flat() ?? [], [data?.pages]);

  const allProducts = useMemo(() => {
    const products = [...apiProducts];
    if (sort.orderby === 'discount') {
      return products.sort((a, b) => (getDiscountPercent(b) ?? 0) - (getDiscountPercent(a) ?? 0));
    }
    return products;
  }, [apiProducts, sort.orderby]);

  const handleProductPress = useCallback((product: Product) => {
    navigation.navigate('ProductDetail', { productId: product.id, productName: product.name });
  }, [navigation]);

  const renderProduct = useCallback(
    ({ item }: { item: Product }) => (
      <View style={styles.cardWrapper}>
        <ProductCard product={item} onPress={handleProductPress} />
      </View>
    ),
    [handleProductPress],
  );

  const screentTitle = title ?? categoryName ?? 'المنتجات';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing[2] }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="رجوع" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="arrow-right" style={styles.backIcon} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{screentTitle}</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Sort Bar */}
      <View style={styles.sortBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sortScrollContent}
        >
          {SORT_OPTIONS.map((opt, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.sortChip, i === sortIndex && styles.sortChipActive]}
              onPress={() => setSortIndex(i)}
            >
              <Text style={[styles.sortText, i === sortIndex && styles.sortTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Product Grid */}
      {isLoading ? (
        <View style={styles.skeletonGrid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </View>
      ) : (
        <FlashList
          data={allProducts}
          numColumns={2}
          renderItem={renderProduct}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator style={styles.loader} color={Colors.primary} size="small" />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="package-variant-closed" style={styles.emptyIcon} />
              <Text style={styles.emptyText}>لا توجد منتجات حالياً</Text>
            </View>
          }
        />
      )}

      <FloatingCartBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.secondary,
    paddingTop: Spacing[10],
    paddingBottom: Spacing[4],
    paddingHorizontal: Spacing[4],
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: BorderRadius['2xl'],
    borderBottomRightRadius: BorderRadius['2xl'],
  },
  backBtn: { width: 40, alignItems: 'center' },
  backIcon: { fontSize: 22, color: Colors.textInverse },
  headerTitle: {
    ...Typography.h4, color: Colors.textInverse,
    fontFamily: FontFamily.arabicBold, flex: 1, textAlign: 'center',
  },
  sortBar: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing[3],
    marginTop: -Spacing[2],
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing[1],
    paddingVertical: Spacing[2],
    ...Shadows.xs,
  },
  sortScrollContent: {
    flexDirection: 'row-reverse',
    gap: Spacing[2],
    paddingHorizontal: Spacing[2],
  },
  sortChip: {
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[1.5],
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  sortChipActive: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  sortText: { ...Typography.labelSmall, color: Colors.textSecondary, fontFamily: FontFamily.arabicMedium },
  sortTextActive: { color: Colors.textInverse },
  listContent: { padding: Spacing[3], paddingBottom: 100 },
  cardWrapper: { flex: 1, padding: Spacing[1.5] },
  skeletonGrid: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between',
    padding: Spacing[5],
  },
  loader: { paddingVertical: Spacing[6] },
  empty: { alignItems: 'center', paddingTop: Spacing[16] },
  emptyIcon: { fontSize: 48, marginBottom: Spacing[4] },
  emptyText: { ...Typography.bodyLarge, color: Colors.textSecondary, fontFamily: FontFamily.arabicMedium },
});
