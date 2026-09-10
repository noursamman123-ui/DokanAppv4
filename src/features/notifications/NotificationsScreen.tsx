import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { NotificationsService } from '../../api/notifications.service';
import { AccountStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { Colors } from '../../theme/colors';
import { Typography, FontFamily } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { Shadows } from '../../theme/shadows';
import { AppNotification } from '../../types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type NavProp = NativeStackNavigationProp<AccountStackParamList, 'Notifications'>;

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('ar', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const getNotificationIcon = (type: AppNotification['type']) => {
  switch (type) {
    case 'order':
      return 'package-variant-closed';
    case 'promotion':
      return 'tag-outline';
    default:
      return 'bell-outline';
  }
};

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: NotificationsService.getNotifications,
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });

  const unreadCount = useMemo(
    () => data.filter((notification) => !notification.read).length,
    [data],
  );

  const markRead = async (notification: AppNotification) => {
    if (notification.read) {
      return;
    }

    await NotificationsService.markRead(notification.id);
    refetch();
  };

  const markAllRead = async () => {
    if (!unreadCount || isMarkingAll) {
      return;
    }

    setIsMarkingAll(true);
    try {
      await NotificationsService.markAllRead();
      refetch();
    } finally {
      setIsMarkingAll(false);
    }
  };

  const openLogin = () => {
    navigation.getParent()?.getParent()?.navigate('Auth', { screen: 'Login' });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + Spacing[2] }]}>
        <TouchableOpacity
          onPress={() => navigation.navigate('AccountScreen')}
          accessibilityRole="button"
          accessibilityLabel="رجوع"
        >
          <Text style={styles.backText}>رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.title}>الإشعارات</Text>
        <View style={styles.headerSpacer} />
      </View>

      {!isAuthenticated ? (
        <View style={styles.stateWrap}>
          <MaterialCommunityIcons name="account-lock-outline" style={styles.stateIcon} />
          <Text style={styles.stateTitle}>تسجيل الدخول مطلوب</Text>
          <Text style={styles.stateText}>سجّل دخولك لمتابعة تحديثات طلباتك وتنبيهات حسابك.</Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={openLogin}
            accessibilityRole="button"
            accessibilityLabel="تسجيل الدخول"
          >
            <Text style={styles.primaryBtnText}>تسجيل الدخول</Text>
          </TouchableOpacity>
        </View>
      ) : isLoading ? (
        <ActivityIndicator style={styles.loader} size="large" color={Colors.primary} />
      ) : error ? (
        <View style={styles.stateWrap}>
          <MaterialCommunityIcons name="alert-circle-outline" style={styles.stateIcon} />
          <Text style={styles.stateTitle}>تعذر تحميل الإشعارات</Text>
          <Text style={styles.stateText}>تحقق من الاتصال بالإنترنت ثم أعد المحاولة.</Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => refetch()}
            accessibilityRole="button"
            accessibilityLabel="إعادة المحاولة"
          >
            <Text style={styles.primaryBtnText}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      ) : data.length === 0 ? (
        <View style={styles.stateWrap}>
          <MaterialCommunityIcons name="bell-check-outline" style={styles.stateIcon} />
          <Text style={styles.stateTitle}>لا توجد إشعارات</Text>
          <Text style={styles.stateText}>ستظهر هنا تحديثات الطلبات والتنبيهات المهمة عند توفرها.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>
              {unreadCount > 0 ? `${unreadCount} إشعار غير مقروء` : 'كل الإشعارات مقروءة'}
            </Text>
            {unreadCount > 0 && (
              <TouchableOpacity
                onPress={markAllRead}
                disabled={isMarkingAll}
                accessibilityRole="button"
                accessibilityLabel="تحديد الكل كمقروء"
                accessibilityState={{ disabled: isMarkingAll, busy: isMarkingAll }}
              >
                <Text style={[styles.markAllText, isMarkingAll && styles.disabledText]}>
                  تحديد الكل كمقروء
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {data.map((notification) => (
            <TouchableOpacity
              key={notification.id}
              style={[styles.notificationItem, !notification.read && styles.unreadItem]}
              onPress={() => markRead(notification)}
              accessibilityRole="button"
              accessibilityLabel={`${notification.title || 'تنبيه من دكان'}${!notification.read ? '، غير مقروء' : ''}`}
            >
              <View style={[styles.iconWrap, !notification.read && styles.unreadIconWrap]}>
                <MaterialCommunityIcons
                  name={getNotificationIcon(notification.type)}
                  style={styles.itemIcon}
                />
              </View>
              <View style={styles.itemContent}>
                <View style={styles.itemHeader}>
                  {!notification.read && <View style={styles.unreadDot} />}
                  <Text style={styles.itemTitle}>{notification.title || 'تنبيه من دكان'}</Text>
                </View>
                {Boolean(notification.body) && (
                  <Text style={styles.itemBody}>{notification.body}</Text>
                )}
                {Boolean(notification.created_at) && (
                  <Text style={styles.itemDate}>{formatDate(notification.created_at)}</Text>
                )}
              </View>
            </TouchableOpacity>
          ))}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.surface,
    paddingTop: Spacing[10],
    paddingBottom: Spacing[3],
    paddingHorizontal: Spacing[4],
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Shadows.sm,
  },
  backText: {
    ...Typography.labelLarge,
    fontSize: 16,
    color: Colors.textPrimary,
    fontFamily: FontFamily.arabicBold,
  },
  title: { ...Typography.h4, color: Colors.textPrimary, fontFamily: FontFamily.arabicBold },
  headerSpacer: { width: 40 },
  loader: { flex: 1, justifyContent: 'center' },
  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing[6],
  },
  stateIcon: { fontSize: 44, color: Colors.textTertiary, marginBottom: Spacing[3] },
  stateTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
    fontFamily: FontFamily.arabicBold,
    marginBottom: Spacing[1],
    textAlign: 'center',
  },
  stateText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginBottom: Spacing[4],
    textAlign: 'center',
    lineHeight: 22,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing[5],
    paddingVertical: Spacing[2.5],
  },
  primaryBtnText: {
    ...Typography.button,
    color: Colors.textInverse,
    fontFamily: FontFamily.arabicBold,
  },
  content: { padding: Spacing[4], gap: Spacing[3] },
  summaryRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing[1],
  },
  summaryText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    fontFamily: FontFamily.arabicMedium,
  },
  markAllText: {
    ...Typography.labelLarge,
    color: Colors.primaryDark,
    fontFamily: FontFamily.arabicBold,
  },
  disabledText: { opacity: 0.5 },
  notificationItem: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: Spacing[4],
    flexDirection: 'row-reverse',
    gap: Spacing[3],
    ...Shadows.xs,
  },
  unreadItem: { borderColor: Colors.primary },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceSecondary,
  },
  unreadIconWrap: { backgroundColor: Colors.primarySurface },
  itemIcon: { fontSize: 22, color: Colors.primaryDark },
  itemContent: { flex: 1 },
  itemHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: Spacing[2],
    marginBottom: Spacing[1],
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
  },
  itemTitle: {
    flex: 1,
    ...Typography.body,
    color: Colors.textPrimary,
    fontFamily: FontFamily.arabicBold,
    textAlign: 'right',
  },
  itemBody: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    fontFamily: FontFamily.arabicRegular,
    textAlign: 'right',
    lineHeight: 22,
  },
  itemDate: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'right',
    marginTop: Spacing[2],
  },
  bottomSpacer: { height: 80 },
});
