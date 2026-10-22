import { Platform } from 'react-native';

// Local, on-device reminders for medication doses. Scheduling is a rolling
// window (not the whole prescription) because iOS caps scheduled local
// notifications at 64 per app and Android at ~500 — the window is refreshed
// every time the adherence data is fetched, so the cap never runs out.
//
// The module is loaded lazily inside a try/catch: expo-notifications ships a
// native module that is only present once the dev client/app binary has been
// rebuilt with it in the dependency list. On an older binary `require` throws
// "Cannot find native module 'ExpoPushTokenManager'" — reminders become no-ops
// instead of crashing the whole app at import time.
type NotificationsModule = typeof import('expo-notifications');

let Notifications: NotificationsModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Notifications = require('expo-notifications');
} catch (err) {
  console.warn('[doseNotifications] expo-notifications unavailable, reminders disabled. Rebuild the dev client.', err);
}

const CHANNEL_ID = 'medication-reminders-v3';
const ID_PREFIX = 'dose:';
const WINDOW_DAYS = 3;
const MAX_SCHEDULED = 40;

export const DOSE_TAP_URL = '/medications';

export type DoseRecord = {
  adherence_id: string;
  medicine_name: string;
  dosage?: string | null;
  scheduled_date: string | Date;
  scheduled_time: string;
  status?: string;
  is_taken?: boolean | null;
  is_skipped?: boolean | null;
};

export async function configureDoseNotifications() {
  const n = Notifications;
  if (!n) return;

  n.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  if (Platform.OS === 'android') {
    try {
      await n.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Medication Reminders',
        importance: n.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#048256',
        enableVibrate: true,
        showBadge: true,
        enableLights: true,
        bypassDnd: false,
        sound: 'default',
        audioAttributes: {
          usage: n.AndroidAudioUsage.NOTIFICATION,
          contentType: n.AndroidAudioContentType.SONIFICATION,
        },
      });
    } catch (err) {
      console.warn('[doseNotifications] failed to create channel at startup', err);
    }
  }
}

// Creates the Android channel FIRST: on Android 13+ the permission prompt is
// not shown until at least one channel exists.
export async function ensureNotificationPermission(): Promise<boolean> {
  const n = Notifications;
  if (!n) return false;

  try {
    if (Platform.OS === 'android') {
      await n.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Medication Reminders',
        importance: n.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#048256',
        enableVibrate: true,
        showBadge: true,
        enableLights: true,
        bypassDnd: false,
        sound: 'default',
        audioAttributes: {
          usage: n.AndroidAudioUsage.NOTIFICATION,
          contentType: n.AndroidAudioContentType.SONIFICATION,
        },
      });
    }

    const current = await n.getPermissionsAsync();
    if (isGranted(current)) return true;

    const requested = await n.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: true },
      android: {},
    });
    return isGranted(requested);
  } catch (err) {
    console.warn('[doseNotifications] permission check failed', err);
    return false;
  }
}

function isGranted(status: import('expo-notifications').NotificationPermissionsStatus): boolean {
  const n = Notifications;
  if (!n) return false;

  return (
    status.granted ||
    status.ios?.status === n.IosAuthorizationStatus.PROVISIONAL
  );
}

// scheduled_date arrives as 'YYYY-MM-DD' (Postgres DATE) or an ISO string, and
// scheduled_time as 'HH:MM:SS'. Both are wall-clock values, so build the Date
// from components instead of letting `new Date(string)` shift it into UTC.
export function doseDate(record: DoseRecord): Date | null {
  const datePart = String(record.scheduled_date || '').split('T')[0];
  const [year, month, day] = datePart.split('-').map(Number);
  const timePart = String(record.scheduled_time || '00:00:00');
  const [hours, minutes] = timePart.split(':').map(Number);

  if (!year || !month || !day || Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

function doseStatus(record: DoseRecord): string {
  if (record.status) return record.status;
  if (record.is_taken) return 'taken';
  if (record.is_skipped) return 'skipped';
  return 'pending';
}

// Drops scheduled reminders that are no longer wanted (taken, skipped, past,
// outside the window) and schedules the ones that are missing. Ids are
// derived from adherence_id so a re-sync is idempotent.
export async function syncDoseNotifications(records: DoseRecord[]): Promise<void> {
  const n = Notifications;
  if (!n) return;

  try {
    if (!(await ensureNotificationPermission())) return;

    const now = new Date();
    const windowEnd = new Date(now);
    windowEnd.setDate(windowEnd.getDate() + WINDOW_DAYS);
    windowEnd.setHours(23, 59, 59, 999);

    const wanted = records
      .filter((record) => doseStatus(record) === 'pending')
      .map((record) => ({ record, date: doseDate(record) }))
      .filter((entry): entry is { record: DoseRecord; date: Date } => !!entry.date)
      .filter((entry) => entry.date.getTime() > now.getTime() && entry.date.getTime() <= windowEnd.getTime())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, MAX_SCHEDULED);

    const wantedIds = new Set(wanted.map((entry) => `${ID_PREFIX}${entry.record.adherence_id}`));

    const scheduled = await n.getAllScheduledNotificationsAsync();
    for (const request of scheduled) {
      if (request.identifier.startsWith(ID_PREFIX) && !wantedIds.has(request.identifier)) {
        await n.cancelScheduledNotificationAsync(request.identifier).catch(() => {});
      }
    }

    const alreadyScheduled = new Set(scheduled.map((request) => request.identifier));

    for (const { record, date } of wanted) {
      const identifier = `${ID_PREFIX}${record.adherence_id}`;
      if (alreadyScheduled.has(identifier)) continue;

      const dosage = record.dosage ? ` (${record.dosage})` : '';
      await n.scheduleNotificationAsync({
        identifier,
        content: {
          title: 'Medicine reminder',
          body: `Time for ${record.medicine_name}${dosage}`,
          sound: true,
          priority: n.AndroidNotificationPriority.HIGH,
          data: { url: DOSE_TAP_URL, adherenceId: record.adherence_id },
        },
        trigger: {
          type: n.SchedulableTriggerInputTypes.DATE,
          date,
          channelId: CHANNEL_ID,
        },
      });
    }
  } catch (err) {
    console.warn('[doseNotifications] sync failed', err);
  }
}

// Called after a dose is marked taken/skipped so the reminder for it does not
// fire for a dose the patient already acted on.
export async function cancelDoseNotification(adherenceId: string): Promise<void> {
  const n = Notifications;
  if (!n) return;

  try {
    await n.cancelScheduledNotificationAsync(`${ID_PREFIX}${adherenceId}`).catch(() => {});
  } catch (err) {
    console.warn('[doseNotifications] cancel failed', err);
  }
}

// Tapping a reminder opens the Medications tab where the dose can be logged.
// Handles both a tap while running and a tap that cold-starts the app.
export function subscribeToDoseNotificationTaps(
  navigate: (url: string) => void
): () => void {
  const n = Notifications;
  if (!n) return () => {};

  const redirect = (response: import('expo-notifications').NotificationResponse | null | undefined) => {
    const url = response?.notification?.request?.content?.data?.url;
    if (typeof url === 'string' && url.length > 0) navigate(url);
  };

  void n.getLastNotificationResponseAsync().then(redirect);

  const subscription = n.addNotificationResponseReceivedListener(redirect);
  return () => subscription.remove();
}
