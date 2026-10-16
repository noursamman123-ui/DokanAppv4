/**
 * Collect Email Screen
 * Shown once, right after a brand-new account is created via WhatsApp phone
 * login — that account starts with a synthetic placeholder email
 * ("<digits>@dokanapp.local"), so this is the first chance to attach a real,
 * reachable one. Skippable — a missing real email isn't fatal, just worse
 * for account recovery/contact, and can always be added later from
 * "تعديل الملف الشخصي".
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { AuthStackParamList } from '../../../navigation/types';
import { Colors } from '../../../theme/colors';
import { Typography, FontFamily, FontSize } from '../../../theme/typography';
import { Spacing, BorderRadius } from '../../../theme/spacing';
import { AuthService } from '../../../api/auth.service';
import { useAuthStore } from '../../../store/authStore';

type Props = NativeStackScreenProps<AuthStackParamList, 'CollectEmail'>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function CollectEmailScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const goToApp = () => {
    (navigation as any).getParent()?.navigate('Main');
  };

  const handleSave = async () => {
    const trimmed = email.trim();
    if (!EMAIL_REGEX.test(trimmed)) {
      setError('يرجى إدخال بريد إلكتروني صحيح.');
      return;
    }
    if (!user) {
      goToApp();
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      const updated = await AuthService.updateProfile(user.id, { email: trimmed });
      updateUser(updated);
      goToApp();
    } catch (err) {
      const apiError = err as { code?: string; message?: string };
      setError(
        apiError?.code === 'email_exists'
          ? 'هذا البريد الإلكتروني مستخدم بالفعل في حساب آخر.'
          : apiError?.message ?? 'تعذر حفظ البريد الإلكتروني. حاول مرة أخرى.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing[6] }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.iconBadge}>
            <MaterialCommunityIcons name="email-outline" style={styles.icon} />
          </View>
          <Text style={styles.title}>أدخل بريدك الإلكتروني</Text>
          <Text style={styles.subtitle}>
            لإتمام حسابك واستخدامه لاستعادة الحساب والتواصل معك بخصوص طلباتك
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={[styles.input, error && styles.inputError]}
            placeholder="example@email.com"
            placeholderTextColor={Colors.placeholder}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textAlign="right"
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.saveBtn, isSaving && styles.disabledBtn]}
            onPress={handleSave}
            disabled={isSaving}
            accessibilityRole="button"
            accessibilityLabel="حفظ البريد الإلكتروني"
            accessibilityState={{ disabled: isSaving, busy: isSaving }}
          >
            {isSaving ? <ActivityIndicator color={Colors.textInverse} /> : <Text style={styles.saveBtnText}>حفظ ومتابعة</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={goToApp} accessibilityRole="button" accessibilityLabel="تخطي">
            <Text style={styles.skipText}>تخطي الآن</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  container: { flex: 1 },
  content: { flexGrow: 1, padding: Spacing[5] },
  header: { alignItems: 'center', marginBottom: Spacing[8], gap: Spacing[2] },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[2],
  },
  icon: { fontSize: 34, color: Colors.primary },
  title: { ...Typography.h2, color: Colors.textPrimary, textAlign: 'center' },
  subtitle: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },

  form: { gap: Spacing[4] },
  input: {
    backgroundColor: Colors.inputBackground,
    borderWidth: 1.5,
    borderColor: Colors.inputBorder,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    fontFamily: FontFamily.arabicRegular,
  },
  inputError: { borderColor: Colors.error },
  errorText: { ...Typography.caption, color: Colors.error, textAlign: 'right' },

  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing[4],
    alignItems: 'center',
  },
  disabledBtn: { opacity: 0.7 },
  saveBtnText: { ...Typography.button, color: Colors.textInverse, fontFamily: FontFamily.arabicBold },

  skipText: { ...Typography.labelLarge, color: Colors.textSecondary, textAlign: 'center' },
});
