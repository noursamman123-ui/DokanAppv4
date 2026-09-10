/**
 * Dokan App – Main Entry Point
 * Sets up providers: QueryClient, i18n, Navigation
 */
import React, { useEffect } from 'react';
import { StatusBar, LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Initialize i18n before anything else
import './localization/i18n';

import RootNavigator from './navigation/RootNavigator';
import { queryClient } from './services/queryClient';
import { initPushNotifications } from './services/pushNotifications';
import ErrorBoundary from './components/feedback/ErrorBoundary';

// Suppress known non-critical warnings in development
LogBox.ignoreLogs(['ViewPropTypes', 'Require cycle']);

export default function App() {
  useEffect(() => {
    initPushNotifications();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar
            barStyle="dark-content"
            backgroundColor="transparent"
            translucent
          />
          <ErrorBoundary>
            <RootNavigator />
          </ErrorBoundary>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
