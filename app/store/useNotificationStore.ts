import { create } from 'zustand';

export interface AppNotification {
  notification_id: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  action_url?: string;
  created_at: string;
}

interface NotificationStore {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  lastFetched: number | null;

  fetchNotifications: (token: string, force?: boolean) => Promise<void>;
  markAsRead: (id: string, token: string) => Promise<void>;
  markAllAsRead: (token: string) => Promise<void>;
  invalidate: () => void;
}

const CACHE_TTL_MS = 60_000; // 1 minute

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  lastFetched: null,

  fetchNotifications: async (token, force = false) => {
    const { loading, lastFetched } = get();
    if (loading) return;
    if (!force && lastFetched && Date.now() - lastFetched < CACHE_TTL_MS) return;

    set({ loading: true });
    try {
      const res = await fetch('/api/patient/notifications');
      const data = await res.json();
      if (data.success) {
        const notifs: AppNotification[] = data.notifications || [];
        set({
          notifications: notifs,
          unreadCount: notifs.filter((n) => !n.is_read).length,
          loading: false,
          lastFetched: Date.now(),
        });
      } else {
        set({ loading: false });
      }
    } catch {
      set({ loading: false });
    }
  },

  markAsRead: async (id, token) => {
    // Optimistic update
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.notification_id === id ? { ...n, is_read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));
    try {
      await fetch(`/api/patient/notifications/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_id: id }),
      });
    } catch {
      // Silently fail — optimistic update stays
    }
  },

  markAllAsRead: async (token) => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    }));
    try {
      await fetch('/api/patient/notifications/read', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
    } catch {
      // Silently fail
    }
  },

  invalidate: () => set({ lastFetched: null }),
}));
