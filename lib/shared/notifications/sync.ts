import sql from '@/lib/db';
import { formatDate } from '@/lib/formatDate';
import {
    createNotificationOnce,
    dispatchNotificationPush,
    NOTIFICATION_URLS,
    type CreateNotificationInput,
    type NotificationRow,
} from './inApp';

export interface SyncOptions {
    notify?: boolean;
}

function asDate(value: unknown): Date | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
}

function isRecent(value: unknown, minutes = 10): boolean {
    const date = asDate(value);
    if (!date) return false;
    return Date.now() - date.getTime() <= minutes * 60_000;
}

function appointmentWhen(dateValue: unknown, timeValue: unknown): string {
    return `${formatDate(dateValue as any)} at ${String(timeValue || '').slice(0, 5)}`;
}

async function insertAndMaybePush(
    input: CreateNotificationInput,
    eventTime: unknown,
    notify: boolean,
): Promise<NotificationRow | null> {
    const { notification, created } = await createNotificationOnce(sql, input);
    if (created && notification && notify && isRecent(eventTime)) {
        await dispatchNotificationPush(notification);
    }
    return notification;
}

async function adoptLegacyEventKey(
    uid: string,
    eventKey: string,
    eventTime: string | Date,
    whereSql: any,
): Promise<boolean> {
    try {
        const [legacy] = await sql`
            SELECT notification_id
            FROM notifications
            WHERE uid = ${uid}
              AND (metadata IS NULL OR metadata->>'event_key' IS NULL)
              AND created_at >= ${eventTime}::timestamptz - interval '1 day'
              AND (${whereSql})
            ORDER BY created_at DESC
            LIMIT 1
        `;
        if (!legacy) return false;

        await sql`
            UPDATE notifications
            SET metadata = COALESCE(metadata, '{}'::jsonb)
                || jsonb_build_object('event_key', ${eventKey})
            WHERE notification_id = ${legacy.notification_id}
        `;
        return true;
    } catch (error) {
        console.warn('[notifications/sync] legacy merge skipped:', error);
        return false;
    }
}

export async function syncDueDoseNotifications(uid: string, pid: string): Promise<void> {
    const todayStr = new Date().toISOString().split('T')[0];
    const dueDoses = await sql<any[]>`
        SELECT ma.adherence_id, ma.medicine_name, ma.scheduled_time, ma.scheduled_date
        FROM medication_adherence ma
        WHERE ma.pid = ${pid}
          AND ma.scheduled_date = ${todayStr}
          AND (ma.is_taken IS FALSE OR ma.is_taken IS NULL)
          AND (ma.is_skipped IS FALSE OR ma.is_skipped IS NULL)
        ORDER BY ma.scheduled_time ASC
        LIMIT 5
    `;

    for (const dose of dueDoses) {
        const datePart = String(dose.scheduled_date || todayStr).split('T')[0];
        await createNotificationOnce(sql, {
            uid,
            title: `Medicine Reminder: ${dose.medicine_name}`,
            body: `Time to take your scheduled dose of ${dose.medicine_name} (${String(dose.scheduled_time).slice(0, 5)}).`,
            type: 'reminder',
            actionUrl: NOTIFICATION_URLS.medications,
            eventKey: `reminder:${dose.adherence_id}:${datePart}`,
            metadata: {
                adherence_id: dose.adherence_id,
                medicine_name: dose.medicine_name,
            },
            push: false,
        });
    }
}

export async function syncLifecycleNotifications(
    uid: string,
    pid: string,
    options: SyncOptions = {},
): Promise<void> {
    const notify = options.notify === true;

    await syncAppointments(uid, pid, notify);
    await syncPrescriptions(uid, pid, notify);
    await syncPayments(uid, pid, notify);
}

async function syncAppointments(uid: string, pid: string, notify: boolean): Promise<void> {
    const appointments = await sql<any[]>`
        SELECT
            a.aid,
            a.status,
            a.scheduled_date,
            a.scheduled_time,
            a.updated_at,
            a.cancelled_by,
            du.name AS doctor_name,
            du.profile_image_url AS doctor_image
        FROM appointments a
        JOIN doctors d ON d.did = a.did
        JOIN users du ON du.uid = d.uid
        WHERE a.pid = ${pid}
          AND a.status IN ('confirmed', 'completed', 'cancelled', 'rescheduled')
          AND a.updated_at >= NOW() - interval '14 days'
        ORDER BY a.updated_at DESC
        LIMIT 25
    `;

    for (const appointment of appointments) {
        const status = String(appointment.status);
        const doctorName = appointment.doctor_name
            ? `Dr. ${String(appointment.doctor_name).replace(/^Dr\.?\s+/i, '')}`
            : 'your doctor';
        const when = appointmentWhen(appointment.scheduled_date, appointment.scheduled_time);
        const image = appointment.doctor_image || null;
        const isPatientCancellation = String(appointment.cancelled_by || '') === String(pid);

        if (status === 'cancelled' && isPatientCancellation) continue;

        const updatedAt = asDate(appointment.updated_at);
        const eventKey = status === 'rescheduled'
            ? `appointment:${appointment.aid}:rescheduled:${updatedAt?.getTime() || 0}`
            : `appointment:${appointment.aid}:${status}`;

        const title = status === 'confirmed'
            ? 'Appointment Confirmed'
            : status === 'completed'
                ? 'Consultation Completed'
                : status === 'rescheduled'
                    ? 'Appointment Rescheduled'
                    : 'Appointment Cancelled';

        const body = status === 'confirmed'
            ? `${doctorName} confirmed your appointment on ${when}.`
            : status === 'completed'
                ? `Your consultation with ${doctorName} is complete. Share your feedback.`
                : status === 'rescheduled'
                    ? `Your appointment with ${doctorName} is now scheduled for ${when}.`
                    : `${doctorName} cancelled your appointment on ${when}.`;

        const adopted = await adoptLegacyEventKey(
            uid,
            eventKey,
            appointment.updated_at,
            sql`(metadata->>'appointment_id' = ${String(appointment.aid)} OR metadata->>'aid' = ${String(appointment.aid)})
                AND (
                    (${status} = 'confirmed' AND title ILIKE '%confirm%')
                    OR (${status} = 'completed' AND title ILIKE '%complet%')
                    OR (${status} = 'cancelled' AND title ILIKE '%cancel%')
                    OR (${status} = 'rescheduled' AND title ILIKE '%reschedul%')
                )`,
        );
        if (adopted) continue;

        await insertAndMaybePush({
            uid,
            title,
            body,
            type: 'appointment',
            actionUrl: NOTIFICATION_URLS.appointments,
            eventKey,
            metadata: {
                appointment_id: appointment.aid,
                aid: appointment.aid,
                doctor_name: doctorName,
                image_url: image,
                avatar_url: image,
                status,
            },
            push: notify,
        }, appointment.updated_at, notify);
    }
}

async function syncPrescriptions(uid: string, pid: string, notify: boolean): Promise<void> {
    const prescriptions = await sql<any[]>`
        SELECT
            p.prescription_id,
            p.diagnosis,
            p.sent_at,
            p.created_at,
            du.name AS doctor_name,
            du.profile_image_url AS doctor_image
        FROM prescriptions p
        JOIN doctors d ON d.did = p.did
        JOIN users du ON du.uid = d.uid
        WHERE p.pid = ${pid}
          AND p.is_active = true
          AND p.sent_to_patient = true
          AND COALESCE(p.sent_at, p.created_at) >= NOW() - interval '30 days'
        ORDER BY COALESCE(p.sent_at, p.created_at) DESC
        LIMIT 20
    `;

    for (const prescription of prescriptions) {
        const sentAt = prescription.sent_at || prescription.created_at;
        const doctorName = prescription.doctor_name
            ? `Dr. ${String(prescription.doctor_name).replace(/^Dr\.?\s+/i, '')}`
            : 'your doctor';
        const eventKey = `prescription:${prescription.prescription_id}:sent`;

        const adopted = await adoptLegacyEventKey(
            uid,
            eventKey,
            sentAt,
            sql`(metadata->>'prescription_id' = ${String(prescription.prescription_id)})
                AND (title ILIKE '%prescription%')`,
        );
        if (adopted) continue;

        await insertAndMaybePush({
            uid,
            title: `New Prescription from ${doctorName}`,
            body: `Your prescription for ${prescription.diagnosis || 'your consultation'} is ready.`,
            type: 'prescription',
            actionUrl: NOTIFICATION_URLS.prescriptions,
            eventKey,
            metadata: {
                prescription_id: prescription.prescription_id,
                doctor_name: doctorName,
                image_url: prescription.doctor_image || null,
                avatar_url: prescription.doctor_image || null,
            },
            push: notify,
        }, sentAt, notify);
    }
}

async function syncPayments(uid: string, pid: string, notify: boolean): Promise<void> {
    const payments = await sql<any[]>`
        SELECT
            ft.transaction_id,
            ft.razorpay_payment_id,
            ft.amount,
            ft.status,
            ft.paid_at,
            ft.failed_at,
            ft.created_at,
            du.name AS doctor_name,
            du.profile_image_url AS doctor_image
        FROM finance_transactions ft
        JOIN appointments a ON a.aid = ft.aid
        JOIN doctors d ON d.did = ft.did
        JOIN users du ON du.uid = d.uid
        WHERE a.pid = ${pid}
          AND ft.status IN ('paid', 'failed')
          AND COALESCE(ft.paid_at, ft.failed_at, ft.created_at) >= NOW() - interval '30 days'
        ORDER BY COALESCE(ft.paid_at, ft.failed_at, ft.created_at) DESC
        LIMIT 20
    `;

    for (const payment of payments) {
        const eventTime = payment.paid_at || payment.failed_at || payment.created_at;
        const paymentRef = payment.razorpay_payment_id || payment.transaction_id;
        const eventKey = `payment:${paymentRef}:${payment.status}`;
        const paid = payment.status === 'paid';
        const doctorName = payment.doctor_name
            ? `Dr. ${String(payment.doctor_name).replace(/^Dr\.?\s+/i, '')}`
            : 'your doctor';

        await insertAndMaybePush({
            uid,
            title: paid ? 'Payment Successful' : 'Payment Failed',
            body: paid
                ? `INR ${Number(payment.amount || 0).toFixed(2)} paid for your consultation with ${doctorName}.`
                : `Your payment of INR ${Number(payment.amount || 0).toFixed(2)} for ${doctorName} could not be completed.`,
            type: 'payment',
            actionUrl: NOTIFICATION_URLS.appointments,
            eventKey,
            metadata: {
                transaction_id: payment.transaction_id,
                razorpay_payment_id: payment.razorpay_payment_id,
                doctor_name: doctorName,
                image_url: payment.doctor_image || null,
                avatar_url: payment.doctor_image || null,
            },
            push: notify,
        }, eventTime, notify);
    }
}
