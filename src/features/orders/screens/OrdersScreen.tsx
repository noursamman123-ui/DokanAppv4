/**
 * Orders Screen – List of past orders with status badges.
 * Guests (no account) see orders saved on this device after checkout, plus
 * a way to recover their history on a new device via phone + WhatsApp OTP.
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, ActivityIndicator,
  TextInput, Modal, Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { AccountStackParamList } from '../../../navigation/types';
import { OrdersService } from '../../../api/orders.service';
import { CartService } from '../../../api/cart.service';
import { CheckoutOtpService } from '../../../api/checkout-otp.service';
import { useAuthStore } from '../../../store/authStore';
import { CART_QUERY_KEY } from '../../../hooks/useCart';
import { GuestOrdersStorage } from '../../../utils/storage';
import { ApiError, GuestOrderRecord, Order, OrderStatus } from '../../../types';
import { Colors } from '../../../theme/colors';
import { Typography, FontFamily } from '../../../theme/typography';
import { Spacing, BorderRadius } from '../../../theme/spacing';
import { Shadows } from '../../../theme/shadows';
import { formatPrice } from '../../../utils/formatters';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type NavProp = NativeStackNavigationProp<AccountStackParamList, 'Orders'>;

const statusLabels: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'قيد الانتظار', color: Colors.warning, bg: Colors.warningLight },
  processing: { label: 'قيد التجهيز', color: Colors.info, bg: Colors.infoLight },
  'on-hold': { label: 'معلّق', color: Colors.warning, bg: Colors.warningLight },
  completed: { label: 'مكتمل', color: Colors.success, bg: Colors.successLight },
  cancelled: { label: 'ملغي', color: Colors.error, bg: Colors.errorLight },
  refunded: { label: 'مسترجع', color: Colors.textSecondary, bg: Colors.surfaceSecondary },
  failed: { label: 'فشل', color: Colors.error, bg: Colors.errorLight },
  trash: { label: 'محذوف', color: Colors.textTertiary, bg: Colors.surfaceSecondary },
};

const normalizeDigits = (value: string) => value.replace(/\D+/g, '');

const mapRecoveryError = (error: unknown): string => {
  const apiError = error as { code?: string; message?: string };

  if (apiError?.code === 'phone_not_whatsapp') {
    return 'رقم الهاتف غير مرتبط بواتساب. يرجى إدخال رقم واتساب صالح.';
  }
  if (apiError?.code === 'otp_rate_limited') {
    return 'تم إرسال رمز مؤخرًا. يرجى الانتظار قليلًا ثم إعادة المحاولة.';
  }
  if (apiError?.code === 'otp_invalid') {
    return 'رمز التحقق غير صحيح.';
  }
  if (apiError?.code === 'otp_expired' || apiError?.code === 'otp_invalid_proof') {
    return 'انتهت صلاحية الرمز. يرجى طلب رمز جديد.';
  }
  if (apiError?.code === 'otp_max_attempts') {
    return 'تم تجاوز عدد محاولات التحقق المسموح. يرجى طلب رمز جديد.';
  }
  if (apiError?.code === 'NETWORK_ERROR') {
    return 'تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مجددًا.';
  }

  return apiError?.message ?? 'حدث خطأ غير متوقع. حاول مرة أخرى.';
};

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const accountPhone = (user?.phone ?? user?.shipping?.phone ?? user?.billing?.phone ?? '').trim();
  const queryClient = useQueryClient();
  const [reorderingId, setReorderingId] = useState<number | null>(null);

  const [guestRecords, setGuestRecords] = useState<GuestOrderRecord[]>(() => GuestOrdersStorage.get());
  const [recoveryPhone, setRecoveryPhone] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [isSendingRecoveryOtp, setIsSendingRecoveryOtp] = useState(false);
  const [isVerifyingRecoveryOtp, setIsVerifyingRecoveryOtp] = useState(false);
  const [recoverySessionId, setRecoverySessionId] = useState('');
  const [recoveryMaskedPhone, setRecoveryMaskedPhone] = useState('');
  const [isOtpModalVisible, setIsOtpModalVisible] = useState(false);
  const [recoveryOtpCode, setRecoveryOtpCode] = useState('');

  // Refresh the locally-saved guest order list every time this screen gains
  // focus (e.g. right after placing a new order from Checkout).
  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) {
        setGuestRecords(GuestOrdersStorage.get());
      }
    }, [isAuthenticated])
  );

  const handleBackToAccount = () => {
    navigation.navigate('AccountScreen');
  };

  const { data: orders, isLoading, error, refetch } = useQuery({
    queryKey: ['orders', accountPhone || user?.id || 'guest'],
    queryFn: () => OrdersService.getOrders(1, accountPhone),
    enabled: isHydrated && isAuthenticated && accountPhone.length > 0,
    retry: 1,
    refetchOnMount: 'always',
  });

  const {
    data: guestOrders,
    isLoading: isGuestOrdersLoading,
  } = useQuery({
    queryKey: ['guest-orders-local', guestRecords.map((r) => `${r.orderId}:${r.orderKey}`).join(',')],
    queryFn: async () => {
      const results = await Promise.all(
        guestRecords.map((record) =>
          OrdersService.getGuestOrderByKey(record.orderId, record.orderKey).catch(() => null)
        )
      );
      return results.filter((item): item is Order => item !== null);
    },
    enabled: isHydrated && !isAuthenticated && guestRecords.length > 0,
  });

  const getErrorMessage = (queryError: unknown) => {
    const apiError = queryError as Partial<ApiError> | null;

    if (apiError?.message && apiError.code !== 'NETWORK_ERROR') {
      return apiError.message;
    }

    if (apiError?.code === 'NETWORK_ERROR') {
      return 'تعذر الاتصال بالخادم أو لم تُرسل الجلسة بشكل صحيح.';
    }

    return 'فشل الاتصال بالخادم. حاول مرة أخرى بعد قليل.';
  };

  const getShippingDuration = (order: Order) => {
    if (order.shipping_duration?.trim()) {
      return order.shipping_duration.trim();
    }

    const directDuration = order.shipping_lines?.find((line) => line.delivery_time?.trim())?.delivery_time;
    if (directDuration?.trim()) {
      return directDuration.trim();
    }

    for (const line of order.shipping_lines ?? []) {
      for (const meta of line.meta_data ?? []) {
        const key = (meta.key ?? '').toLowerCase().trim();
        const value = (meta.value ?? '').trim();
        if (value && ['delivery_time', '_delivery_time', 'shipping_duration', '_shipping_duration', 'estimated_delivery', '_estimated_delivery'].includes(key)) {
          return value;
        }
      }
    }

    return 'غير محددة';
  };

  const handleSendRecoveryOtp = async () => {
    const digits = normalizeDigits(recoveryPhone);
    if (digits.length < 7) {
      setRecoveryError('يرجى إدخال رقم واتساب صحيح.');
      return;
    }

    setIsSendingRecoveryOtp(true);
    setRecoveryError('');
    try {
      const response = await CheckoutOtpService.sendOrdersLookupOtp(digits, 'SY');
      setRecoverySessionId(response.otp_session_id);
      setRecoveryMaskedPhone(response.masked_phone);
      setRecoveryOtpCode('');
      setIsOtpModalVisible(true);
    } catch (sendError) {
      setRecoveryError(mapRecoveryError(sendError));
    } finally {
      setIsSendingRecoveryOtp(false);
    }
  };

  const handleVerifyRecoveryOtp = async () => {
    const code = recoveryOtpCode.replace(/\D+/g, '').trim();
    if (code.length !== 6) {
      setRecoveryError('يرجى إدخال رمز مكوّن من 6 أرقام.');
      return;
    }

    setIsVerifyingRecoveryOtp(true);
    setRecoveryError('');
    try {
      const verification = await CheckoutOtpService.verifyOtp({
        otp_session_id: recoverySessionId,
        code,
      });

      const phoneDigits = normalizeDigits(recoveryPhone);
      const recoveredOrders = await OrdersService.getGuestOrdersByPhone(
        phoneDigits,
        verification.otp_proof_token
      );

      GuestOrdersStorage.merge(
        recoveredOrders
          .filter((order) => !!order.order_key)
          .map((order) => ({
            orderId: order.id,
            orderNumber: order.number,
            orderKey: order.order_key ?? '',
            phone: phoneDigits,
            createdAt: order.date_created || new Date().toISOString(),
          }))
      );

      setGuestRecords(GuestOrdersStorage.get());
      setIsOtpModalVisible(false);
      setRecoveryPhone('');
      setRecoveryOtpCode('');
    } catch (verifyError) {
      setRecoveryError(mapRecoveryError(verifyError));
    } finally {
      setIsVerifyingRecoveryOtp(false);
    }
  };

  const handleReorder = useCallback(async (order: Order) => {
    setReorderingId(order.id);
    const failures: string[] = [];

    // Sequential — same shared-cart-session reasoning as placeOrder's steps.
    for (const item of order.line_items) {
      try {
        await CartService.addItem(item.product_id, item.quantity, item.variation_id || undefined);
      } catch {
        failures.push(item.name);
      }
    }

    queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
    setReorderingId(null);

    if (failures.length === order.line_items.length) {
      Alert.alert('تعذّرت إعادة الطلب', 'تعذّر إضافة المنتجات إلى السلة. يرجى المحاولة مرة أخرى.');
      return;
    }
    if (failures.length > 0) {
      Alert.alert('تمت الإضافة جزئيًا', `تعذّرت إضافة: ${failures.join('، ')}`);
    }
    navigation.getParent()?.navigate('Cart');
  }, [navigation, queryClient]);

  const renderOrder = ({ item }: { item: Order }) => {
    const status = statusLabels[item.status] ?? statusLabels.pending;
    const displayOrderNumber = item.number?.trim() || String(item.id);
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('OrderDetail', { orderId: item.id, orderKey: item.order_key })}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.orderNum}>طلب #{displayOrderNumber}</Text>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>التاريخ</Text>
            <Text style={styles.infoValue}>{new Date(item.date_created).toLocaleDateString('ar-SY')}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>المنتجات</Text>
            <Text style={styles.infoValue}>{item.line_items.length} منتج</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>الشحن</Text>
            <Text style={styles.infoValue}>{formatPrice(item.shipping_total ?? '0', item.currency_symbol)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>مدة الشحن</Text>
            <Text style={styles.infoValue}>{getShippingDuration(item)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>الإجمالي</Text>
            <Text style={styles.totalValue}>{formatPrice(item.total, item.currency_symbol)}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.reorderBtn}
          onPress={() => handleReorder(item)}
          disabled={reorderingId === item.id}
          accessibilityRole="button"
          accessibilityLabel="اطلب مجدداً"
          accessibilityState={{ disabled: reorderingId === item.id, busy: reorderingId === item.id }}
        >
          {reorderingId === item.id ? (
            <ActivityIndicator size="small" color={Colors.primaryDark} />
          ) : (
            <>
              <MaterialCommunityIcons name="cart-plus" style={styles.reorderIcon} />
              <Text style={styles.reorderText}>اطلب مجدداً</Text>
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderGuestRecoveryCard = () => (
    <View style={styles.recoveryCard}>
      <Text style={styles.recoveryTitle}>استرجاع طلبات سابقة</Text>
      <Text style={styles.recoverySubtitle}>
        إذا طلبت من جهاز آخر أو أعدت تثبيت التطبيق، أدخل رقم الواتساب الذي استخدمته عند الطلب لاسترجاع طلباتك.
      </Text>
      <TextInput
        style={styles.recoveryInput}
        placeholder="رقم الواتساب (مثال: 0911234567)"
        placeholderTextColor={Colors.placeholder}
        value={recoveryPhone}
        onChangeText={setRecoveryPhone}
        keyboardType="phone-pad"
        textAlign="right"
      />
      {recoveryError ? <Text style={styles.recoveryErrorText}>{recoveryError}</Text> : null}
      <TouchableOpacity
        style={[styles.recoveryBtn, isSendingRecoveryOtp && styles.disabledBtn]}
        onPress={handleSendRecoveryOtp}
        disabled={isSendingRecoveryOtp}
      >
        {isSendingRecoveryOtp ? (
          <ActivityIndicator color={Colors.textInverse} />
        ) : (
          <Text style={styles.recoveryBtnText}>إرسال رمز التحقق عبر واتساب</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} />
      <View style={[styles.header, { paddingTop: insets.top + Spacing[2] }]}>
        <TouchableOpacity onPress={handleBackToAccount} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="رجوع" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="arrow-right" style={styles.backIcon} />
        </TouchableOpacity>
        <Text style={styles.title}>طلباتي</Text>
        <View style={styles.backBtn} />
      </View>

      {!isHydrated ? (
        <ActivityIndicator style={styles.loader} size="large" color={Colors.primary} />
      ) : !isAuthenticated ? (
        <FlatList
          data={guestOrders ?? []}
          renderItem={renderOrder}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            (guestOrders?.length ?? 0) > 0 ? (
              <Text style={styles.guestSectionTitle}>طلباتك على هذا الجهاز</Text>
            ) : null
          }
          ListEmptyComponent={
            isGuestOrdersLoading ? (
              <ActivityIndicator style={styles.loader} color={Colors.primary} />
            ) : (
              <View style={styles.empty}>
                <MaterialCommunityIcons name="package-variant-closed" style={styles.emptyIcon} />
                <Text style={styles.emptyText}>لا توجد طلبات محفوظة على هذا الجهاز</Text>
              </View>
            )
          }
          ListFooterComponent={renderGuestRecoveryCard()}
        />
      ) : isLoading ? (
        <ActivityIndicator style={styles.loader} size="large" color={Colors.primary} />
      ) : !accountPhone ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="phone-alert-outline" style={styles.emptyIcon} />
          <Text style={styles.emptyText}>يرجى إضافة رقم جوال في ملفك الشخصي لعرض الطلبات المرتبطة به</Text>
        </View>
      ) : error ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="alert-circle-outline" style={styles.emptyIcon} />
          <Text style={styles.emptyText}>حدث خطأ أثناء جلب الطلبات</Text>
          <Text style={styles.errorDetail}>{getErrorMessage(error)}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryText}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders ?? []}
          renderItem={renderOrder}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="package-variant-closed" style={styles.emptyIcon} />
              <Text style={styles.emptyText}>لا توجد طلبات سابقة</Text>
            </View>
          }
        />
      )}

      <Modal
        visible={isOtpModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !isVerifyingRecoveryOtp && setIsOtpModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.otpModalCard}>
            <View style={styles.otpHeader}>
              <Text style={styles.otpTitle}>تأكيد رقم الواتساب</Text>
              <TouchableOpacity
                onPress={() => !isVerifyingRecoveryOtp && setIsOtpModalVisible(false)}
                disabled={isVerifyingRecoveryOtp}
                accessibilityRole="button"
                accessibilityLabel="إغلاق"
              >
                <MaterialCommunityIcons name="close" style={styles.closeIcon} />
              </TouchableOpacity>
            </View>

            <Text style={styles.otpHint}>أدخل رمز التحقق المرسل إلى: {recoveryMaskedPhone}</Text>

            <TextInput
              style={styles.otpInput}
              value={recoveryOtpCode}
              onChangeText={(value) => setRecoveryOtpCode(value.replace(/\D+/g, '').slice(0, 6))}
              keyboardType="number-pad"
              placeholder="أدخل رمز OTP"
              placeholderTextColor={Colors.placeholder}
              textAlign="center"
              maxLength={6}
            />

            {recoveryError ? <Text style={styles.recoveryErrorText}>{recoveryError}</Text> : null}

            <TouchableOpacity
              style={[styles.verifyBtn, isVerifyingRecoveryOtp && styles.disabledBtn]}
              onPress={handleVerifyRecoveryOtp}
              disabled={isVerifyingRecoveryOtp}
            >
              {isVerifyingRecoveryOtp ? (
                <ActivityIndicator color={Colors.textInverse} />
              ) : (
                <Text style={styles.verifyBtnText}>تحقق واسترجع طلباتي</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleSendRecoveryOtp} disabled={isSendingRecoveryOtp}>
              <Text style={styles.resendText}>إعادة إرسال الرمز</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.secondary, paddingTop: Spacing[10], paddingBottom: Spacing[4],
    paddingHorizontal: Spacing[4], flexDirection: 'row-reverse', alignItems: 'center',
    justifyContent: 'space-between', borderBottomLeftRadius: BorderRadius['2xl'],
    borderBottomRightRadius: BorderRadius['2xl'],
  },
  backBtn: { width: 40, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 22, color: Colors.textInverse },
  title: { ...Typography.h4, color: Colors.textInverse, fontFamily: FontFamily.arabicBold },
  list: { padding: Spacing[4], paddingBottom: 100 },
  loader: { flex: 1, justifyContent: 'center' },
  card: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing[4], marginBottom: Spacing[3], ...Shadows.xs, borderWidth: 1, borderColor: Colors.borderLight },
  cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: Spacing[3] },
  orderNum: { ...Typography.labelLarge, color: Colors.textPrimary, fontFamily: FontFamily.arabicBold },
  statusBadge: { paddingHorizontal: Spacing[3], paddingVertical: 3, borderRadius: BorderRadius.full },
  statusText: { ...Typography.labelSmall, fontFamily: FontFamily.arabicMedium },
  cardBody: { gap: Spacing[1.5] },
  infoRow: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  infoLabel: { ...Typography.bodySmall, color: Colors.textSecondary },
  infoValue: { ...Typography.bodySmall, color: Colors.textPrimary, fontFamily: FontFamily.arabicMedium },
  totalValue: { ...Typography.priceSmall, color: Colors.sale, fontFamily: FontFamily.arabicBold },
  reorderBtn: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: Spacing[1.5],
    backgroundColor: Colors.primarySurface, borderRadius: BorderRadius.md,
    paddingVertical: Spacing[2], marginTop: Spacing[3],
  },
  reorderIcon: { fontSize: 16, color: Colors.primaryDark },
  reorderText: { ...Typography.labelLarge, color: Colors.primaryDark, fontFamily: FontFamily.arabicBold },
  empty: { alignItems: 'center', paddingTop: Spacing[16] },
  emptyIcon: { fontSize: 48, marginBottom: Spacing[4] },
  emptyText: { ...Typography.body, color: Colors.textSecondary },
  errorDetail: { ...Typography.caption, color: Colors.error, marginTop: Spacing[2], paddingHorizontal: Spacing[10], textAlign: 'center' },
  retryBtn: { marginTop: Spacing[4], paddingHorizontal: Spacing[6], paddingVertical: Spacing[2], backgroundColor: Colors.primary, borderRadius: BorderRadius.md },
  retryText: { ...Typography.button, color: Colors.textInverse },

  guestSectionTitle: {
    ...Typography.labelLarge, color: Colors.textSecondary, fontFamily: FontFamily.arabicBold,
    textAlign: 'right', marginBottom: Spacing[3],
  },
  recoveryCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing[5],
    marginTop: Spacing[4], borderWidth: 1, borderColor: Colors.borderLight, ...Shadows.xs,
  },
  recoveryTitle: { ...Typography.h4, color: Colors.textPrimary, fontFamily: FontFamily.arabicBold, textAlign: 'right', marginBottom: Spacing[1.5] },
  recoverySubtitle: { ...Typography.bodySmall, color: Colors.textSecondary, textAlign: 'right', marginBottom: Spacing[4], lineHeight: 20 },
  recoveryInput: {
    backgroundColor: Colors.inputBackground, borderRadius: BorderRadius.md, borderWidth: 1,
    borderColor: Colors.inputBorder, paddingHorizontal: Spacing[3], paddingVertical: Spacing[2.5],
    fontSize: 14, color: Colors.textPrimary, marginBottom: Spacing[3],
  },
  recoveryErrorText: { ...Typography.caption, color: Colors.error, textAlign: 'right', marginBottom: Spacing[2] },
  recoveryBtn: {
    backgroundColor: Colors.secondary, borderRadius: BorderRadius.xl,
    paddingVertical: Spacing[4], alignItems: 'center', justifyContent: 'center',
  },
  recoveryBtnText: { ...Typography.button, color: Colors.textInverse, fontFamily: FontFamily.arabicBold },
  disabledBtn: { opacity: 0.6 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: Spacing[5] },
  otpModalCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing[5], ...Shadows.xl },
  otpHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing[3] },
  otpTitle: { ...Typography.h4, color: Colors.textPrimary, fontFamily: FontFamily.arabicBold },
  closeIcon: { fontSize: 20, color: Colors.textSecondary },
  otpHint: { ...Typography.bodySmall, color: Colors.textSecondary, textAlign: 'right', marginBottom: Spacing[4] },
  otpInput: {
    backgroundColor: Colors.inputBackground, borderRadius: BorderRadius.md, borderWidth: 1,
    borderColor: Colors.inputBorder, paddingVertical: Spacing[3], fontSize: 20, letterSpacing: 6,
    color: Colors.textPrimary, marginBottom: Spacing[3],
  },
  verifyBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.xl,
    paddingVertical: Spacing[4], alignItems: 'center', justifyContent: 'center', marginBottom: Spacing[3],
  },
  verifyBtnText: { ...Typography.button, color: Colors.secondary, fontFamily: FontFamily.arabicBold },
  resendText: { ...Typography.label, color: Colors.secondary, textAlign: 'center', fontFamily: FontFamily.arabicMedium },
});
