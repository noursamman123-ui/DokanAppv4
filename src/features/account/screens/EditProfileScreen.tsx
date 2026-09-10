import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, StatusBar, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../../store/authStore';
import { AuthService } from '../../../api/auth.service';
import { Colors } from '../../../theme/colors';
import { Typography, FontFamily, FontSize } from '../../../theme/typography';
import { Spacing, BorderRadius } from '../../../theme/spacing';
import { Shadows } from '../../../theme/shadows';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user, updateUser } = useAuthStore();
  const [firstName, setFirstName] = useState(user?.first_name ?? '');
  const [lastName, setLastName] = useState(user?.last_name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? user?.billing?.phone ?? '');
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const updated = await AuthService.updateProfile(user.id, { first_name: firstName, last_name: lastName, email, phone });
      updateUser(updated);
      Alert.alert('تم', 'تم تحديث الملف الشخصي بنجاح');
      navigation.goBack();
    } catch (err: unknown) {
      const error = err as { message?: string };
      Alert.alert('خطأ', error?.message ?? 'حدث خطأ أثناء التحديث');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + Spacing[2] }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.title}>تعديل الملف الشخصي</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.form}>
        {[
          { label: 'الاسم الأول', value: firstName, set: setFirstName },
          { label: 'اسم العائلة', value: lastName, set: setLastName },
          { label: 'البريد الإلكتروني', value: email, set: setEmail },
          { label: 'رقم الهاتف', value: phone, set: setPhone },
        ].map((f, i) => (
          <View key={i} style={styles.field}>
            <Text style={styles.label}>{f.label}</Text>
            <TextInput style={styles.input} value={f.value} onChangeText={f.set} textAlign="right" keyboardType={f.label === 'رقم الهاتف' ? 'phone-pad' : 'default'} />
          </View>
        ))}
        <TouchableOpacity style={[styles.saveBtn, isLoading && styles.disabled]} onPress={handleSave} disabled={isLoading}>
          {isLoading ? <ActivityIndicator color={Colors.textInverse} /> : <Text style={styles.saveBtnText}>حفظ التغييرات</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { backgroundColor: Colors.surface, paddingTop: Spacing[10], paddingBottom: Spacing[3], paddingHorizontal: Spacing[4], flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', ...Shadows.sm },
  backIcon: { fontSize: 16, color: Colors.textPrimary },
  title: { ...Typography.h4, color: Colors.textPrimary, fontFamily: FontFamily.arabicBold },
  form: { padding: Spacing[5], gap: Spacing[4] },
  field: { gap: Spacing[1.5] },
  label: { ...Typography.label, color: Colors.textPrimary, fontFamily: FontFamily.arabicMedium, textAlign: 'right' },
  input: { backgroundColor: Colors.inputBackground, borderWidth: 1, borderColor: Colors.inputBorder, borderRadius: BorderRadius.md, paddingHorizontal: Spacing[3], paddingVertical: Spacing[3], fontSize: FontSize.base, color: Colors.textPrimary },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.xl, paddingVertical: Spacing[4], alignItems: 'center', marginTop: Spacing[4] },
  disabled: { opacity: 0.7 },
  saveBtnText: { ...Typography.button, color: Colors.textInverse, fontFamily: FontFamily.arabicBold },
});
