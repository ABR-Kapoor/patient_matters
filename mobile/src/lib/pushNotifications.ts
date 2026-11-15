import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import type { DevicePushToken } from 'expo-notifications';
import { ensureNotificationPermission } from './doseNotifications';
import { fetchWithAuth } from './fetchWithAuth';
import { ensurePushChannel } from './notificationChannels';

type NotificationsModule = typeof import('expo-notifications');

let Notifications: NotificationsModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Notifications = require('expo-notifications');
} catch (error) {
  console.warn('[pushNotifications] expo-notifications unavailable', error);
}

async function projectId(): Promise<string | undefined> {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ||
    (Constants as any).easConfig?.projectId ||
    undefined
  );
}

async function savePushToken(
  token: string,
  getToken: () => Promise<string | null>,
): Promise<void> {
  const response = await fetchWithAuth('/api/patient/push-tokens', getToken, {
    method: 'POST',
    body: JSON.stringify({
      token,
      platform: Platform.OS,
      device_name: Device.modelName || null,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Push token registration failed (${response.status}): ${body}`);
  }
}

// Resolves the Expo push token and stores it against the signed-in patient.
// `devicePushToken` is only passed when re-registering from the native token
// listener: it lets us skip getDevicePushTokenAsync, which would emit the same
// listener again and loop indefinitely.
async function registerExpoToken(
  getToken: () => Promise<string | null>,
  devicePushToken?: DevicePushToken,
): Promise<void> {
  const notifications = Notifications;
  if (!notifications || !Device.isDevice) return;

  const granted = await ensureNotificationPermission();
  if (!granted) return;

  await ensurePushChannel(notifications);

  const project = await projectId();
  const expoPushToken = await notifications.getExpoPushTokenAsync({
    ...(project ? { projectId: project } : {}),
    ...(devicePushToken ? { devicePushToken } : {}),
  });

  if (!expoPushToken?.data) return;

  await savePushToken(expoPushToken.data, getToken);
}

export async function registerPushNotifications(
  getToken: () => Promise<string | null>,
): Promise<void> {
  try {
    await registerExpoToken(getToken);
  } catch (error) {
    // Expo Go on Android cannot issue remote push tokens; this is expected there.
    console.warn('[pushNotifications] registration skipped', error);
  }
}

export function subscribeToPushTokenChanges(
  getToken: () => Promise<string | null>,
): () => void {
  const notifications = Notifications;
  if (!notifications) return () => {};

  // This listener fires with the *native* FCM/APNs token, not the Expo push
  // token. Saving it directly always failed backend validation, so refresh the
  // Expo token derived from it instead.
  const subscription = notifications.addPushTokenListener((devicePushToken) => {
    void registerExpoToken(getToken, devicePushToken).catch((error) => {
      console.warn('[pushNotifications] token refresh failed', error);
    });
  });

  return () => subscription.remove();
}
