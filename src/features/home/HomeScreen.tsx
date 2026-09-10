/**
 * Home Screen – mobile-first storefront layout inspired by the provided reference.
 */
import React, { useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import FastImage from 'react-native-fast-image';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeStackParamList } from '../../navigation/types';
import { Colors } from '../../theme/colors';
import { Typography, FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { Shadows } from '../../theme/shadows';
import { HomeService } from '../../api/home.service';
import { ProductsService } from '../../api/products.service';
import { NotificationsService } from '../../api/notifications.service';
import { Product, Banner, Category } from '../../types';
import {
  BannerSkeleton,
  ProductCardSkeleton,
  CategoryChipSkeleton,
} from '../../components/feedback/Skeleton';
import FloatingCartBar from '../../components/cart/FloatingCartBar';
import ProductCard from '../../components/cards/ProductCard';
import { useCart } from '../../hooks/useCart';
import { buildFastImageSource, resolveMediaUrl } from '../../utils/media';
import { stripHtml } from '../../utils/formatters';

const { width: screenWidth } = Dimensions.get('window');

const HORIZONTAL_PADDING = Spacing[4];
const BANNER_WIDTH = screenWidth - HORIZONTAL_PADDING * 2;
const PRODUCTS_PAGE_SIZE = 20;

type HomeNavProp = NativeStackNavigationProp<HomeStackParamList, 'HomeScreen'>;

type HeaderIconButtonProps = {
  icon: string;
  badgeCount?: number;
  accessibilityLabel: string;
  onPress: () => void;
};

const getCategoryIcon = (category: Category): string => {
  const key = `${category.slug} ${category.name}`.toLowerCase();
  if (/mobile|phone|elect|الكتر|موبايل|هاتف/.test(key)) return 'cellphone';
  if (/fashion|cloth|wear|مد|ملابس|أزياء/.test(key)) return 'tshirt-crew-outline';
  if (/beauty|cosmetic|perfume|عطر|مكياج|تجميل/.test(key)) return 'spray-bottle';
  if (/home|kitchen|منزل|مطبخ|أدوات/.test(key)) return 'sofa-outline';
  if (/baby|kids|طفل|أطفال/.test(key)) return 'baby-face-outline';
  if (/sport|fitness|رياض/.test(key)) return 'dumbbell';
  return 'shape-outline';
};

function HeaderIconButton({ icon, badgeCount = 0, accessibilityLabel, onPress }: HeaderIconButtonProps) {
  return (
    <TouchableOpacity
      style={styles.headerIconButton}
      onPress={onPress}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
    >
      <MaterialCommunityIcons name={icon} size={20} color={Colors.textPrimary} />
      {badgeCount > 0 && (
        <View style={styles.headerIconBadge}>
          <Text style={styles.headerIconBadgeText}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function BannerCarousel({ banners }: { banners: Banner[] }) {
  const [activeIndex, setActiveIndex] = React.useState(0);

  return (
    <View style={styles.bannerOuter}>
      <FlatList
        horizontal
        pagingEnabled
        data={banners}
        keyExtractor={(item, index) => String(item.id ?? index)}
        showsHorizontalScrollIndicator={false}
        snapToInterval={BANNER_WIDTH}
        decelerationRate="fast"
        renderItem={({ item }) => (
          <View style={styles.bannerCard}>
            <FastImage
              source={buildFastImageSource(item.image, 'high')}
              style={styles.bannerImage}
              resizeMode={FastImage.resizeMode.cover}
            />
            <View style={styles.bannerOverlay} />
            <View style={styles.bannerContent}>
              <Text style={styles.bannerTitle} numberOfLines={2}>
                {stripHtml(item.title) || 'عروض دكان الكبرى'}
              </Text>
              <View style={styles.bannerCta}>
                <Text style={styles.bannerCtaText}>تسوّق الآن</Text>
              </View>
            </View>
          </View>
        )}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.x / BANNER_WIDTH);
          setActiveIndex(index);
        }}
      />
      <View style={styles.dotsRow}>
        {banners.map((_, index) => (
          <View
            key={index}
            style={[styles.dot, index === activeIndex && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
}

function CategoryStrip({
  categories,
  onCategoryPress,
}: {
  categories: Category[];
  onCategoryPress: (category: Category) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.categoriesRow}
    >
      {categories.map((category) => {
        const imageUri = resolveMediaUrl(category.image?.src);
        return (
          <TouchableOpacity
            key={category.id}
            style={styles.categoryItem}
            onPress={() => onCategoryPress(category)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={stripHtml(category.name)}
          >
            <View style={styles.categoryIconWrap}>
              {imageUri ? (
                <FastImage
                  source={buildFastImageSource(imageUri, 'normal')}
                  style={styles.categoryImage}
                  resizeMode={FastImage.resizeMode.cover}
                />
              ) : (
                <MaterialCommunityIcons
                  name={getCategoryIcon(category)}
                  size={24}
                  color={Colors.secondary}
                />
              )}
            </View>
            <Text style={styles.categoryName} numberOfLines={2}>
              {stripHtml(category.name)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<HomeNavProp>();
  const { data: cart } = useCart();
  const cartCount = cart?.items_count ?? 0;

  const { data: homeData, isLoading } = useQuery({
    queryKey: ['home'],
    queryFn: HomeService.getHomeData,
    staleTime: 2 * 60 * 1000,
    refetchOnMount: false,
    retry: 2,
    placeholderData: (previousData) => previousData,
  });

  const { data: unreadNotifications } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: NotificationsService.getUnreadCount,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const {
    data: allProductsPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isAllProductsLoading,
  } = useInfiniteQuery({
    queryKey: ['home-all-products'],
    queryFn: ({ pageParam = 1 }) =>
      ProductsService.getProducts({
        page: pageParam,
        per_page: PRODUCTS_PAGE_SIZE,
        orderby: 'date',
        order: 'desc',
      }),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length >= PRODUCTS_PAGE_SIZE ? allPages.length + 1 : undefined,
    initialPageParam: 1,
    staleTime: 60 * 1000,
  });

  const banners = useMemo(() => (homeData?.banners ?? []).slice(0, 4), [homeData?.banners]);

  const featuredCategories = useMemo(
    () => (homeData?.featured_categories ?? []).slice(0, 8),
    [homeData?.featured_categories]
  );

  const initialHomeProducts = useMemo(() => {
    const source = [
      ...(homeData?.latest_products ?? []),
      ...(homeData?.best_sellers ?? []),
      ...(homeData?.featured_products ?? []),
    ];
    const unique = new Map<number, Product>();
    source.forEach((product) => {
      if (!unique.has(product.id)) unique.set(product.id, product);
    });
    return Array.from(unique.values());
  }, [homeData?.latest_products, homeData?.best_sellers, homeData?.featured_products]);

  const allHomeProducts = useMemo(() => {
    const fetchedProducts = allProductsPages?.pages.flat() ?? [];
    const source = fetchedProducts.length > 0 ? fetchedProducts : initialHomeProducts;
    const unique = new Map<number, Product>();
    source.forEach((product) => {
      if (!unique.has(product.id)) unique.set(product.id, product);
    });
    return Array.from(unique.values());
  }, [allProductsPages?.pages, initialHomeProducts]);

  useEffect(() => {
    const preloadSources = [
      ...banners.map((banner) => resolveMediaUrl(banner.image)),
      ...featuredCategories.map((category) => resolveMediaUrl(category.image?.src)),
      ...allHomeProducts.slice(0, 12).map((product) => resolveMediaUrl(product.images?.[0]?.src)),
    ]
      .filter(Boolean)
      .slice(0, 20)
      .map((uri) => ({
        uri,
        priority: FastImage.priority.normal,
        cache: FastImage.cacheControl.web,
      }));

    if (preloadSources.length > 0) {
      FastImage.preload(preloadSources);
    }
  }, [banners, featuredCategories, allHomeProducts]);

  const handleProductPress = useCallback(
    (product: Product) => {
      navigation.navigate('ProductDetail', { productId: product.id, productName: product.name });
    },
    [navigation]
  );

  const handleSearchPress = useCallback(() => {
    navigation.navigate('Search');
  }, [navigation]);

  const handleCategoryPress = useCallback(
    (category: Category) => {
      navigation.navigate('ProductList', {
        categoryId: category.id,
        categoryName: category.name,
      });
    },
    [navigation]
  );

  const handleOpenSaleProducts = useCallback(() => {
    navigation.navigate('ProductList', { filter: 'sale', title: 'التخفيضات' });
  }, [navigation]);

  const handleFetchMoreProducts = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const handleCartPress = useCallback(() => {
    navigation.getParent()?.navigate('Cart');
  }, [navigation]);

  const handleNotificationPress = useCallback(() => {
    const parent = navigation.getParent();
    if (!parent) return;
    (parent as any).navigate('Account', { screen: 'Notifications' });
  }, [navigation]);

  const renderProduct = useCallback(
    ({ item }: { item: Product }) => (
      <View style={styles.cardWrapper}>
        <ProductCard product={item} onPress={handleProductPress} />
      </View>
    ),
    [handleProductPress]
  );

  const listHeader = (
    <View style={styles.mainContent}>
      {isLoading ? (
        <BannerSkeleton />
      ) : banners.length > 0 ? (
        <BannerCarousel banners={banners} />
      ) : (
        <TouchableOpacity
          style={styles.emptyBanner}
          onPress={handleOpenSaleProducts}
          activeOpacity={0.92}
          accessibilityRole="button"
          accessibilityLabel="عروض دكان الكبرى، اضغط لعرض صفحة التخفيضات"
        >
          <Text style={styles.emptyBannerText}>عروض دكان الكبرى</Text>
          <Text style={styles.emptyBannerSubText}>اضغط لعرض صفحة التخفيضات</Text>
        </TouchableOpacity>
      )}

      <View style={styles.categoriesSection}>
        {isLoading ? (
          <View style={styles.categoriesSkeletonRow}>
            {Array.from({ length: 5 }).map((_, index) => (
              <CategoryChipSkeleton key={index} />
            ))}
          </View>
        ) : (
          <CategoryStrip categories={featuredCategories} onCategoryPress={handleCategoryPress} />
        )}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>جميع المنتجات</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('ProductList', { filter: 'latest', title: 'جميع المنتجات' })}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.seeAll}>عرض الكل</Text>
        </TouchableOpacity>
      </View>

      {(isLoading || isAllProductsLoading) && (
        <View style={styles.productsGrid}>
          {Array.from({ length: 4 }).map((_, index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />

      <FlatList
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        data={isLoading || isAllProductsLoading ? [] : allHomeProducts}
        numColumns={2}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderProduct}
        columnWrapperStyle={styles.productsRow}
        ListHeaderComponent={
          <>
            <View style={[styles.header, { paddingTop: insets.top + Spacing[2] }]}>
              <View style={styles.headerTopRow}>
                <View style={styles.headerActions}>
                  <HeaderIconButton
                    icon="bell-outline"
                    badgeCount={unreadNotifications ?? 0}
                    accessibilityLabel="الإشعارات"
                    onPress={handleNotificationPress}
                  />
                  <HeaderIconButton
                    icon="cart-outline"
                    badgeCount={cartCount}
                    accessibilityLabel="سلة التسوق"
                    onPress={handleCartPress}
                  />
                </View>

                <Image
                  source={require('../../assets/images/logo.png')}
                  style={styles.brandLogo}
                  resizeMode="contain"
                  accessibilityRole="image"
                  accessibilityLabel="دكان"
                />
              </View>

              <TouchableOpacity
                style={styles.searchBar}
                onPress={handleSearchPress}
                activeOpacity={0.92}
                accessibilityRole="button"
                accessibilityLabel="البحث عن المنتجات"
              >
                <MaterialCommunityIcons name="magnify" size={18} color={Colors.textTertiary} />
                <Text style={styles.searchPlaceholder}>ابحث عن المنتجات...</Text>
              </TouchableOpacity>
            </View>

            {listHeader}
          </>
        }
        ListEmptyComponent={
          !isLoading && !isAllProductsLoading ? (
            <View style={styles.emptyProducts}>
              <MaterialCommunityIcons name="shopping-outline" size={64} color={Colors.textTertiary} />
              <Text style={styles.emptyProductsText}>لا توجد منتجات متاحة حالياً</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          allHomeProducts.length > 0 && !isLoading && !isAllProductsLoading ? (
            <View style={styles.loadMoreWrap}>
              {hasNextPage ? (
                <TouchableOpacity
                  style={[styles.loadMoreBtn, isFetchingNextPage && styles.loadMoreBtnDisabled]}
                  onPress={handleFetchMoreProducts}
                  disabled={isFetchingNextPage}
                  activeOpacity={0.88}
                >
                  {isFetchingNextPage ? (
                    <ActivityIndicator color={Colors.textInverse} />
                  ) : (
                    <Text style={styles.loadMoreBtnText}>إظهار المزيد</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <Text style={styles.allLoadedText}>تم عرض جميع المنتجات</Text>
              )}
            </View>
          ) : null
        }
        onEndReached={handleFetchMoreProducts}
        onEndReachedThreshold={0.5}
      />

      <FloatingCartBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 110,
  },
  header: {
    backgroundColor: Colors.surface,
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: Spacing[4],
    borderBottomLeftRadius: BorderRadius['2xl'],
    borderBottomRightRadius: BorderRadius['2xl'],
    ...Shadows.xs,
  },
  headerTopRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing[3],
  },
  headerActions: {
    flexDirection: 'row-reverse',
    gap: Spacing[2],
  },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconBadge: {
    position: 'absolute',
    top: -5,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  headerIconBadgeText: {
    color: Colors.textInverse,
    fontSize: 9,
    lineHeight: 11,
    fontFamily: FontFamily.bold,
  },
  brandLogo: {
    width: 92,
    height: 92 * (344 / 900), // matches the source logo asset's aspect ratio
  },
  searchBar: {
    backgroundColor: Colors.inputBackground,
    minHeight: 44,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: Spacing[4],
    gap: Spacing[2],
  },
  searchPlaceholder: {
    ...Typography.body,
    color: Colors.placeholder,
    textAlign: 'right',
    fontFamily: FontFamily.arabicRegular,
    flex: 1,
  },
  mainContent: {
    marginTop: Spacing[3],
    gap: Spacing[4],
  },
  bannerOuter: {
    marginHorizontal: HORIZONTAL_PADDING,
  },
  bannerCard: {
    width: BANNER_WIDTH,
    height: 150,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.24)',
  },
  bannerContent: {
    ...StyleSheet.absoluteFillObject,
    padding: Spacing[4],
    justifyContent: 'space-between',
  },
  bannerTitle: {
    ...Typography.h4,
    color: Colors.textInverse,
    fontFamily: FontFamily.arabicBold,
    textAlign: 'right',
    maxWidth: '70%',
    alignSelf: 'flex-end',
  },
  bannerCta: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[1.5],
    borderRadius: BorderRadius.md,
  },
  bannerCtaText: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontFamily: FontFamily.arabicBold,
  },
  dotsRow: {
    marginTop: Spacing[2],
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing[1],
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.border,
  },
  dotActive: {
    width: 18,
    backgroundColor: Colors.secondary,
  },
  emptyBanner: {
    marginHorizontal: HORIZONTAL_PADDING,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing[6],
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBannerText: {
    ...Typography.h4,
    fontFamily: FontFamily.arabicBold,
    textAlign: 'center',
    color: Colors.secondary,
  },
  emptyBannerSubText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontFamily: FontFamily.arabicMedium,
    marginTop: Spacing[1.5],
    textAlign: 'center',
  },
  categoriesSection: {
    minHeight: 94,
  },
  categoriesRow: {
    flexDirection: 'row-reverse',
    paddingHorizontal: HORIZONTAL_PADDING,
    gap: Spacing[2],
  },
  categoryItem: {
    width: 74,
    alignItems: 'center',
    gap: Spacing[1],
  },
  categoryIconWrap: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  categoryImage: {
    width: 52,
    height: 52,
  },
  categoryName: {
    ...Typography.caption,
    color: Colors.textPrimary,
    textAlign: 'center',
    fontFamily: FontFamily.arabicMedium,
    lineHeight: 16,
  },
  categoriesSkeletonRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-around',
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  sectionHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  sectionTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
    fontFamily: FontFamily.arabicBold,
  },
  seeAll: {
    ...Typography.label,
    color: Colors.secondary,
    fontFamily: FontFamily.arabicSemiBold,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: HORIZONTAL_PADDING,
    rowGap: Spacing[3],
  },
  productsRow: {
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  cardWrapper: {
    flex: 1,
    paddingHorizontal: Spacing[1.5],
  },
  emptyProducts: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing[8],
    gap: Spacing[2],
  },
  emptyProductsText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontFamily: FontFamily.arabicMedium,
  },
  loadMoreWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: Spacing[2],
    paddingBottom: Spacing[4],
  },
  loadMoreBtn: {
    minWidth: 160,
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing[5],
    paddingVertical: Spacing[2.5],
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreBtnDisabled: {
    opacity: 0.75,
  },
  loadMoreBtnText: {
    ...Typography.labelLarge,
    color: Colors.textInverse,
    fontFamily: FontFamily.arabicBold,
  },
  allLoadedText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontFamily: FontFamily.arabicMedium,
  },
});
