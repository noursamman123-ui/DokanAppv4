/**
 * Link Phone Screen
 * Attaches a WhatsApp-verified phone number to the currently logged-in
 * account, so it can be used to log in afterward via PhoneLoginScreen.
 * Reuses the same PhoneOtpFlow UI, wired to the link-phone send/verify
 * endpoints (which require an existing auth session).
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccountStackParamList } from '../../../navigation/types';
import { Colors } from '../../../theme/colors';
import { Typography } from '../../../theme/typography';
import { Spacing } from '../../../theme/spacing';
import { useAuthStore } from '../../../store/authStore';
import { CheckoutOtpService } from '../../../api/checkout-otp.service';
import PhoneOtpFlow from '../../../components/auth/PhoneOtpFlow';
import { OtpLinkPhoneVerifyResponse } from '../../../types';

type Props = NativeStackScreenProps<AccountStackParamList, 'LinkPhone'>;

export default function LinkPhoneScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const updateUser = useAuthStore((s) => s.updateUser);
  const currentPhone = useAuthStore((s) => s.user?.phone);

  const handleVerified = (result: OtpLinkPhoneVerifyResponse) => {
    updateUser(result.user);
    Alert.alert('تم الربط بنجاح', 'تم ربط رقم جوالك بحسابك. يمكنك الآن استخدامه لتسجيل الدخول.', [
      { text: 'حسناً', onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.headerBar, { paddingTop: insets.top + Spacing[2] }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="رجوع"
          style={styles.backBtn}
        >
          <MaterialCommunityIcons name="chevron-right" style={styles.backIcon} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ربط رقم الجوال</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <Text style={styles.subtitle}>
            {currentPhone
              ? `رقمك الحالي المرتبط: ${currentPhone}. يمكنك ربط رقم جديد بدلاً منه.`
              : 'اربط رقم جوالك بحسابك لتتمكن من تسجيل الدخول به مباشرة عبر رمز واتساب.'}
          </Text>
        </View>

        <PhoneOtpFlow<OtpLinkPhoneVerifyResponse>
          submitLabel="ربط الرقم"
          sendOtp={CheckoutOtpService.sendLinkPhoneOtp}
          verifyOtp={CheckoutOtpService.verifyLinkPhoneOtp}
          onVerified={handleVerified}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  headerBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing[4],
    paddingBottom: Spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 26, color: Colors.textPrimary },
  headerTitle: { ...Typography.h4, color: Colors.textPrimary },
  container: { flex: 1 },
  content: { flexGrow: 1, padding: Spacing[5] },
  intro: { marginBottom: Spacing[6] },
  subtitle: { ...Typography.body, color: Colors.textSecondary, textAlign: 'right' },
});
