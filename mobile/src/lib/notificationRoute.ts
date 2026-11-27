import type { Href } from 'expo-router';

/**
 * Maps notification payloads (URLs or data types) to their matching patient mobile screens.
 */
export function toMobileNotificationHref(
  url?: string | null,
  data?: Record<string, any> | null,
): Href | null {
  if (data?.type === 'video_call' && data?.aid) {
    return `/video-call/${data.aid}` as Href;
  }

  if (data?.type === 'prescription') {
    return '/(dashboard)/prescriptions' as Href;
  }

  if (data?.type === 'medication' || data?.type === 'dose') {
    return '/(dashboard)/medications' as Href;
  }

  if (data?.type === 'appointment') {
    return '/(dashboard)/appointments' as Href;
  }

  if (!url) {
    return '/(dashboard)/notifications' as Href;
  }

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
