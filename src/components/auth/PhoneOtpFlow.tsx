/**
 * Shared phone-number + WhatsApp OTP entry flow — two steps (enter phone,
 * then enter the 6-digit code) driven entirely by the send/verify functions
 * passed in, so it works for both phone login and link-phone without
 * knowing which one it is. Deliberately separate from CheckoutScreen's own
 * inline OTP modal (which is checkout-specific and already live/tested) —
 * this is a plain, standalone screen body instead of a modal.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors } from '../../theme/colors';
import { Typography, FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { Shadows } from '../../theme/shadows';
import { PHONE_COUNTRIES, PhoneCountryOption, normalizePhoneDigits } from '../../utils/phoneCountries';
import { mapOtpError } from '../../utils/otpErrors';
import { OtpSendResponse } from '../../types';

interface PhoneOtpFlowProps<T> {
  submitLabel: string;
  sendOtp: (phone: string, phoneCountry: string) => Promise<OtpSendResponse>;
  verifyOtp: (payload: { otp_session_id: string; code: string }) => Promise<T>;
  onVerified: (result: T) => void;
}

export default function PhoneOtpFlow<T>({ submitLabel, sendOtp, verifyOtp, onVerified }: PhoneOtpFlowProps<T>) {
  const [phoneCountry, setPhoneCountry] = useState<PhoneCountryOption>(PHONE_COUNTRIES[0]);
  const [phoneLocal, setPhoneLocal] = useState('');
  const [isCountryModalVisible, setIsCountryModalVisible] = useState(false);

  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');

  const [otpSessionId, setOtpSessionId] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);

  useEffect(() => {
    if (resendSecondsLeft <= 0) return;
    const timer = setInterval(() => setResendSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendSecondsLeft]);

  const handleSend = async () => {
    const digits = normalizePhoneDigits(phoneLocal);
    if (digits.length < 7) {
      setSendError('يرجى إدخال رقم هاتف صحيح.');
      return;
    }

    setIsSending(true);
    setSendError('');
    try {
      const response = await sendOtp(digits, phoneCountry.iso);
      setOtpSessionId(response.otp_session_id);
      setMaskedPhone(response.masked_phone);
      setResendSecondsLeft(response.resend_after);
      setOtpCode('');
      setVerifyError('');
    } catch (error) {
      setSendError(mapOtpError(error, 'تعذر إرسال رمز التحقق عبر واتساب. حاول مرة أخرى.'));
    } finally {
      setIsSending(false);
    }
  };

  const handleVerify = async () => {
    const code = otpCode.replace(/\D+/g, '').trim();
    if (code.length !== 6) {
      setVerifyError('يرجى إدخال رمز مكوّن من 6 أرقام.');
      return;
    }

    setIsVerifying(true);
    setVerifyError('');
    try {
      const result = await verifyOtp({ otp_session_id: otpSessionId, code });
      onVerified(result);
    } catch (error) {
      setVerifyError(mapOtpError(error, 'تعذر التحقق من الرمز. حاول مرة أخرى.'));
    } finally {
      setIsVerifying(false);
    }
  };

  if (otpSessionId) {
    return (
      <View style={styles.step}>
        <MaterialCommunityIcons name="whatsapp" style={styles.whatsappIcon} />
        <Text style={styles.stepTitle}>أدخل رمز التحقق</Text>
        <Text style={styles.stepSubtitle}>أرسلنا رمزًا مكوّنًا من 6 أرقام عبر واتساب إلى {maskedPhone}</Text>

        <TextInput
          style={styles.codeInput}
          value={otpCode}
          onChangeText={(v) => setOtpCode(v.replace(/\D+/g, '').slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          textAlign="center"
          placeholder="000000"
          placeholderTextColor={Colors.placeholder}
        />
        {verifyError ? <Text style={styles.errorText}>{verifyError}</Text> : null}

        <TouchableOpacity
          style={[styles.primaryBtn, isVerifying && styles.disabledBtn]}
          onPress={handleVerify}
          disabled={isVerifying}
          accessibilityRole="button"
          accessibilityLabel="تحقق من الرمز"
          accessibilityState={{ disabled: isVerifying, busy: isVerifying }}
        >
          {isVerifying ? <ActivityIndicator color={Colors.textInverse} /> : <Text style={styles.primaryBtnText}>تحقق</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSend}
          disabled={resendSecondsLeft > 0 || isSending}
          style={styles.resendBtn}
          accessibilityRole="button"
          accessibilityLabel="إعادة إرسال الرمز"
        >
          <Text style={[styles.resendText, resendSecondsLeft > 0 && styles.resendTextDisabled]}>
            {resendSecondsLeft > 0 ? `إعادة الإرسال بعد ${resendSecondsLeft} ثانية` : 'إعادة إرسال الرمز'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setOtpSessionId('')} accessibilityRole="button" accessibilityLabel="تغيير رقم الهاتف">
          <Text style={styles.changePhoneText}>تغيير رقم الهاتف</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.step}>
      <Text style={styles.label}>رقم الهاتف (واتساب)</Text>
      <View style={styles.phoneRow}>
        <TextInput
          style={styles.phoneInput}
          value={phoneLocal}
          onChangeText={setPhoneLocal}
          keyboardType="phone-pad"
          placeholder="9xxxxxxxx"
          placeholderTextColor={Colors.placeholder}
          textAlign="right"
        />
        <TouchableOpacity
          style={styles.countryBtn}
          onPress={() => setIsCountryModalVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={`دولة الهاتف: ${phoneCountry.name}`}
        >
          <Text style={styles.countryBtnText}>{phoneCountry.dialCode}</Text>
          <MaterialCommunityIcons name="chevron-down" style={styles.countryChevron} />
        </TouchableOpacity>
      </View>
      {sendError ? <Text style={styles.errorText}>{sendError}</Text> : null}

      <TouchableOpacity
        style={[styles.primaryBtn, isSending && styles.disabledBtn]}
        onPress={handleSend}
        disabled={isSending}
        accessibilityRole="button"
        accessibilityLabel={submitLabel}
        accessibilityState={{ disabled: isSending, busy: isSending }}
      >
        {isSending ? <ActivityIndicator color={Colors.textInverse} /> : <Text style={styles.primaryBtnText}>{submitLabel}</Text>}
      </TouchableOpacity>

      <Modal visible={isCountryModalVisible} transparent animationType="slide" onRequestClose={() => setIsCountryModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setIsCountryModalVisible(false)} accessibilityRole="button" accessibilityLabel="إغلاق">
                <MaterialCommunityIcons name="close" style={styles.modalCloseIcon} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>اختر دولة رقم الهاتف</Text>
              <View style={{ width: 24 }} />
            </View>
            <FlatList
              data={PHONE_COUNTRIES}
              keyExtractor={(item) => item.iso}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.countryRow}
                  onPress={() => {
                    setPhoneCountry(item);
                    setIsCountryModalVisible(false);
                  }}
                >
                  <Text style={styles.countryRowText}>{item.name}</Text>
                  <Text style={styles.countryRowDial}>{item.dialCode}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { gap: Spacing[4] },
  label: { ...Typography.labelLarge, color: Colors.textPrimary, textAlign: 'right' },
  phoneRow: { flexDirection: 'row-reverse', gap: Spacing[2] },
  phoneInput: {
    flex: 1,
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
  countryBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: Spacing[1],
    backgroundColor: Colors.inputBackground,
    borderWidth: 1.5,
    borderColor: Colors.inputBorder,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing[3],
  },
  countryBtnText: { ...Typography.body, color: Colors.textPrimary, fontFamily: FontFamily.arabicMedium },
  countryChevron: { fontSize: 18, color: Colors.textSecondary },

  errorText: { ...Typography.caption, color: Colors.error, textAlign: 'right' },

  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing[4],
    alignItems: 'center',
  },
  disabledBtn: { opacity: 0.7 },
  primaryBtnText: { ...Typography.button, color: Colors.textInverse, fontFamily: FontFamily.arabicBold },

  whatsappIcon: { fontSize: 44, color: '#25D366', alignSelf: 'center' },
  stepTitle: { ...Typography.h4, color: Colors.textPrimary, fontFamily: FontFamily.arabicBold, textAlign: 'center' },
  stepSubtitle: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },
  codeInput: {
    backgroundColor: Colors.inputBackground,
    borderWidth: 1.5,
    borderColor: Colors.inputBorder,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing[3],
    fontSize: FontSize.xl,
    letterSpacing: 8,
    color: Colors.textPrimary,
    fontFamily: FontFamily.arabicBold,
  },
  resendBtn: { alignSelf: 'center' },
  resendText: { ...Typography.labelLarge, color: Colors.primaryDark },
  resendTextDisabled: { color: Colors.textTertiary },
  changePhoneText: { ...Typography.label, color: Colors.textSecondary, textAlign: 'center' },

  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, maxHeight: '60%', ...Shadows.xl },
  modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: Spacing[4], borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalCloseIcon: { fontSize: 22, color: Colors.textPrimary },
  modalTitle: { ...Typography.h4, color: Colors.textPrimary, fontFamily: FontFamily.arabicBold },
  countryRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', paddingHorizontal: Spacing[4], paddingVertical: Spacing[3], borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  countryRowText: { ...Typography.body, color: Colors.textPrimary, fontFamily: FontFamily.arabicMedium },
  countryRowDial: { ...Typography.body, color: Colors.textSecondary },
});
