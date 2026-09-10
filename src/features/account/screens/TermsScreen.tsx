import React from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { TermsService } from '../../../api/terms.service';
import { AccountStackParamList } from '../../../navigation/types';
import { Colors } from '../../../theme/colors';
import { Typography, FontFamily } from '../../../theme/typography';
import { Spacing, BorderRadius } from '../../../theme/spacing';
import { Shadows } from '../../../theme/shadows';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type NavProp = NativeStackNavigationProp<AccountStackParamList, 'Terms'>;

export default function TermsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['terms-page'],
    queryFn: TermsService.getTerms,
    staleTime: 5 * 60 * 1000,
  });

  const openSourcePage = async () => {
    if (!data?.source_url) {
      return;
    }

    try {
      await Linking.openURL(data.source_url);
    } catch {
      // Keep users on the in-app copy if the system cannot open the link.
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + Spacing[2] }]}>
        <TouchableOpacity onPress={() => navigation.navigate('AccountScreen')}>
          <Text style={styles.backText}>رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.title}>الشروط والأحكام</Text>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loader} size="large" color={Colors.primary} />
      ) : error || !data ? (
        <View style={styles.stateWrap}>
          <MaterialCommunityIcons name="alert-circle-outline" style={styles.stateIcon} />
          <Text style={styles.stateTitle}>تعذر تحميل الشروط والأحكام</Text>
          <Text style={styles.stateText}>تحقق من الاتصال بالإنترنت ثم أعد المحاولة</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => refetch()}>
            <Text style={styles.primaryBtnText}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.contentCard}>
            <Text style={styles.pageTitle}>{data.title || 'الشروط والأحكام'}</Text>
            <Text style={styles.bodyText}>{data.body || 'لا يوجد محتوى متاح حالياً.'}</Text>
          </View>

          {Boolean(data.source_url) && (
            <TouchableOpacity style={styles.openPageBtn} onPress={openSourcePage}>
              <Text style={styles.openPageBtnText}>عرض الصفحة الأصلية على الموقع</Text>
            </TouchableOpacity>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.surface,
    paddingTop: Spacing[10],
    paddingBottom: Spacing[3],
    paddingHorizontal: Spacing[4],
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Shadows.sm,
  },
  backText: {
    ...Typography.labelLarge,
    fontSize: 16,
    color: Colors.textPrimary,
    fontFamily: FontFamily.arabicBold,
  },
  title: {
    ...Typography.h4,
    color: Colors.textPrimary,
    fontFamily: FontFamily.arabicBold,
  },
  headerSpacer: { width: 40 },
  loader: { flex: 1, justifyContent: 'center' },
  content: { padding: Spacing[4], gap: Spacing[3] },
  contentCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing[4],
    ...Shadows.card,
  },
  pageTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    textAlign: 'right',
    fontFamily: FontFamily.arabicBold,
    marginBottom: Spacing[3],
  },
  bodyText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'right',
    lineHeight: 28,
    fontFamily: FontFamily.arabicRegular,
  },
  openPageBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing[3],
    alignItems: 'center',
  },
  openPageBtnText: {
    ...Typography.button,
    color: Colors.textInverse,
    fontFamily: FontFamily.arabicBold,
  },
  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing[6],
  },
  stateIcon: { fontSize: 40, color: Colors.textTertiary, marginBottom: Spacing[3] },
  stateTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
    fontFamily: FontFamily.arabicBold,
    marginBottom: Spacing[1],
    textAlign: 'center',
  },
  stateText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginBottom: Spacing[4],
    textAlign: 'center',
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing[5],
    paddingVertical: Spacing[2.5],
  },
  primaryBtnText: {
    ...Typography.button,
    color: Colors.textInverse,
    fontFamily: FontFamily.arabicBold,
  },
  bottomSpacer: { height: 80 },
});
