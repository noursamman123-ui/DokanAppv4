import React, { PropsWithChildren, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BorderRadius, Colors, Spacing, Typography } from '../../theme';
import { getInstalledAppVersion } from './appVersion';
import { loadUpdatePolicy } from './updatePolicyLoader';
import { requiresForcedUpdate } from './versionPolicy';

const PLAY_STORE_APP_URL = 'market://details?id=app.dokan.android';
const PLAY_STORE_WEB_URL =
  'https://play.google.com/store/apps/details?id=app.dokan.android';
const APP_STORE_URL = 'https://apps.apple.com/app/id6745801224';

async function openUpdateStore() {
  try {
    if (Platform.OS === 'ios') {
      await Linking.openURL(APP_STORE_URL);
      return;
    }
    try {
      await Linking.openURL(PLAY_STORE_APP_URL);
    } catch {
      await Linking.openURL(PLAY_STORE_WEB_URL);
    }
  } catch {
    Alert.alert('تعذّر فتح المتجر', 'حاول مرة أخرى أو افتح متجر التطبيقات وابحث عن دكان.');
  }
}

function MobileUpdateGate({ children }: PropsWithChildren) {
  const installedVersion = getInstalledAppVersion();
  const bootstrapQuery = useQuery({
    queryKey: ['bootstrap'],
    queryFn: loadUpdatePolicy,
    enabled: installedVersion !== null,
    retry: false,
  });
  const refetchBootstrap = bootstrapQuery.refetch;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active' && installedVersion) {
        refetchBootstrap().catch(() => undefined);
      }
    });

    return () => subscription.remove();
  }, [installedVersion, refetchBootstrap]);

  if (
    !installedVersion ||
    (bootstrapQuery.isError && bootstrapQuery.data === undefined)
  ) {
    return <>{children}</>;
  }

  if (bootstrapQuery.isPending) {
    return (
      <View style={styles.loadingContainer} accessibilityLabel="جاري التحقق من إصدار التطبيق">
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const config = bootstrapQuery.data?.config;
  const minimumVersion = Platform.OS === 'ios'
    ? config?.min_ios_app_version
    : config?.min_app_version;

  if (!requiresForcedUpdate(installedVersion, minimumVersion)) {
    return <>{children}</>;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Image
          source={require('../../assets/images/logo.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="دكان"
        />

        <View style={styles.iconCircle}>
          <Text style={styles.icon} accessibilityElementsHidden>
            ↻
          </Text>
        </View>

        <Text style={styles.title}>يتوفر تحديث جديد</Text>
        <Text style={styles.description}>
          حدّث تطبيق دكان إلى أحدث نسخة لمتابعة التسوق والاستفادة من آخر التحسينات.
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="تحديث التطبيق الآن"
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={openUpdateStore}
        >
          <Text style={styles.buttonText}>تحديث الآن</Text>
        </Pressable>

        <Text style={styles.versionText}>
          الإصدار الحالي {installedVersion} · المطلوب {minimumVersion}
        </Text>
      </View>
    </SafeAreaView>
  );
}

export default function AppUpdateGate({ children }: PropsWithChildren) {
  return Platform.OS === 'android' || Platform.OS === 'ios' ? (
    <MobileUpdateGate>{children}</MobileUpdateGate>
  ) : (
    <>{children}</>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing[6],
    paddingVertical: Spacing[8],
  },
  logo: {
    width: 144,
    height: 64,
    marginBottom: Spacing[10],
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primarySurface,
    marginBottom: Spacing[6],
  },
  icon: {
    color: Colors.primaryDark,
    fontSize: 52,
    lineHeight: 60,
  },
  title: {
    ...Typography.h1,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing[3],
  },
  description: {
    ...Typography.bodyLarge,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 360,
    marginBottom: Spacing[8],
  },
  button: {
    width: '100%',
    maxWidth: 360,
    minHeight: 52,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: Spacing[6],
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    ...Typography.button,
    color: Colors.textOnPrimary,
  },
  versionText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing[4],
  },
});
