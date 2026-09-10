import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthStackParamList } from '../../../navigation/types';
import { Colors } from '../../../theme/colors';
import { Typography, FontFamily } from '../../../theme/typography';
import { Spacing, BorderRadius } from '../../../theme/spacing';
import { AuthService } from '../../../api/auth.service';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setIsLoading(true);
    try {
      await AuthService.forgotPassword(email.trim());
      setSent(true);
    } catch (err: unknown) {
      const error = err as { message?: string };
      Alert.alert('خطأ', error?.message ?? 'حدث خطأ، يرجى المحاولة مجدداً');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing[4] }]}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Text style={styles.backText}>رجوع</Text>
      </TouchableOpacity>

      <Text style={styles.title}>استعادة كلمة المرور</Text>
      <Text style={styles.subtitle}>أدخل بريدك الإلكتروني وسنرسل لك رابط لاستعادة كلمة المرور</Text>

      {sent ? (
        <View style={styles.successBox}>
          <Text style={styles.successIcon}>✅</Text>
          <Text style={styles.successText}>تم إرسال رابط الاستعادة إلى بريدك الإلكتروني</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.backToLogin}>العودة لتسجيل الدخول</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <TextInput
            style={styles.input}
            placeholder="البريد الإلكتروني"
            placeholderTextColor={Colors.placeholder}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            textAlign="right"
          />
          <TouchableOpacity
            style={[styles.submitBtn, isLoading && styles.disabled]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.textInverse} />
            ) : (
              <Text style={styles.submitText}>إرسال رابط الاستعادة</Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface, padding: Spacing[5], paddingTop: Spacing[10] },
  backBtn: { marginBottom: Spacing[6] },
  backText: { fontSize: 16, color: Colors.textPrimary },
  title: { ...Typography.h2, color: Colors.textPrimary, textAlign: 'right', marginBottom: Spacing[2] },
  subtitle: { ...Typography.body, color: Colors.textSecondary, textAlign: 'right', marginBottom: Spacing[6] },
  input: {
    backgroundColor: Colors.inputBackground,
    borderWidth: 1.5,
    borderColor: Colors.inputBorder,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    fontSize: 16,
    color: Colors.textPrimary,
    fontFamily: FontFamily.arabicRegular,
    marginBottom: Spacing[4],
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing[4],
    alignItems: 'center',
  },
  disabled: { opacity: 0.7 },
  submitText: { ...Typography.button, color: Colors.textInverse, fontFamily: FontFamily.arabicBold },
  successBox: { alignItems: 'center', gap: Spacing[4], marginTop: Spacing[8] },
  successIcon: { fontSize: 48 },
  successText: { ...Typography.bodyLarge, color: Colors.textPrimary, textAlign: 'center' },
  backToLogin: { ...Typography.labelLarge, color: Colors.primaryDark },
});
