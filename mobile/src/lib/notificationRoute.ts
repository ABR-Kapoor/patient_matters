import type { Href } from 'expo-router';

export function toMobileNotificationHref(url?: string | null): Href | null {
  if (!url) return null;

  const trimmed = url.trim();
  if (!trimmed) return null;

  if (trimmed === '/dashboard' || trimmed === '/dashboard/') {
    return '/(dashboard)' as Href;
  }

  const withoutDashboard = trimmed.startsWith('/dashboard')
    ? trimmed.slice('/dashboard'.length)
    : trimmed;

  const path = withoutDashboard.startsWith('/')
    ? withoutDashboard
    : `/${withoutDashboard}`;

  return path as Href;
}
