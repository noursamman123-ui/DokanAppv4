import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, StatusBar, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, PermissionsAndroid } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Geolocation from '@react-native-community/geolocation';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { AccountStackParamList } from '../../../navigation/types';
import { useAuthStore } from '../../../store/authStore';
import { AuthService } from '../../../api/auth.service';
import { Colors } from '../../../theme/colors';
import { Typography, FontFamily, FontSize } from '../../../theme/typography';
import { Spacing, BorderRadius } from '../../../theme/spacing';
import { Shadows } from '../../../theme/shadows';
import { UserAddress } from '../../../types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type EditAddressRouteProp = RouteProp<AccountStackParamList, 'EditAddress'>;

export default function EditAddressScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<EditAddressRouteProp>();
  const { type } = route.params; // 'billing' or 'shipping'
  const { user, updateUser } = useAuthStore();

  const normalizeCountryCode = (value?: string) => {
    const normalized = value?.trim().toUpperCase() ?? '';

    if (!normalized) {
      return 'SY';
    }

    if (['SY', 'SYRIA', 'سوريا', 'سورية'].includes(normalized)) {
      return 'SY';
    }

    if (['SA', 'SAUDI ARABIA', 'السعودية', 'المملكة العربية السعودية'].includes(normalized)) {
      return 'SA';
    }

    return normalized;
  };

  const currentAddress: UserAddress = user?.[type] ?? {
    first_name: '',
    last_name: '',
    company: '',
    address_1: '',
    address_2: '',
    city: '',
    state: '',
    postcode: '',
    country: 'SY',
    phone: '',
    email: '',
  };

  const [firstName, setFirstName] = useState(currentAddress.first_name || user?.first_name || '');
  const [lastName, setLastName] = useState(currentAddress.last_name || user?.last_name || '');
  const [address1, setAddress1] = useState(currentAddress.address_1 || '');
  const [city, setCity] = useState(currentAddress.city || '');
  const [state, setState] = useState(currentAddress.state || '');
  const [postcode, setPostcode] = useState(currentAddress.postcode || '');
  const [country, setCountry] = useState(normalizeCountryCode(currentAddress.country || 'SY'));
  const [phone] = useState(currentAddress.phone || user?.phone || user?.shipping?.phone || user?.billing?.phone || '');

  
  const [isLoading, setIsLoading] = useState(false);
  const [isLocationLoading, setIsLocationLoading] = useState(false);


  const handleGetLocation = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('تنبيه', 'يرجى منح صلاحية الموقع لاستخدام هذه الميزة');
        return;
      }
    }

    if (Platform.OS === 'ios' && typeof Geolocation.requestAuthorization === 'function') {
      const isAuthorized = await new Promise<boolean>((resolve) => {
        Geolocation.requestAuthorization(
          () => resolve(true),
          () => resolve(false),
        );
      });

      if (!isAuthorized) {
        Alert.alert('تنبيه', 'يرجى منح صلاحية الموقع لاستخدام هذه الميزة');
        return;
      }
    }

    setIsLocationLoading(true);
    Geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const mapUrl = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=ar`;
          const response = await fetch(mapUrl, { headers: { 'User-Agent': 'DokanApp/1.0' } });
          const data = await response.json();
          if (data && data.address) {
            if (data.address.city || data.address.town || data.address.state) {
              setCity(data.address.city || data.address.town || data.address.state);
            }
            if (data.address.road || data.address.suburb) {
              const street = data.address.road ? data.address.road : '';
              const area = data.address.suburb ? data.address.suburb : '';
              setAddress1(`${street} ${area}`.trim());
            }
            if (data.address.country_code) {
              setCountry(data.address.country_code.toUpperCase());
            }
          }
        } catch {
          Alert.alert('خطأ', 'تعذر جلب تفاصيل الموقع من الخريطة');
        } finally {
          setIsLocationLoading(false);
        }
      },
      (error) => {
        Alert.alert('خطأ', 'تعذر تحديد موقعك الحالي: ' + error.message);
        setIsLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const addressData = {
        first_name: firstName,
        last_name: lastName,
        address_1: address1,
        city,
        country: normalizeCountryCode(country),
        phone,
        // Add missing required fields as empty strings for TS compatibility
        company: currentAddress.company || '',
        address_2: currentAddress.address_2 || '',
        state,
        postcode,
      };

      const updated = await AuthService.updateProfile(user.id, { [type]: addressData });
      
      updateUser(updated);
      Alert.alert('تم', 'تم حفظ العنوان بنجاح', [
        { text: 'تم', onPress: () => navigation.goBack() }
      ]);
    } catch (err: unknown) {
      const error = err as { message?: string };
      Alert.alert('خطأ', error?.message ?? 'حدث خطأ أثناء حفظ العنوان');
    } finally {
      setIsLoading(false);
    }
  };

  const title = type === 'billing' ? 'عنوان الفاتورة' : 'عنوان الشحن';

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + Spacing[2] }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
        
        <TouchableOpacity style={styles.locationBtn} onPress={handleGetLocation} disabled={isLocationLoading}>
          {isLocationLoading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <View style={styles.locationBtnContent}>
              <Text style={styles.locationBtnText}>تحديد موقعي الحالي</Text>
              <MaterialCommunityIcons name="map-marker-outline" style={styles.locationBtnIcon} />
            </View>
          )}
        </TouchableOpacity>

        {[
          { label: 'الاسم الأول', value: firstName, set: setFirstName },
          { label: 'اسم العائلة', value: lastName, set: setLastName },
          { label: 'العنوان', value: address1, set: setAddress1 },
          { label: 'المدينة', value: city, set: setCity },
          { label: 'المنطقة / المحافظة', value: state, set: setState },
          { label: 'الرمز البريدي', value: postcode, set: setPostcode },
          { label: 'الدولة', value: country, set: setCountry },
        ].map((f, i) => (
          <View key={i} style={styles.field}>
            <Text style={styles.label}>{f.label}</Text>
            <TextInput 
              style={styles.input} 
              value={f.value} 
              onChangeText={f.set} 
              textAlign="right" 
              placeholder={`أدخل ${f.label}`}
              placeholderTextColor={Colors.placeholder}
            />
          </View>
        ))}
        <TouchableOpacity style={[styles.saveBtn, isLoading && styles.disabled]} onPress={handleSave} disabled={isLoading}>
          {isLoading ? <ActivityIndicator color={Colors.textInverse} /> : <Text style={styles.saveBtnText}>حفظ العنوان</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { backgroundColor: Colors.surface, paddingTop: Spacing[10], paddingBottom: Spacing[3], paddingHorizontal: Spacing[4], flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', ...Shadows.sm },
  backIcon: { fontSize: 16, color: Colors.textPrimary },
  title: { ...Typography.h4, color: Colors.textPrimary, fontFamily: FontFamily.arabicBold },
  form: { padding: Spacing[5], gap: Spacing[4], paddingBottom: Spacing[10] },
  field: { gap: Spacing[1.5] },
  label: { ...Typography.label, color: Colors.textPrimary, fontFamily: FontFamily.arabicMedium, textAlign: 'right' },
  input: { backgroundColor: Colors.inputBackground, borderWidth: 1, borderColor: Colors.inputBorder, borderRadius: BorderRadius.md, paddingHorizontal: Spacing[3], paddingVertical: Spacing[3], fontSize: FontSize.base, color: Colors.textPrimary, fontFamily: FontFamily.arabicRegular },
  locationBtn: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: Spacing[3], alignItems: 'center', marginBottom: Spacing[2] },
  locationBtnContent: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing[1.5] },
  locationBtnIcon: { fontSize: 18, color: Colors.primaryDark },
  locationBtnText: { ...Typography.labelLarge, color: Colors.primaryDark, fontFamily: FontFamily.arabicMedium },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.xl, paddingVertical: Spacing[4], alignItems: 'center', marginTop: Spacing[4] },
  disabled: { opacity: 0.7 },
  saveBtnText: { ...Typography.button, color: Colors.textInverse, fontFamily: FontFamily.arabicBold },
});
