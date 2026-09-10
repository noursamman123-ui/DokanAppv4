/**
 * Dokan App – Main Tab Navigator
 * Bottom navigation: Home | Categories | Cart | Wishlist | Account
 * Noon-inspired design with badge support on Cart.
 */
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MainTabParamList } from './types';
import { Colors } from '../theme/colors';
import { FontFamily, FontSize } from '../theme/typography';
import { useCart } from '../hooks/useCart';

// Tab screens (we use stacks inside each tab for deeper navigation)
import HomeStackNavigator from './stacks/HomeStackNavigator';
import CategoriesStackNavigator from './stacks/CategoriesStackNavigator';
import CartStackNavigator from './stacks/CartStackNavigator';
import WishlistStackNavigator from './stacks/WishlistStackNavigator';
import AccountStackNavigator from './stacks/AccountStackNavigator';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TabIcons: Record<string, { active: string; inactive: string }> = {
  Home: { active: 'home', inactive: 'home-outline' },
  Categories: { active: 'view-grid', inactive: 'view-grid-outline' },
  Cart: { active: 'cart', inactive: 'cart-outline' },
  Wishlist: { active: 'heart', inactive: 'heart-outline' },
  Account: { active: 'account', inactive: 'account-outline' },
};

interface TabIconProps {
  name: string;
  focused: boolean;
  badgeCount?: number;
}

function TabIcon({ name, focused, badgeCount }: TabIconProps) {
  return (
    <View style={styles.iconContainer}>
      <MaterialCommunityIcons
        name={focused ? TabIcons[name].active : TabIcons[name].inactive}
        size={21}
        color={focused ? Colors.secondary : Colors.tabInactive}
      />
      {badgeCount !== undefined && badgeCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {badgeCount > 99 ? '99+' : badgeCount}
          </Text>
        </View>
      )}
    </View>
  );
}

const homeTabIcon = ({ focused }: { focused: boolean }) => (
  <TabIcon name="Home" focused={focused} />
);

const categoriesTabIcon = ({ focused }: { focused: boolean }) => (
  <TabIcon name="Categories" focused={focused} />
);

const wishlistTabIcon = ({ focused }: { focused: boolean }) => (
  <TabIcon name="Wishlist" focused={focused} />
);

const accountTabIcon = ({ focused }: { focused: boolean }) => (
  <TabIcon name="Account" focused={focused} />
);

export default function MainTabNavigator() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.select({ ios: 14, android: 8 }) ?? 8);
  const tabBarHeight = 58 + bottomInset;
  const { data: cart } = useCart();
  const cartCount = cart?.items_count ?? 0;

  const defaultTabBarStyle = [styles.tabBar, { height: tabBarHeight, paddingBottom: bottomInset }];

  const cartTabIcon = ({ focused }: { focused: boolean }) => (
    <TabIcon name="Cart" focused={focused} badgeCount={cartCount} />
  );

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: [styles.tabBar, { height: tabBarHeight, paddingBottom: bottomInset }],
        tabBarActiveTintColor: Colors.secondary,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabBarItem,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeStackNavigator}
        options={{
          tabBarLabel: 'الرئيسية',
          tabBarIcon: homeTabIcon,
        }}
      />
      <Tab.Screen
        name="Categories"
        component={CategoriesStackNavigator}
        options={{
          tabBarLabel: 'الأقسام',
          tabBarIcon: categoriesTabIcon,
        }}
      />
      <Tab.Screen
        name="Cart"
        component={CartStackNavigator}
        options={({ route }) => {
          const focusedRouteName = getFocusedRouteNameFromRoute(route) ?? 'CartScreen';
          const hideTabBar = focusedRouteName === 'Checkout' || focusedRouteName === 'OrderSuccess';

          return {
            tabBarLabel: 'السلة',
            tabBarIcon: cartTabIcon,
            tabBarStyle: hideTabBar ? { display: 'none' } : defaultTabBarStyle,
          };
        }}
      />
      <Tab.Screen
        name="Wishlist"
        component={WishlistStackNavigator}
        options={{
          tabBarLabel: 'المفضلة',
          tabBarIcon: wishlistTabIcon,
        }}
      />
      <Tab.Screen
        name="Account"
        component={AccountStackNavigator}
        options={{
          tabBarLabel: 'حسابي',
          tabBarIcon: accountTabIcon,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.navBackground,
    borderTopColor: Colors.borderLight,
    borderTopWidth: 0,
    paddingTop: 7,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 14,
  },
  tabBarItem: { paddingTop: 2 },
  tabLabel: {
    fontFamily: FontFamily.arabicMedium,
    fontSize: FontSize.xs,
    marginTop: 1,
  },
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: Colors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: Colors.textInverse,
    fontSize: 9,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },
});
