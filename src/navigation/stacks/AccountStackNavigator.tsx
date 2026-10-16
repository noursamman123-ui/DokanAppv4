import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AccountStackParamList } from '../types';
import AccountScreen from '../../features/account/screens/AccountScreen';
import OrdersScreen from '../../features/orders/screens/OrdersScreen';
import OrderDetailScreen from '../../features/orders/screens/OrderDetailScreen';
import EditProfileScreen from '../../features/account/screens/EditProfileScreen';
import AddressesScreen from '../../features/account/screens/AddressesScreen';
import EditAddressScreen from '../../features/account/screens/EditAddressScreen';
import LinkPhoneScreen from '../../features/account/screens/LinkPhoneScreen';
import NotificationsScreen from '../../features/notifications/NotificationsScreen';
import ContactUsScreen from '../../features/account/screens/ContactUsScreen';
import PrivacyPolicyScreen from '../../features/account/screens/PrivacyPolicyScreen';
import TermsScreen from '../../features/account/screens/TermsScreen';

const Stack = createNativeStackNavigator<AccountStackParamList>();

export default function AccountStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AccountScreen" component={AccountScreen} />
      <Stack.Screen name="Orders" component={OrdersScreen} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Addresses" component={AddressesScreen} />
      <Stack.Screen name="EditAddress" component={EditAddressScreen} />
      <Stack.Screen name="LinkPhone" component={LinkPhoneScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="ContactUs" component={ContactUsScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <Stack.Screen name="Terms" component={TermsScreen} />
    </Stack.Navigator>
  );
}
