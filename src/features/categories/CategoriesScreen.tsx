/**
 * Categories Screen – Grid layout with main categories and subcategory drill-down.
 */
import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import FastImage from 'react-native-fast-image';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { CategoriesStackParamList } from '../../navigation/types';
import { CategoriesService } from '../../api/categories.service';
import { Category } from '../../types';
import { Colors } from '../../theme/colors';
import { Typography, FontFamily } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { Shadows } from '../../theme/shadows';
import { CategoryChipSkeleton } from '../../components/feedback/Skeleton';
import FloatingCartBar from '../../components/cart/FloatingCartBar';
import { buildFastImageSource, resolveMediaUrl } from '../../utils/media';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type NavProp = NativeStackNavigationProp<CategoriesStackParamList, 'CategoriesScreen'>;

export default function CategoriesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const queryClient = useQueryClient();

  const { data: apiCategories, isLoading, refetch } = useQuery({
    queryKey: ['categories', 0],
    queryFn: () => CategoriesService.getCategories(0),
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  const [refreshing, setRefreshing] = React.useState(false);
  const [navigatingCategoryId, setNavigatingCategoryId] = React.useState<number | null>(null);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const categories = React.useMemo(() => apiCategories ?? [], [apiCategories]);

  React.useEffect(() => {
    const preloadSources = categories
      .map((category) => resolveMediaUrl(category.image?.src))
      .filter(Boolean)
      .slice(0, 18)
      .map((uri) => ({
        uri,
        priority: FastImage.priority.normal,
        cache: FastImage.cacheControl.web,
      }));

    if (preloadSources.length > 0) {
      FastImage.preload(preloadSources);
    }
  }, [categories]);

  const handleCategoryPress = async (cat: Category) => {
    if (navigatingCategoryId === cat.id) return;
    setNavigatingCategoryId(cat.id);

    try {
      const subcategories = await queryClient.fetchQuery({
        queryKey: ['subcategories', cat.id],
        queryFn: () => CategoriesService.getSubcategories(cat.id),
        staleTime: 60 * 1000,
      });

      if (subcategories.length > 0) {
        navigation.navigate('SubcategoryList', {
          categoryId: cat.id,
          categoryName: cat.name,
        });
      } else {
        navigation.navigate('ProductList', {
          categoryId: cat.id,
          categoryName: cat.name,
        });
      }
    } catch {
      navigation.navigate('ProductList', {
        categoryId: cat.id,
        categoryName: cat.name,
      });
    } finally {
      setNavigatingCategoryId(null);
    }
  };

  const renderCategory = ({ item }: { item: Category }) => {
    const imageUri = resolveMediaUrl(item.image?.src);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => {
          handleCategoryPress(item);
        }}
        activeOpacity={0.85}
        disabled={navigatingCategoryId === item.id}
      >
        <View style={styles.imageWrapper}>
          {imageUri ? (
            <FastImage
              source={buildFastImageSource(imageUri, 'normal')}
              style={styles.image}
              resizeMode={FastImage.resizeMode.cover}
            />
          ) : (
            <View style={styles.placeholder}>
              <MaterialCommunityIcons name="shopping-outline" size={28} color={Colors.primary} />
            </View>
          )}
        </View>
        <Text style={styles.categoryName} numberOfLines={2}>{item.name}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing[2] }]}>
        <Text style={styles.title}>الأقسام</Text>
        <Text style={styles.subtitle}>اختر القسم المناسب وابدأ التسوّق</Text>
      </View>

      {isLoading ? (
        <View style={styles.skeletonGrid}>
          {Array.from({ length: 8 }).map((_, i) => (
            <CategoryChipSkeleton key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          data={categories ?? []}
          numColumns={3}
          renderItem={renderCategory}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="folder-outline" size={28} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>لا توجد أقسام متاحة حالياً</Text>
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
    paddingHorizontal: Spacing[5],
    borderBottomLeftRadius: BorderRadius['2xl'],
    borderBottomRightRadius: BorderRadius['2xl'],
  },
  title: { ...Typography.h2, color: Colors.textInverse, fontFamily: FontFamily.arabicBold, textAlign: 'right' },
  subtitle: {
    ...Typography.caption,
    color: 'rgba(255,255,255,0.75)',
    fontFamily: FontFamily.arabicRegular,
    textAlign: 'right',
    marginTop: Spacing[1],
  },
  grid: { padding: Spacing[4], paddingBottom: 100 },
  row: { justifyContent: 'space-between', marginBottom: Spacing[4] },
  card: {
    width: '31%',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
    paddingVertical: Spacing[4],
    paddingHorizontal: Spacing[2],
    ...Shadows.xs,
  },
  imageWrapper: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    backgroundColor: Colors.primarySurface,
    marginBottom: Spacing[2],
  },
  image: { width: 64, height: 64 },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  categoryName: {
    ...Typography.labelSmall, color: Colors.textPrimary,
    fontFamily: FontFamily.arabicMedium, textAlign: 'center',
  },
  emptyText: { ...Typography.caption, color: Colors.textTertiary, marginTop: 2 },
  skeletonGrid: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around',
    padding: Spacing[5], gap: Spacing[5],
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing[12],
  },
});
