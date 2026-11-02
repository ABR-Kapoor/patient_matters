import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { fetch as expoFetch } from 'expo/fetch';
import { API_BASE_URL, fetchWithAuth } from '../lib/fetchWithAuth';
import { useAuthToken } from '../hooks/stubs';

export interface FeedNotification {
  notification_id: string;
  title: string;
  body: string;
  message?: string;
  type: string;
  is_read: boolean;
  action_url?: string | null;
  metadata?: Record<string, any> | null;
  image_url?: string | null;
  avatar_url?: string | null;
  doctor_name?: string | null;
  created_at: string;
}

interface NotificationFeedContextValue {
  notifications: FeedNotification[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markAsRead: (notificationId?: string | null, markAll?: boolean) => Promise<void>;
}

const NotificationFeedContext = createContext<NotificationFeedContextValue | null>(null);

const STREAM_RECONNECT_MS = 3000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function NotificationFeedProvider({ children }: { children: ReactNode }) {
  const getToken = useAuthToken();
  const [notifications, setNotifications] = useState<FeedNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const lastEventAtRef = useRef<string | null>(null);
  const seenRef = useRef<Set<string>>(new Set());

  const unreadCount = notifications.filter((item) => !item.is_read).length;

  const addNotification = useCallback((notification: FeedNotification) => {
    if (!notification?.notification_id || seenRef.current.has(notification.notification_id)) {
      return;
    }
    seenRef.current.add(notification.notification_id);
    if (notification.created_at) {
      lastEventAtRef.current = notification.created_at;
    }
    setNotifications((previous) => [notification, ...previous].slice(0, 100));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await fetchWithAuth('/api/patient/notifications', getToken);
      const data = await response.json();
      if (data?.success) {
        const list: FeedNotification[] = Array.isArray(data.notifications)
          ? data.notifications
          : [];
        setNotifications(list);
        seenRef.current = new Set(list.map((item) => item.notification_id));
        if (list[0]?.created_at) lastEventAtRef.current = list[0].created_at;
      }
    } catch (error) {
      console.warn('[notifications] refresh failed', error);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  const markAsRead = useCallback(
    async (notificationId: string | null = null, markAll = false) => {
      setNotifications((previous) =>
        previous.map((item) =>
          markAll || item.notification_id === notificationId
            ? { ...item, is_read: true }
            : item,
        ),
      );

      try {
        await fetchWithAuth('/api/patient/notifications/read', getToken, {
          method: 'PATCH',
          body: JSON.stringify({ notification_id: notificationId, markAll }),
        });
      } catch (error) {
        console.warn('[notifications] mark read failed', error);
        void refresh();
      }
    },
    [getToken, refresh],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    let controller: AbortController | null = null;

    const openStream = async () => {
      while (!cancelled) {
        try {
          const token = await getToken();
          if (!token) {
            await sleep(1500);
            continue;
          }

          controller = new AbortController();
          const since = lastEventAtRef.current;
          const query = since ? `?since=${encodeURIComponent(since)}` : '';
          const response = await expoFetch(
            `${API_BASE_URL}/api/patient/notifications/stream${query}`,
            {
              headers: {
                Accept: 'text/event-stream',
                Authorization: `Bearer ${token}`,
              },
              signal: controller.signal,
            },
          );

          if (!response.ok || !response.body) {
            throw new Error(`Stream failed with ${response.status}`);
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (!cancelled) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let boundary = buffer.indexOf('\n\n');
            while (boundary >= 0) {
              const frame = buffer.slice(0, boundary);
              buffer = buffer.slice(boundary + 2);

              const eventLine = frame
                .split('\n')
                .find((line) => line.startsWith('event:'));
              const data = frame
                .split('\n')
                .filter((line) => line.startsWith('data:'))
                .map((line) => line.slice(5).trimStart())
                .join('\n');

              if (eventLine?.includes('notification') && data) {
                try {
                  addNotification(JSON.parse(data));
                } catch {
                  // Ignore a malformed frame and continue reading.
                }
              }

              boundary = buffer.indexOf('\n\n');
            }
          }
        } catch (error) {
          if (!cancelled) {
            console.warn('[notifications] stream disconnected', error);
          }
        } finally {
          controller?.abort();
          controller = null;
        }

        if (!cancelled) await sleep(STREAM_RECONNECT_MS);
      }
    };

    void openStream();

    return () => {
      cancelled = true;
      controller?.abort();
    };
  }, [addNotification, getToken]);

  return (
    <NotificationFeedContext.Provider
      value={{ notifications, unreadCount, loading, refresh, markAsRead }}
    >
      {children}
    </NotificationFeedContext.Provider>
  );
}

export function useNotificationFeed(): NotificationFeedContextValue {
  const context = useContext(NotificationFeedContext);
  if (!context) {
    throw new Error('useNotificationFeed must be used inside NotificationFeedProvider');
  }
  return context;
}
