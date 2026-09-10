import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AuthStackParamList } from '../../../navigation/types';
import { Colors } from '../../../theme/colors';
import { Typography, FontFamily, FontSize } from '../../../theme/typography';
import { Spacing, BorderRadius } from '../../../theme/spacing';
import { AuthService } from '../../../api/auth.service';
import { useAuthStore } from '../../../store/authStore';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

const registerSchema = z.object({
  first_name: z.string().min(2, 'الاسم الأول مطلوب'),
  last_name: z.string().min(2, 'اسم العائلة مطلوب'),
  email: z.string().email('البريد الإلكتروني غير صالح'),
  password: z.string().min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'كلمات المرور غير متطابقة',
  path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterScreen({ navigation }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const showPassword = false;
  const setAuth = useAuthStore((s) => s.setAuth);

  const { control, handleSubmit, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    try {
      const response = await AuthService.register({
        email: data.email,
        username: data.email,
        password: data.password,
        first_name: data.first_name,
        last_name: data.last_name,
      });
      setAuth(response.user, { token: response.token });
      navigation.goBack();
    } catch (err: unknown) {
      const error = err as { message?: string };
      Alert.alert('خطأ في التسجيل', error?.message ?? 'حدث خطأ، يرجى المحاولة مجدداً');
    } finally {
      setIsLoading(false);
    }
  };

  const fields: Array<{ name: keyof RegisterForm; label: string; placeholder: string; keyboard?: 'email-address' | 'default'; secure?: boolean }> = [
    { name: 'first_name', label: 'الاسم الأول', placeholder: 'أدخل اسمك الأول' },
    { name: 'last_name', label: 'اسم العائلة', placeholder: 'أدخل اسم العائلة' },
    { name: 'email', label: 'البريد الإلكتروني', placeholder: 'email@example.com', keyboard: 'email-address' },
    { name: 'password', label: 'كلمة المرور', placeholder: 'أدخل كلمة المرور', secure: true },
    { name: 'confirmPassword', label: 'تأكيد كلمة المرور', placeholder: 'أعد إدخال كلمة المرور', secure: true },
  ];

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="رجوع"
          >
            <Text style={styles.backText}>رجوع</Text>
          </TouchableOpacity>
          <Text style={styles.title}>إنشاء حساب جديد</Text>
          <Text style={styles.subtitle}>انضم إلينا وابدأ التسوق</Text>
        </View>

        <View style={styles.form}>
          {fields.map((field) => (
            <View key={field.name} style={styles.fieldWrapper}>
              <Text style={styles.label}>{field.label}</Text>
              <Controller
                control={control}
                name={field.name}
                render={({ field: { onChange, value, onBlur } }) => (
                  <TextInput
                    style={[styles.input, errors[field.name] && styles.inputError]}
                    placeholder={field.placeholder}
                    placeholderTextColor={Colors.placeholder}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    secureTextEntry={field.secure && !showPassword}
                    keyboardType={field.keyboard}
                    autoCapitalize="none"
                    textAlign="right"
                  />
                )}
              />
              {errors[field.name] && (
                <Text style={styles.errorText}>{errors[field.name]?.message}</Text>
              )}
            </View>
          ))}

          <TouchableOpacity
            style={[styles.registerBtn, isLoading && styles.disabled]}
            onPress={handleSubmit(onSubmit)}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel="إنشاء الحساب"
            accessibilityState={{ disabled: isLoading, busy: isLoading }}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.textInverse} />
            ) : (
              <Text style={styles.registerBtnText}>إنشاء الحساب</Text>
            )}
          </TouchableOpacity>

          <View style={styles.loginRow}>
            <Text style={styles.loginPrompt}>لديك حساب بالفعل؟ </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              accessibilityRole="button"
              accessibilityLabel="تسجيل الدخول"
            >
              <Text style={styles.loginLink}>تسجيل الدخول</Text>
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
  content: { flexGrow: 1, padding: Spacing[5], paddingTop: Spacing[8] },
  header: { marginBottom: Spacing[6] },
  backBtn: { marginBottom: Spacing[4] },
  backText: { fontSize: 16, color: Colors.textPrimary },
  title: { ...Typography.h2, color: Colors.textPrimary, textAlign: 'right', marginBottom: Spacing[1] },
  subtitle: { ...Typography.body, color: Colors.textSecondary, textAlign: 'right' },
  form: { gap: Spacing[3] },
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
    textAlign: 'right',
  },
  inputError: { borderColor: Colors.error },
  errorText: { ...Typography.caption, color: Colors.error, textAlign: 'right' },
  registerBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing[4],
    alignItems: 'center',
    marginTop: Spacing[2],
  },
  disabled: { opacity: 0.7 },
  registerBtnText: { ...Typography.button, color: Colors.textInverse, fontFamily: FontFamily.arabicBold },
  loginRow: { flexDirection: 'row-reverse', justifyContent: 'center', marginTop: Spacing[2] },
  loginPrompt: { ...Typography.body, color: Colors.textSecondary },
  loginLink: { ...Typography.labelLarge, color: Colors.primaryDark },
});
