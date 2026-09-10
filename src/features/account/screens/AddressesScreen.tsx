import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../../store/authStore';
import { Colors } from '../../../theme/colors';
import { Typography, FontFamily } from '../../../theme/typography';
import { Spacing, BorderRadius } from '../../../theme/spacing';
import { Shadows } from '../../../theme/shadows';

export default function AddressesScreen() {
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const insets = useSafeAreaInsets();

  const addresses = [
    { type: 'shipping' as const, title: 'عنوان الشحن', data: user?.shipping },
    { type: 'billing' as const, title: 'عنوان الفاتورة', data: user?.billing },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + Spacing[2] }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="رجوع"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons name="arrow-right" style={styles.backIcon} />
        </TouchableOpacity>
        <Text style={styles.title}>عناويني</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {addresses.map(({ type, title, data }) => (
          <View key={type} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{title}</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('EditAddress', { type })}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={`تعديل ${title}`}
              >
                <Text style={styles.editBtn}>تعديل</Text>
              </TouchableOpacity>
            </View>
            {data?.address_1 ? (
              <View style={styles.addressContent}>
                <Text style={styles.addressName}>{data.first_name} {data.last_name}</Text>
                <Text style={styles.addressLine}>{data.address_1}</Text>
                <Text style={styles.addressLine}>
                  {[data.city, data.state, data.country].filter(Boolean).join('، ')}
                </Text>
                {data.postcode ? <Text style={styles.addressLine}>الرمز البريدي: {data.postcode}</Text> : null}
                {data.phone && (
                  <View style={styles.phoneRow}>
                    <Text style={styles.addressLine}>{data.phone}</Text>
                    <MaterialCommunityIcons name="phone-outline" style={styles.phoneIcon} />
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.emptyAddress}>
                <Text style={styles.emptyText}>لم يتم إضافة عنوان بعد</Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('EditAddress', { type })}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel={`إضافة ${title}`}
                >
                  <Text style={styles.addBtn}>+ إضافة عنوان</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { backgroundColor: Colors.surface, paddingTop: Spacing[10], paddingBottom: Spacing[3], paddingHorizontal: Spacing[4], flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', ...Shadows.sm },
  backBtn: { width: 40, alignItems: 'center' },
  backIcon: { fontSize: 22, color: Colors.textPrimary },
  title: { ...Typography.h4, color: Colors.textPrimary, fontFamily: FontFamily.arabicBold },
  content: { padding: Spacing[4], gap: Spacing[3] },
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing[4], ...Shadows.card },
  cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: Spacing[3] },
  cardTitle: { ...Typography.h4, color: Colors.textPrimary, fontFamily: FontFamily.arabicBold },
  editBtn: { ...Typography.label, color: Colors.primaryDark },
  addressContent: { gap: Spacing[1] },
  addressName: { ...Typography.bodyLarge, color: Colors.textPrimary, fontFamily: FontFamily.arabicMedium, textAlign: 'right' },
  addressLine: { ...Typography.body, color: Colors.textSecondary, textAlign: 'right' },
  phoneRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing[1.5] },
  phoneIcon: { fontSize: 16, color: Colors.textSecondary },
  emptyAddress: { alignItems: 'center', gap: Spacing[2], paddingVertical: Spacing[4] },
  emptyText: { ...Typography.body, color: Colors.textTertiary },
  addBtn: { ...Typography.labelLarge, color: Colors.primaryDark },
});
