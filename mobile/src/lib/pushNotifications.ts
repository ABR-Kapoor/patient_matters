import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { ensureNotificationPermission } from './doseNotifications';
import { fetchWithAuth } from './fetchWithAuth';

type NotificationsModule = typeof import('expo-notifications');

let Notifications: NotificationsModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Notifications = require('expo-notifications');
} catch (error) {
  console.warn('[pushNotifications] expo-notifications unavailable', error);
}

const PUSH_CHANNEL_ID = 'patient-updates';

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

export async function registerPushNotifications(
  getToken: () => Promise<string | null>,
): Promise<void> {
  const notifications = Notifications;
  if (!notifications || !Device.isDevice) return;

  try {
    const granted = await ensureNotificationPermission();
    if (!granted) return;

    const project = await projectId();
    const expoPushToken = await notifications.getExpoPushTokenAsync(
      project ? { projectId: project } : undefined,
    );

    if (!expoPushToken?.data) return;

    if (Platform.OS === 'android') {
      await notifications.setNotificationChannelAsync(PUSH_CHANNEL_ID, {
        name: 'Patient Updates',
        description: 'Appointments, prescriptions, payments and reminders',
        importance: notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#048256',
        enableVibrate: true,
        showBadge: true,
        enableLights: true,
        sound: 'default',
      });
    }

    await savePushToken(expoPushToken.data, getToken);
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

  const subscription = notifications.addPushTokenListener(({ data }) => {
    void savePushToken(data, getToken).catch((error) => {
      console.warn('[pushNotifications] token refresh failed', error);
    });
  });

  return () => subscription.remove();
}
