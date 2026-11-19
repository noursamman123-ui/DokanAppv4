import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

let hasPendingNotificationsNavigation = false;

const openNotifications = () => {
  (navigationRef as any).navigate('Main', {
    screen: 'Account',
    params: { screen: 'Notifications' },
  });
};

export function navigateToNotifications() {
  if (!navigationRef.isReady()) {
    hasPendingNotificationsNavigation = true;
    return;
  }

  openNotifications();
}

export function flushPendingNavigation() {
  if (!hasPendingNotificationsNavigation || !navigationRef.isReady()) {
    return;
  }

  hasPendingNotificationsNavigation = false;
  openNotifications();
}
