import apiClient from './client';
import { Endpoints } from './endpoints';
import { AppNotification } from '../types';

type NotificationsResponse = AppNotification[] | {
  data?: AppNotification[];
  success?: boolean;
};

const normalizeNotifications = (payload: NotificationsResponse): AppNotification[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  return Array.isArray(payload.data) ? payload.data : [];
};

export const NotificationsService = {
  getNotifications: async (): Promise<AppNotification[]> => {
    const response = await apiClient.get<NotificationsResponse>(Endpoints.notifications.list);
    return normalizeNotifications(response.data);
  },

  markRead: async (id: string): Promise<void> => {
    await apiClient.post(Endpoints.notifications.markRead(id));
  },

  markAllRead: async (): Promise<void> => {
    await apiClient.post(Endpoints.notifications.markAllRead);
  },

  getUnreadCount: async (): Promise<number> => {
    const notifications = await NotificationsService.getNotifications();
    return notifications.filter((notification) => !notification.read).length;
  },
};
