import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, ActivityIndicator, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { AccountStackParamList } from '../../../navigation/types';
import { PrivacyPolicyService } from '../../../api/privacy-policy.service';
import { Colors } from '../../../theme/colors';
import { Typography, FontFamily } from '../../../theme/typography';
import { Spacing, BorderRadius } from '../../../theme/spacing';
import { Shadows } from '../../../theme/shadows';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type NavProp = NativeStackNavigationProp<AccountStackParamList, 'PrivacyPolicy'>;

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['privacy-policy-page'],
    queryFn: PrivacyPolicyService.getPrivacyPolicy,
    staleTime: 5 * 60 * 1000,
  });

  const openSourcePage = async () => {
    if (!data?.source_url) {
      return;
    }

    try {
      await Linking.openURL(data.source_url);
    } catch {
      // Ignore open-url errors to keep UX calm.
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={[styles.header, { paddingTop: insets.top + Spacing[2] }]}>
        <TouchableOpacity onPress={() => navigation.navigate('AccountScreen')}>
          <Text style={styles.backText}>رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.title}>سياسة الخصوصية</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loader} size="large" color={Colors.primary} />
      ) : error || !data ? (
        <View style={styles.errorWrap}>
          <MaterialCommunityIcons name="alert-circle-outline" style={styles.errorIcon} />
          <Text style={styles.errorTitle}>تعذر تحميل صفحة السياسات</Text>
          <Text style={styles.errorSubTitle}>تحقق من الاتصال بالإنترنت ثم أعد المحاولة</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryText}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.contentCard}>
            <Text style={styles.pageTitle}>{data.title || 'سياسة الخصوصية'}</Text>
            <Text style={styles.bodyText}>{data.body || 'لا يوجد محتوى متاح حالياً.'}</Text>
          </View>

          <TouchableOpacity style={styles.openPageBtn} onPress={openSourcePage}>
            <Text style={styles.openPageBtnText}>عرض الصفحة الأصلية على الموقع</Text>
          </TouchableOpacity>

          <View style={{ height: 80 }} />
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
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing[6],
  },
  errorIcon: { fontSize: 40, marginBottom: Spacing[3] },
  errorTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
    fontFamily: FontFamily.arabicBold,
    marginBottom: Spacing[1],
  },
  errorSubTitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginBottom: Spacing[4],
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing[5],
    paddingVertical: Spacing[2.5],
  },
  retryText: {
    ...Typography.button,
    color: Colors.textInverse,
    fontFamily: FontFamily.arabicBold,
  },
});
