/**
 * NotifyMeModal – lets a customer leave their WhatsApp number against an
 * out-of-stock product. Shown instead of the wishlist action when a product
 * can't be purchased right now.
 */
import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors } from '../../theme/colors';
import { Typography, FontFamily } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { Shadows } from '../../theme/shadows';

interface NotifyMeModalProps {
  visible: boolean;
  defaultPhone?: string;
  onClose: () => void;
  onSubmit: (phone: string) => Promise<void>;
}

export default function NotifyMeModal({ visible, defaultPhone = '', onClose, onSubmit }: NotifyMeModalProps) {
  const [phone, setPhone] = useState(defaultPhone);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    setIsDone(false);
    setError('');
    onClose();
  };

  const handleSubmit = async () => {
    const digits = phone.replace(/\D+/g, '');
    if (digits.length < 7) {
      setError('يرجى إدخال رقم واتساب صحيح.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await onSubmit(digits);
      setIsDone(true);
    } catch (err) {
      const apiError = err as { message?: string };
      setError(apiError?.message ?? 'تعذر إرسال الطلب. حاول مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {isDone ? (
            <>
              <View style={styles.checkCircle}>
                <MaterialCommunityIcons name="check" style={styles.checkIcon} />
              </View>
              <Text style={styles.title}>تم تسجيل طلبك</Text>
              <Text style={styles.subtitle}>سنُعلمك عبر واتساب فور توفر المنتج مجدداً</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleClose}>
                <Text style={styles.primaryBtnText}>حسناً</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.title}>أعلمني عند التوفر</Text>
              <Text style={styles.subtitle}>أدخل رقم واتساب لإعلامك فور توفر هذا المنتج</Text>
              <TextInput
                style={styles.input}
                placeholder="رقم الواتساب (مثال: 0911234567)"
                placeholderTextColor={Colors.placeholder}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                textAlign="right"
              />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <View style={styles.actions}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={handleClose} disabled={isSubmitting}>
                  <Text style={styles.secondaryBtnText}>إلغاء</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryBtn} onPress={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <ActivityIndicator color={Colors.textInverse} />
                  ) : (
                    <Text style={styles.primaryBtnText}>أعلمني</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center',
    alignItems: 'center', paddingHorizontal: Spacing[5],
  },
  card: {
    width: '100%', backgroundColor: Colors.surface, borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing[5], paddingVertical: Spacing[6], alignItems: 'center', ...Shadows.xl,
  },
  checkCircle: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.successLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing[4],
  },
  checkIcon: { fontSize: 32, color: Colors.success },
  title: { ...Typography.h4, color: Colors.textPrimary, fontFamily: FontFamily.arabicBold, textAlign: 'center', marginBottom: Spacing[2] },
  subtitle: { ...Typography.bodySmall, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing[4] },
  input: {
    width: '100%', backgroundColor: Colors.inputBackground, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.inputBorder, paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[3], fontSize: 15, color: Colors.textPrimary,
  },
  errorText: { ...Typography.caption, color: Colors.error, textAlign: 'right', width: '100%', marginTop: Spacing[2] },
  actions: { flexDirection: 'row', width: '100%', gap: Spacing[3], marginTop: Spacing[5] },
  primaryBtn: {
    flex: 1, backgroundColor: Colors.primary, borderRadius: BorderRadius.lg,
    paddingVertical: Spacing[3], alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnText: { ...Typography.button, color: Colors.textInverse, fontFamily: FontFamily.arabicBold },
  secondaryBtn: {
    flex: 1, backgroundColor: Colors.surfaceSecondary, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.border, paddingVertical: Spacing[3], alignItems: 'center', justifyContent: 'center',
  },
  secondaryBtnText: { ...Typography.button, color: Colors.textPrimary, fontFamily: FontFamily.arabicMedium },
});
