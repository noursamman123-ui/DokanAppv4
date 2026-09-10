/**
 * Order Success Screen – Confirmation after a successful order.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CartStackParamList } from '../../../navigation/types';
import { Colors } from '../../../theme/colors';
import { Typography, FontFamily } from '../../../theme/typography';
import { Spacing, BorderRadius } from '../../../theme/spacing';

type RoutePropType = RouteProp<CartStackParamList, 'OrderSuccess'>;

export default function OrderSuccessScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<CartStackParamList>>();
  const route = useRoute<RoutePropType>();
  const { orderId, orderNumber } = route.params;
  const normalizedOrderNumber =
    typeof orderNumber === 'string' && orderNumber.trim() && orderNumber !== 'undefined'
      ? orderNumber.trim()
      : '';
  const normalizedOrderId =
    typeof orderId === 'number' && Number.isFinite(orderId) && orderId > 0
      ? String(orderId)
      : '';
  const displayOrderNumber = normalizedOrderNumber || normalizedOrderId || '---';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.content}>
        <Text style={styles.icon}>✅</Text>
        <Text style={styles.title}>تم تأكيد طلبك بنجاح!</Text>
        <Text style={styles.subtitle}>شكراً لتسوّقك معنا</Text>

        <View style={styles.orderCard}>
          <Text style={styles.orderLabel}>رقم الطلب</Text>
          <Text style={styles.orderNumber}>#{displayOrderNumber}</Text>
        </View>

        <Text style={styles.note}>
          تم إنشاء الطلب رقم #{displayOrderNumber} وسنرسل لك تأكيد الطلب وتحديثات الحالة عبر واتساب
        </Text>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => (navigation as any).navigate('Home')}
          >
            <Text style={styles.primaryBtnText}>متابعة التسوق</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => (navigation as any).navigate('Account', { screen: 'Orders' })}
          >
            <Text style={styles.secondaryBtnText}>عرض طلباتي</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface, justifyContent: 'center' },
  content: { alignItems: 'center', padding: Spacing[6] },
  icon: { fontSize: 72, marginBottom: Spacing[5] },
  title: { ...Typography.h2, color: Colors.textPrimary, fontFamily: FontFamily.arabicBold, textAlign: 'center', marginBottom: Spacing[2] },
  subtitle: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing[6] },
  orderCard: {
    backgroundColor: Colors.primarySurface, borderRadius: BorderRadius.xl,
    paddingVertical: Spacing[5], paddingHorizontal: Spacing[8], alignItems: 'center', marginBottom: Spacing[5],
  },
  orderLabel: { ...Typography.label, color: Colors.textSecondary, marginBottom: Spacing[1] },
  orderNumber: { ...Typography.displayMedium, color: Colors.primaryDark, fontFamily: FontFamily.bold },
  note: { ...Typography.bodySmall, color: Colors.textTertiary, textAlign: 'center', marginBottom: Spacing[8], lineHeight: 22 },
  actions: { width: '100%', gap: Spacing[3] },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.xl, paddingVertical: Spacing[4], alignItems: 'center' },
  primaryBtnText: { ...Typography.button, color: Colors.textInverse, fontFamily: FontFamily.arabicBold },
  secondaryBtn: { backgroundColor: Colors.surfaceSecondary, borderRadius: BorderRadius.xl, paddingVertical: Spacing[4], alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  secondaryBtnText: { ...Typography.button, color: Colors.textPrimary, fontFamily: FontFamily.arabicMedium },
});
