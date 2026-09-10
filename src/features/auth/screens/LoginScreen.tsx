/**
 * Login Screen
 * Email + password login with Zod validation, error handling, and forgot password link.
 * Uses react-hook-form for form state.
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
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthStackParamList } from '../../../navigation/types';
import { Colors } from '../../../theme/colors';
import { Typography, FontFamily, FontSize } from '../../../theme/typography';
import { Spacing, BorderRadius } from '../../../theme/spacing';
import { AuthService } from '../../../api/auth.service';
import { useAuthStore } from '../../../store/authStore';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const loginSchema = z.object({
  username: z.string().min(3, 'اسم المستخدم أو البريد الإلكتروني مطلوب'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const response = await AuthService.login({
        username: data.username,
        password: data.password,
      });
      setAuth(response.user, { token: response.token });
      // Navigate back (the redirect or close the auth modal)
      navigation.goBack();
    } catch (err: unknown) {
      const error = err as { message?: string };
      Alert.alert('خطأ في تسجيل الدخول', error?.message ?? 'تحقق من بياناتك وحاول مجدداً');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing[4] }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>D</Text>
          </View>
          <Text style={styles.title}>مرحباً بك</Text>
          <Text style={styles.subtitle}>سجّل دخولك للمتابعة</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Username */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.label}>اسم المستخدم أو البريد الإلكتروني</Text>
            <Controller
              control={control}
              name="username"
              render={({ field: { onChange, value, onBlur } }) => (
                <TextInput
                  style={[styles.input, errors.username && styles.inputError]}
                  placeholder="أدخل اسم المستخدم"
                  placeholderTextColor={Colors.placeholder}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="next"
                  textAlign="right"
                />
              )}
            />
            {errors.username && (
              <Text style={styles.errorText}>{errors.username.message}</Text>
            )}
          </View>

          {/* Password */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.label}>كلمة المرور</Text>
            <View style={styles.passwordWrapper}>
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, value, onBlur } }) => (
                  <TextInput
                    style={[styles.input, styles.passwordInput, errors.password && styles.inputError]}
                    placeholder="أدخل كلمة المرور"
                    placeholderTextColor={Colors.placeholder}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    secureTextEntry={!showPassword}
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit(onSubmit)}
                    textAlign="right"
                  />
                )}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword(!showPassword)}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                <MaterialCommunityIcons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  style={styles.eyeIcon}
                />
              </TouchableOpacity>
            </View>
            {errors.password && (
              <Text style={styles.errorText}>{errors.password.message}</Text>
            )}
          </View>

          {/* Forgot Password */}
          <TouchableOpacity
            onPress={() => navigation.navigate('ForgotPassword')}
            style={styles.forgotBtn}
            accessibilityRole="button"
            accessibilityLabel="نسيت كلمة المرور؟"
          >
            <Text style={styles.forgotText}>نسيت كلمة المرور؟</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginBtn, isLoading && styles.loginBtnDisabled]}
            onPress={handleSubmit(onSubmit)}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel="تسجيل الدخول"
            accessibilityState={{ disabled: isLoading, busy: isLoading }}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.textInverse} />
            ) : (
              <Text style={styles.loginBtnText}>تسجيل الدخول</Text>
            )}
          </TouchableOpacity>

          {/* Register Link */}
          <View style={styles.registerRow}>
            <Text style={styles.registerPrompt}>ليس لديك حساب؟ </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}
              accessibilityRole="button"
              accessibilityLabel="إنشاء حساب"
            >
              <Text style={styles.registerLink}>إنشاء حساب</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  container: { flex: 1 },
  content: { flexGrow: 1, padding: Spacing[5], paddingTop: Spacing[10] },

  header: { alignItems: 'center', marginBottom: Spacing[8] },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[4],
  },
  logoText: { fontSize: 36, fontWeight: '800', color: Colors.secondary, fontFamily: FontFamily.extraBold },
  title: { ...Typography.h2, color: Colors.textPrimary, marginBottom: Spacing[1] },
  subtitle: { ...Typography.body, color: Colors.textSecondary },

  form: { gap: Spacing[4] },
  fieldWrapper: { gap: Spacing[1.5] },
  label: { ...Typography.labelLarge, color: Colors.textPrimary, textAlign: 'right' },
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
  passwordWrapper: { position: 'relative' },
  passwordInput: { paddingLeft: 48 },
  eyeBtn: { position: 'absolute', left: Spacing[3], top: 14 },
  eyeIcon: { fontSize: 18, color: Colors.textSecondary },

  errorText: { ...Typography.caption, color: Colors.error, textAlign: 'right' },

  forgotBtn: { alignSelf: 'flex-end' },
  forgotText: { ...Typography.labelLarge, color: Colors.primaryDark },

  loginBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing[4],
    alignItems: 'center',
    marginTop: Spacing[2],
  },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnText: { ...Typography.button, color: Colors.textInverse, fontFamily: FontFamily.arabicBold },

  registerRow: { flexDirection: 'row-reverse', justifyContent: 'center', marginTop: Spacing[2] },
  registerPrompt: { ...Typography.body, color: Colors.textSecondary },
  registerLink: { ...Typography.labelLarge, color: Colors.primaryDark },
});
