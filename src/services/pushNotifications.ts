import { Platform, PermissionsAndroid } from 'react-native';
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { queryClient } from './queryClient';
import { navigateToNotifications } from '../navigation/navigationRef';

const PROMOTIONS_TOPIC = 'promotions';

async function requestPermission(): Promise<void> {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  } else if (Platform.OS === 'ios') {
    await messaging().requestPermission();
  }
}

function handleNotificationOpen(message: FirebaseMessagingTypes.RemoteMessage | null): void {
  if (!message) return;
  navigateToNotifications();
}

export async function initPushNotifications(): Promise<void> {
  try {
    await requestPermission();
    await messaging().subscribeToTopic(PROMOTIONS_TOPIC);
  } catch {
    // No APNs token available (iOS Simulator always lands here — Apple
    // never issues real push tokens to it — or permission was denied on a
    // real device). Push just won't arrive on this install; everything
    // else below still works fine without it.
  }

  // App in foreground: no system banner is shown by FCM automatically, so
  // just refresh the in-app unread badge instead of a silent no-op.
  messaging().onMessage(async () => {
    queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
  });

  messaging().onNotificationOpenedApp(handleNotificationOpen);

  const initialMessage = await messaging().getInitialNotification();
  handleNotificationOpen(initialMessage);
}
