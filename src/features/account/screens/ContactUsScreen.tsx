import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, ActivityIndicator, Linking, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { AccountStackParamList } from '../../../navigation/types';
import { ContactService } from '../../../api/contact.service';
import { Colors } from '../../../theme/colors';
import { Typography, FontFamily } from '../../../theme/typography';
import { Spacing, BorderRadius } from '../../../theme/spacing';
import { Shadows } from '../../../theme/shadows';
import { APP_HOSTNAME } from '../../../config/environment';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type NavProp = NativeStackNavigationProp<AccountStackParamList, 'ContactUs'>;

export default function ContactUsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { width } = useWindowDimensions();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['contact-page'],
    queryFn: ContactService.getContactInfo,
    staleTime: 5 * 60 * 1000,
  });

  const openUrl = async (url: string) => {
    const target = url.trim();
    if (!target) {
      return;
    }

    try {
      await Linking.openURL(target);
    } catch {
      // ignore to avoid noisy UX
    }
  };

  const sections = useMemo(() => {
    if (!data) {
      return [];
    }

    const hostname = (() => {
      try {
        return new URL(data.source_url).hostname.replace(/^www\./, '');
      } catch {
        return APP_HOSTNAME;
      }
    })();

    const emails = data.emails.map((email) => email.toLowerCase());
    const phones = data.phones;

    const findEmail = (matcher: RegExp) => emails.find((email) => matcher.test(email)) ?? '';

    const directEmail = findEmail(/^(contact|info)@/);
    const csEmail = findEmail(/^cs@/);
    const mediaEmail = findEmail(/^media@/);
    const vendorEmail = findEmail(/^vendor@/);
    const careerEmail = findEmail(/^career@/);

    const primaryPhone = phones[0] ?? '';

    const headquartersAddress = 'حماه ، الجمهورية العربية السورية';

    const formatPhoneDisplay = (phone: string) => {
      const digits = phone.replace(/\D+/g, '');
      if (digits.startsWith('963')) {
        const local = digits.slice(3);
        if (local.length >= 9) {
          return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6, 9)} (963+)`;
        }
        return `${local} (963+)`;
      }
      return phone;
    };

    const blocks = [
      {
        id: 'direct',
        title: 'التواصل المباشر',
        email: directEmail || `contact@${hostname}`,
        phone: formatPhoneDisplay(primaryPhone),
      },
      {
        id: 'hq',
        title: 'المقر الرئيسي',
        description: headquartersAddress,
      },
      {
        id: 'career',
        title: 'الانضمام إلى فريق العمل',
        description: 'أرسل السيرة الذاتية على البريد التالي:',
        email: careerEmail || `career@${hostname}`,
      },
      {
        id: 'cs',
        title: 'خدمة العملاء',
        email: csEmail || `cs@${hostname}`,
        phone: formatPhoneDisplay(primaryPhone),
      },
      {
        id: 'media',
        title: 'العلاقات الإعلامية',
        email: mediaEmail || `media@${hostname}`,
      },
      {
        id: 'vendor',
        title: 'دعم التجار',
        email: vendorEmail || `vendor@${hostname}`,
      },
    ];

    return blocks;
  }, [data]);

  const gridColumns = width >= 900 ? 3 : width >= 540 ? 2 : 1;
  const cardBasis = gridColumns === 3 ? '31.7%' : gridColumns === 2 ? '48.2%' : '100%';
  const heroFontSize = width >= 1000 ? 52 : width >= 700 ? 44 : width >= 430 ? 36 : 30;
  const heroLineHeight = Math.round(heroFontSize * 1.28);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={[styles.header, { paddingTop: insets.top + Spacing[2] }]}>
        <TouchableOpacity
          onPress={() => navigation.navigate('AccountScreen')}
          accessibilityRole="button"
          accessibilityLabel="رجوع"
        >
          <Text style={styles.backText}>رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.title}>تواصل معنا لأي استفسار</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loader} size="large" color={Colors.primary} />
      ) : error || !data ? (
        <View style={styles.errorWrap}>
          <MaterialCommunityIcons name="alert-circle-outline" style={styles.errorIcon} />
          <Text style={styles.errorTitle}>تعذر جلب بيانات التواصل</Text>
          <Text style={styles.errorSubTitle}>تحقق من الاتصال ثم أعد المحاولة</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => refetch()}
            accessibilityRole="button"
            accessibilityLabel="إعادة المحاولة"
          >
            <Text style={styles.retryText}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.heroBlock}>
            <Text style={[styles.heroTitle, { fontSize: heroFontSize, lineHeight: heroLineHeight }]}>
              تواصل معنا لأي استفسار
            </Text>
          </View>

          <View style={styles.grid}>
            {sections.map((section) => (
              <View key={section.id} style={[styles.gridCard, { flexBasis: cardBasis }]}>
                <Text style={styles.gridCardTitle}>{section.title}</Text>

                {section.description ? (
                  <Text style={styles.gridCardSubText}>{section.description}</Text>
                ) : null}

                {section.email ? (
                  <TouchableOpacity
                    onPress={() => openUrl(`mailto:${section.email}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`مراسلة عبر البريد الإلكتروني ${section.email}`}
                  >
                    <Text style={styles.gridCardEmail}>{section.email}</Text>
                  </TouchableOpacity>
                ) : null}

                {section.phone ? (
                  <TouchableOpacity
                    onPress={() => openUrl(`tel:${section.phone}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`الاتصال بالرقم ${section.phone}`}
                  >
                    <Text style={styles.gridCardPhone}>{section.phone}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
          </View>

          <View style={styles.actionsRow}>
            {data.whatsapp_links[0] ? (
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => openUrl(data.whatsapp_links[0])}
                accessibilityRole="button"
                accessibilityLabel="واتساب مباشر"
              >
                <Text style={styles.secondaryBtnText}>واتساب مباشر</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => openUrl(data.source_url)}
              accessibilityRole="button"
              accessibilityLabel="فتح صفحة التواصل"
            >
              <Text style={styles.primaryBtnText}>فتح صفحة التواصل</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 100 }} />
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
  title: { ...Typography.h4, color: Colors.textPrimary, fontFamily: FontFamily.arabicBold },
  loader: { flex: 1, justifyContent: 'center' },
  content: { paddingHorizontal: Spacing[4], paddingTop: Spacing[6], gap: Spacing[5] },
  heroBlock: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing[6],
    paddingBottom: Spacing[6],
  },
  heroTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    textAlign: 'center',
    fontFamily: FontFamily.arabicBold,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing[6],
    columnGap: Spacing[3],
  },
  gridCard: {
    backgroundColor: 'transparent',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing[4],
    paddingHorizontal: Spacing[4],
    minHeight: 130,
    justifyContent: 'flex-start',
  },
  gridCardTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    fontFamily: FontFamily.arabicBold,
    textAlign: 'center',
    marginBottom: Spacing[2.5],
  },
  gridCardSubText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontFamily: FontFamily.arabicRegular,
    lineHeight: 24,
    marginBottom: Spacing[2.5],
  },
  gridCardEmail: {
    ...Typography.bodyLarge,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontFamily: FontFamily.medium,
    marginBottom: Spacing[2],
  },
  gridCardPhone: {
    ...Typography.h4,
    color: Colors.textPrimary,
    textAlign: 'center',
    fontFamily: FontFamily.extraBold,
  },
  actionsRow: {
    marginTop: Spacing[2],
    flexDirection: 'row-reverse',
    gap: Spacing[2],
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: Colors.textPrimary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    ...Typography.button,
    color: Colors.textInverse,
    fontFamily: FontFamily.arabicBold,
  },
  secondaryBtnText: {
    ...Typography.button,
    color: Colors.textPrimary,
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
