/**
 * Account Screen – User profile hub with navigation to sub-screens.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccountStackParamList } from '../../../navigation/types';
import { useAuthStore } from '../../../store/authStore';
import { Colors } from '../../../theme/colors';
import { Typography, FontFamily } from '../../../theme/typography';
import { Spacing, BorderRadius } from '../../../theme/spacing';
import { Shadows } from '../../../theme/shadows';
import { AuthService } from '../../../api/auth.service';
import pkg from '../../../../package.json';

type NavProp = NativeStackNavigationProp<AccountStackParamList, 'AccountScreen'>;

export default function AccountScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const menuItems = [
    // Guests can view orders placed on this device (or recover them via
    // phone + WhatsApp OTP) without logging in — OrdersScreen handles both.
    { icon: 'package-variant-closed', label: 'طلباتي', screen: 'Orders' as const, requireAuth: false },
    { icon: 'account-edit-outline', label: 'تعديل الملف الشخصي', screen: 'EditProfile' as const, requireAuth: true },
    { icon: 'whatsapp', label: 'ربط رقم الجوال', screen: 'LinkPhone' as const, requireAuth: true },
    { icon: 'map-marker-outline', label: 'عناويني', screen: 'Addresses' as const, requireAuth: true },
    { icon: 'bell-outline', label: 'الإشعارات', screen: 'Notifications' as const, requireAuth: false },
    { icon: 'shield-lock-outline', label: 'سياسة الخصوصية', screen: 'PrivacyPolicy' as const, requireAuth: false },
    { icon: 'file-document-outline', label: 'الشروط والأحكام', screen: 'Terms' as const, requireAuth: false },
    { icon: 'phone-outline', label: 'تواصل معنا', screen: 'ContactUs' as const, requireAuth: false },
  ];

  const handleMenuPress = (item: typeof menuItems[0]) => {
    if (item.requireAuth && !isAuthenticated) {
      navigation.getParent()?.getParent()?.navigate('Auth', { screen: 'Login' });
      return;
    }
    (navigation as any).navigate(item.screen);
  };

  const confirmDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      await AuthService.deleteAccount();
      logout();
      Alert.alert('تم حذف الحساب', 'تم حذف حسابك بنجاح.');
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: unknown }).message)
          : 'تعذر حذف الحساب الآن. حاول مرة أخرى.';

      Alert.alert('تعذر حذف الحساب', message);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleDeleteAccount = () => {
    if (!isAuthenticated) {
      Alert.alert('تسجيل الدخول مطلوب', 'لحذف الحساب، يرجى تسجيل الدخول أولًا.');
      navigation.getParent()?.getParent()?.navigate('Auth', { screen: 'Login' });
      return;
    }

    if (isDeletingAccount) {
      return;
    }

    Alert.alert(
      'حذف الحساب',
      'سيتم حذف حسابك وبياناتك الشخصية نهائيًا ولا يمكن التراجع عن ذلك.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف الحساب',
          style: 'destructive',
          onPress: () => {
            confirmDeleteAccount();
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} />

      <View style={[styles.header, { paddingTop: insets.top + Spacing[2] }]}>
        <Text style={styles.title}>حسابي</Text>
        <Text style={styles.subtitle}>إدارة بياناتك وطلباتك</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        {isAuthenticated && user ? (
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user.first_name?.charAt(0) ?? user.email.charAt(0)}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user.first_name} {user.last_name}</Text>
              <Text style={styles.profileEmail}>{user.email}</Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.loginCard}
            onPress={() => navigation.getParent()?.getParent()?.navigate('Auth', { screen: 'Login' })}
            accessibilityRole="button"
            accessibilityLabel="سجّل دخولك"
          >
            <View style={styles.loginIcon}>
              <MaterialCommunityIcons name="account" style={styles.loginIconText} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.loginTitle}>سجّل دخولك</Text>
              <Text style={styles.loginSubtitle}>تسجيل الدخول اختياري — لحفظ ملفك الشخصي وعناوينك عبر جميع أجهزتك</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Menu Items */}
        <View style={styles.menuContainer}>
          {menuItems.map((item, i) => (
            <TouchableOpacity
              key={i}
              style={styles.menuItem}
              onPress={() => handleMenuPress(item)}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <View style={styles.menuRow}>
                <MaterialCommunityIcons name={item.icon as any} style={styles.menuIcon} />
                <Text style={styles.menuLabel}>{item.label}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-left" style={styles.menuArrow} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        {isAuthenticated && (
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={logout}
            accessibilityRole="button"
            accessibilityLabel="تسجيل الخروج"
          >
            <Text style={styles.logoutText}>تسجيل الخروج</Text>
          </TouchableOpacity>
        )}

        {/* Account Deletion */}
        <TouchableOpacity
          style={[styles.deleteAccountBtn, isDeletingAccount && styles.disabledBtn]}
          onPress={handleDeleteAccount}
          disabled={isDeletingAccount}
          accessibilityRole="button"
          accessibilityLabel="حذف الحساب"
          accessibilityState={{ disabled: isDeletingAccount, busy: isDeletingAccount }}
        >
          {isDeletingAccount ? (
            <ActivityIndicator color={Colors.error} />
          ) : (
            <>
              <MaterialCommunityIcons name="account-remove-outline" style={styles.deleteAccountIcon} />
              <Text style={styles.deleteAccountText}>
                {isAuthenticated ? 'حذف الحساب' : 'حذف الحساب '}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* App Version */}
        <Text style={styles.version}>الإصدار {pkg.version}</Text>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.secondary, paddingTop: Spacing[10], paddingBottom: Spacing[4],
    paddingHorizontal: Spacing[5],
    borderBottomLeftRadius: BorderRadius['2xl'],
    borderBottomRightRadius: BorderRadius['2xl'],
  },
  title: { ...Typography.h2, color: Colors.textInverse, fontFamily: FontFamily.arabicBold, textAlign: 'right' },
  subtitle: {
    ...Typography.caption,
    color: 'rgba(255,255,255,0.74)',
    fontFamily: FontFamily.arabicRegular,
    textAlign: 'right',
    marginTop: Spacing[1],
  },
  scrollContent: { padding: Spacing[4] },

  profileCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing[5],
    flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing[4], marginBottom: Spacing[4], ...Shadows.xs, borderWidth: 1, borderColor: Colors.borderLight,
  },
  avatar: {
    width: 56, height: 56, borderRadius: BorderRadius.full, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 24, fontWeight: '700', color: Colors.secondary },
  profileInfo: { flex: 1 },
  profileName: { ...Typography.h4, color: Colors.textPrimary, fontFamily: FontFamily.arabicBold, textAlign: 'right' },
  profileEmail: { ...Typography.bodySmall, color: Colors.textSecondary, textAlign: 'right' },

  loginCard: {
    backgroundColor: Colors.primarySurface, borderRadius: BorderRadius.xl, padding: Spacing[5],
    flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing[4], marginBottom: Spacing[4],
    borderWidth: 1, borderColor: Colors.primary, borderStyle: 'dashed',
  },
  loginIcon: { width: 50, height: 50, borderRadius: BorderRadius.full, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  loginIconText: { fontSize: 24, color: Colors.textInverse },
  loginTitle: { ...Typography.h4, color: Colors.textPrimary, fontFamily: FontFamily.arabicBold, textAlign: 'right' },
  loginSubtitle: { ...Typography.bodySmall, color: Colors.textSecondary, textAlign: 'right' },

  menuContainer: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, overflow: 'hidden', ...Shadows.xs, borderWidth: 1, borderColor: Colors.borderLight,
  },
  menuItem: {
    flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: Spacing[4], paddingHorizontal: Spacing[5],
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  menuRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing[3] },
  menuIcon: { fontSize: 18, color: Colors.textSecondary },
  menuLabel: { ...Typography.body, color: Colors.textPrimary, fontFamily: FontFamily.arabicMedium },
  menuArrow: { fontSize: 16, color: Colors.textTertiary },

  logoutBtn: {
    marginTop: Spacing[4], backgroundColor: Colors.errorLight, borderRadius: BorderRadius.xl,
    paddingVertical: Spacing[4], alignItems: 'center',
  },
  logoutText: { ...Typography.button, color: Colors.error, fontFamily: FontFamily.arabicBold },
  deleteAccountBtn: {
    marginTop: Spacing[3],
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.error,
    paddingVertical: Spacing[4],
    paddingHorizontal: Spacing[5],
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row-reverse',
    gap: Spacing[2],
  },
  deleteAccountIcon: { fontSize: 18, color: Colors.error },
  deleteAccountText: { ...Typography.button, color: Colors.error, fontFamily: FontFamily.arabicBold },
  disabledBtn: { opacity: 0.55 },
  version: { ...Typography.caption, color: Colors.textTertiary, textAlign: 'center', marginTop: Spacing[6] },
  bottomSpacer: { height: 100 },
});
