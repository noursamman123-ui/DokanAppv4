/**
 * Phone Login Screen
 * Passwordless login via a WhatsApp OTP — finds or creates an account keyed
 * by the verified phone number. Reuses the same PhoneOtpFlow UI as
 * LinkPhoneScreen, just wired to the login send/verify endpoints.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthStackParamList } from '../../../navigation/types';
import { Colors } from '../../../theme/colors';
import { Typography } from '../../../theme/typography';
import { Spacing } from '../../../theme/spacing';
import { useAuthStore } from '../../../store/authStore';
import { CheckoutOtpService } from '../../../api/checkout-otp.service';
import PhoneOtpFlow from '../../../components/auth/PhoneOtpFlow';
import { OtpLoginVerifyResponse } from '../../../types';

type Props = NativeStackScreenProps<AuthStackParamList, 'PhoneLogin'>;

export default function PhoneLoginScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const setAuth = useAuthStore((s) => s.setAuth);

  const handleVerified = (result: OtpLoginVerifyResponse) => {
    setAuth(result.user, { token: result.token });
    if (result.is_new_user) {
      // A brand-new account starts with a synthetic placeholder email —
      // this is the first chance to attach a real one.
      navigation.navigate('CollectEmail');
      return;
    }
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing[4] }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>تسجيل الدخول برقم الجوال</Text>
          <Text style={styles.subtitle}>سنرسل لك رمز تحقق عبر واتساب لتسجيل الدخول أو إنشاء حساب جديد</Text>
        </View>

        <PhoneOtpFlow<OtpLoginVerifyResponse>
          submitLabel="إرسال رمز التحقق"
          sendOtp={CheckoutOtpService.sendLoginOtp}
          verifyOtp={CheckoutOtpService.verifyLoginOtp}
          onVerified={handleVerified}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  container: { flex: 1 },
  content: { flexGrow: 1, padding: Spacing[5], paddingTop: Spacing[10] },
  header: { alignItems: 'center', marginBottom: Spacing[8], gap: Spacing[1] },
  title: { ...Typography.h2, color: Colors.textPrimary, textAlign: 'center' },
  subtitle: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },
});
