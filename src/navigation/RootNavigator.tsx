/**
 * Dokan App – Root Navigator
 * Entry point of the navigation tree. Handles Splash → Auth/Main routing.
 */
import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { RootStackParamList } from './types';
import { navigationRef } from './navigationRef';
import { useAuthStore } from '../store/authStore';
import { useWishlistStore } from '../store/wishlistStore';
import { CART_QUERY_KEY } from '../hooks/useCart';
import { CartService } from '../api/cart.service';
import { Colors } from '../theme/colors';

// Screens
import SplashScreen from '../features/auth/screens/SplashScreen';
import AuthNavigator from './AuthNavigator';
import MainTabNavigator from './MainTabNavigator';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Custom navigation theme matching Dokan design system
const DokanNavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: Colors.background,
    card: Colors.surface,
    text: Colors.textPrimary,
    border: Colors.border,
    primary: Colors.primary,
    notification: Colors.primary,
  },
};

export default function RootNavigator() {
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const hydrateAuth = useAuthStore((s) => s.hydrateFromStorage);
  const hydrateWishlist = useWishlistStore((s) => s.hydrateFromStorage);
  const queryClient = useQueryClient();

  // Hydrate persisted state on app launch
  useEffect(() => {
    hydrateAuth();
    hydrateWishlist();

    // The cart itself has no local state to hydrate anymore (the server cart
    // is the only cart) — just warm the query cache so the cart badge on Home
    // and the tab bar has data the instant those screens mount.
    queryClient.prefetchQuery({ queryKey: CART_QUERY_KEY, queryFn: CartService.getCart });

    // Register global session expiry handler
    (globalThis as any).__onSessionExpired = () => {
      useAuthStore.getState().logout();
    };
  }, [hydrateAuth, hydrateWishlist, queryClient]);

  if (!isHydrated) {
    return null; // Or a dedicated InitializingScreen
  }

  return (
    <NavigationContainer ref={navigationRef} theme={DokanNavTheme}>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{ headerShown: false, animation: 'fade' }}
      >
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Auth" component={AuthNavigator} />
        <Stack.Screen name="Main" component={MainTabNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
