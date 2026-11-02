'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Calendar,
  Pill,
  CreditCard,
  Star,
  Clock,
  CheckCheck,
  ChevronRight,
} from 'lucide-react';
import {
  useNotificationStore,
  type AppNotification,
} from '@/app/store/useNotificationStore';

function relativeTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
}

function NotificationIcon({ type }: { type: string }) {
  const className = 'w-5 h-5';
  switch (type) {
    case 'appointment':
      return <Calendar className={className} />;
    case 'prescription':
      return <Pill className={className} />;
    case 'payment':
      return <CreditCard className={className} />;
    case 'review':
      return <Star className={className} />;
    case 'reminder':
      return <Clock className={className} />;
    default:
      return <Bell className={className} />;
  }
}

export default function NotificationsPage() {
  const router = useRouter();
  const notifications = useNotificationStore((state) => state.notifications);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const loading = useNotificationStore((state) => state.loading);
  const fetchNotifications = useNotificationStore((state) => state.fetchNotifications);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);

  useEffect(() => {
    fetchNotifications('', true);
  }, [fetchNotifications]);

  const openNotification = (notification: AppNotification) => {
    if (!notification.is_read) {
      markAsRead(notification.notification_id, '');
    }
    if (notification.action_url) {
      router.push(notification.action_url);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-forest-900">Notifications</h1>
          <p className="text-sm text-forest-500 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}` : 'You are all caught up.'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => markAllAsRead('')}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-sage-200 text-xs font-semibold text-forest-700 hover:bg-sage-50"
          >
            <CheckCheck className="w-4 h-4" />
            Mark all read
          </button>
        )}
      </div>

      {loading && notifications.length === 0 ? (
        <div className="space-y-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-24 rounded-2xl bg-sage-100/70 animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-2xl border border-sage-200 bg-white p-10 text-center">
          <Bell className="w-8 h-8 mx-auto text-forest-400" />
          <p className="mt-3 text-sm font-semibold text-forest-800">No notifications yet</p>
          <p className="mt-1 text-xs text-forest-500">
            Appointment updates, prescriptions, payments and reminders will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <button
              key={notification.notification_id}
              type="button"
              onClick={() => openNotification(notification)}
              className={`w-full text-left rounded-2xl border p-4 transition-all ${
                notification.is_read
                  ? 'border-sage-200 bg-white hover:bg-sage-50'
                  : 'border-primary/20 bg-primary/[0.04] hover:bg-primary/[0.07]'
              }`}
            >
              <div className="flex items-start gap-3">
                {notification.image_url ? (
                  <img
                    src={notification.image_url}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <span className="w-10 h-10 rounded-full bg-sage-100 text-forest-600 flex items-center justify-center shrink-0">
                    <NotificationIcon type={notification.type} />
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <p className="text-sm font-semibold text-forest-900 flex-1">
                      {notification.title}
                    </p>
                    {!notification.is_read && (
                      <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-forest-600">{notification.body}</p>
                  <p className="mt-2 text-[10px] uppercase tracking-wide font-semibold text-forest-400">
                    {relativeTime(notification.created_at)}
                  </p>
                </div>

                {notification.action_url && (
                  <ChevronRight className="w-4 h-4 text-forest-400 shrink-0 mt-1" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
