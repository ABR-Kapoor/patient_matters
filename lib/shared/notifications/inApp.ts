import sql from '@/lib/db';
import { sendPushToUid } from './push';

export type NotificationType =
    | 'appointment'
    | 'prescription'
    | 'payment'
    | 'general'
    | 'reminder'
    | 'review';

export interface NotificationMetadata {
    event_key?: string;
    image_url?: string | null;
    avatar_url?: string | null;
    doctor_name?: string | null;
    patient_name?: string | null;
    did?: string | null;
    pid?: string | null;
    aid?: string | null;
    appointment_id?: string | null;
    prescription_id?: string | null;
    call_session_id?: string | null;
    refund_id?: string | null;
    [key: string]: unknown;
}

export interface CreateNotificationInput {
    uid: string;
    title: string;
    body: string;
    type: NotificationType;
    actionUrl?: string | null;
    metadata?: NotificationMetadata;
    eventKey: string;
    push?: boolean;
}

export interface NotificationRow {
    notification_id: string;
    uid: string;
    title: string;
    body: string;
    type: string;
    is_read: boolean;
    action_url: string | null;
    metadata: NotificationMetadata | null;
    created_at: string | Date;
    read_at: string | Date | null;
}

export const NOTIFICATION_URLS = {
    dashboard: '/dashboard',
    appointments: '/dashboard/appointments',
    prescriptions: '/dashboard/prescriptions',
    medications: '/dashboard/medications',
    notifications: '/dashboard/notifications',
    profile: '/dashboard/profile',
    videoCall: (aid: string) => `/dashboard/video-call/${aid}`,
} as const;

export async function createNotificationOnce(
    db: any,
    input: CreateNotificationInput,
): Promise<{ notification: NotificationRow | null; created: boolean }> {
    const metadata: NotificationMetadata = {
        ...(input.metadata || {}),
        event_key: input.eventKey,
    };

    const rows = await db`
        INSERT INTO notifications (uid, title, body, type, action_url, metadata)
        VALUES (
            ${input.uid},
            ${input.title},
            ${input.body},
            ${input.type},
            ${input.actionUrl || null},
            ${JSON.stringify(metadata)}::jsonb
        )
        ON CONFLICT (uid, ((metadata ->> 'event_key')))
            WHERE metadata ? 'event_key'
        DO NOTHING
        RETURNING *
    `;

    const notification = (rows[0] as NotificationRow | undefined) || null;
    return { notification, created: Boolean(notification) };
}

export async function dispatchNotificationPush(notification: NotificationRow): Promise<void> {
    const metadata = notification.metadata || {};
    const url = notification.action_url
        || (metadata.aid ? NOTIFICATION_URLS.videoCall(String(metadata.aid)) : NOTIFICATION_URLS.notifications);

    await sendPushToUid(notification.uid, {
        title: notification.title,
        body: notification.body,
        channelId: 'patient-updates',
        data: {
            url,
            notification_id: notification.notification_id,
            type: notification.type,
            aid: metadata.aid || metadata.appointment_id || null,
            event_key: metadata.event_key || null,
        },
    });
}

export async function notifyOnce(
    input: CreateNotificationInput,
): Promise<{ notification: NotificationRow | null; created: boolean }> {
    const result = await createNotificationOnce(sql, input);
    if (result.created && result.notification && input.push !== false) {
        await dispatchNotificationPush(result.notification);
    }
    return result;
}

export async function notifyMany(
    inputs: CreateNotificationInput[],
): Promise<NotificationRow[]> {
    const created: NotificationRow[] = [];
    for (const input of inputs) {
        const result = await notifyOnce(input);
        if (result.notification) created.push(result.notification);
    }
    return created;
}
