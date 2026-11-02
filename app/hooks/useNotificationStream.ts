'use client';

import { useEffect, useRef } from 'react';
import { useNotificationStore } from '@/app/store/useNotificationStore';

export function useNotificationStream(enabled = true): void {
  const addNotification = useNotificationStore((state) => state.addNotification);
  const lastEventAtRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !('EventSource' in window)) {
      return;
    }

    let stopped = false;
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (stopped) return;
      const since = lastEventAtRef.current;
      const url = since
        ? `/api/patient/notifications/stream?since=${encodeURIComponent(since)}`
        : '/api/patient/notifications/stream';

      source = new EventSource(url);

      source.addEventListener('notification', (event) => {
        try {
          const notification = JSON.parse((event as MessageEvent).data);
          addNotification(notification);
          if (notification?.created_at) {
            lastEventAtRef.current = notification.created_at;
          }
        } catch {
          // Ignore malformed events and keep the stream alive.
        }
      });

      source.onerror = () => {
        source?.close();
        source = null;
        if (!stopped) {
          retryTimer = setTimeout(connect, 3000);
        }
      };
    };

    connect();

    return () => {
      stopped = true;
      source?.close();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [enabled, addNotification]);
}
