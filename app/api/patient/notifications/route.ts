import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requirePatient } from '@/lib/authz';
import {
    createNotificationOnce,
    NOTIFICATION_URLS,
} from '@/lib/shared/notifications/inApp';
import {
    syncDueDoseNotifications,
    syncLifecycleNotifications,
} from '@/lib/shared/notifications/sync';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const auth = await requirePatient();
        if (!auth.ok) return auth.response;

        try {
            await syncLifecycleNotifications(auth.data.uid, auth.data.pid);
            await syncDueDoseNotifications(auth.data.uid, auth.data.pid);
        } catch (syncErr) {
            console.error('Failed to sync notifications:', syncErr);
        }

        let notifications = await sql`
            SELECT 
                n.*,
                COALESCE(
                    n.metadata->>'image_url',
                    n.metadata->>'avatar_url',
                    doc_u.profile_image_url
                ) as image_url,
                COALESCE(
                    n.metadata->>'doctor_name',
                    doc_u.name
                ) as doctor_name
            FROM notifications n
            LEFT JOIN doctors d ON (
                d.did = CASE 
                    WHEN n.metadata->>'did' IS NOT NULL AND (n.metadata->>'did') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
                    THEN (n.metadata->>'did')::uuid 
                    ELSE NULL 
                END
            )
            LEFT JOIN users doc_u ON doc_u.uid = d.uid
            WHERE n.uid = ${auth.data.uid}
            ORDER BY n.created_at DESC
            LIMIT 50
        `;

        if (!notifications || notifications.length === 0) {
            await createNotificationOnce(sql, {
                uid: auth.data.uid,
                title: 'Welcome to AuraSutra',
                body: 'Your healthcare account is active. You can browse doctors, book consultations, and view prescriptions anytime.',
                type: 'general',
                actionUrl: NOTIFICATION_URLS.dashboard,
                eventKey: `welcome:${auth.data.uid}`,
                push: false,
            });
            await createNotificationOnce(sql, {
                uid: auth.data.uid,
                title: 'Medication Reminder System Active',
                body: 'Automated reminders are enabled for your prescribed dosages.',
                type: 'reminder',
                actionUrl: NOTIFICATION_URLS.medications,
                eventKey: `reminder-system:${auth.data.uid}`,
                push: false,
            });
            notifications = await sql`
                SELECT * FROM notifications
                WHERE uid = ${auth.data.uid}
                ORDER BY created_at DESC
                LIMIT 50
            `;
        }

        // Enrich notifications: extract metadata object, ensure real doctor profile photo is resolved
        const enrichedNotifications = await Promise.all(
            (notifications || []).map(async (n: any) => {
                let meta = n.metadata;
                if (typeof meta === 'string') {
                    try { meta = JSON.parse(meta); } catch {}
                }
                if (typeof meta === 'string') {
                    try { meta = JSON.parse(meta); } catch {}
                }

                const appointmentId = meta?.appointment_id || meta?.aid || null;
                const appointmentRelated =
                    n.type === 'appointment' ||
                    ['appointment_status', 'appointment_cancelled', 'mode_change'].includes(String(n.type || '')) ||
                    /appointment|consultation|reschedul|cancel|confirm|visit mode|refund/i.test(
                        `${n.title || ''} ${n.body || ''}`
                    );

                let imageUrl = meta?.image_url || meta?.avatar_url || n.image_url || null;
                let doctorName = meta?.doctor_name || n.doctor_name || null;
                let did = meta?.did || null;

                try {
                    // 1. Resolve the exact appointment when the notification carries its id.
                    if (appointmentId) {
                        const [apt] = await sql`
                            SELECT a.did, u.name as doctor_name, u.profile_image_url
                            FROM appointments a
                            JOIN doctors d ON a.did = d.did
                            JOIN users u ON d.uid = u.uid
                            WHERE a.aid = ${appointmentId} AND a.pid = ${auth.data.pid}
                            LIMIT 1
                        `;
                        if (apt) {
                            imageUrl = apt.profile_image_url || imageUrl;
                            doctorName = doctorName || apt.doctor_name;
                            did = did || apt.did;
                        }
                    }

                    // 2. If did is known, get real profile image from database
                    if (did && (!imageUrl || !doctorName)) {
                        const [doc] = await sql`
                            SELECT u.name, u.profile_image_url
                            FROM doctors d
                            JOIN users u ON d.uid = u.uid
                            WHERE d.did = ${did}
                            LIMIT 1
                        `;
                        if (doc) {
                            imageUrl = imageUrl || doc.profile_image_url || null;
                            doctorName = doctorName || doc.name;
                        }
                    }

                    // 3. Try to match doctor from notification body text:
                    //    "with Dr. Ridhima Pandey" or "Dr. Ridhima Pandey has confirmed..."
                    if (appointmentRelated && (!imageUrl || !doctorName)) {
                        const body = String(n.body || '');
                        const match =
                            body.match(/(?:with|by)\s+(Dr\.?\s+[^.]+?)(?:\s+has|\s+on|\.|$)/i) ||
                            body.match(/(Dr\.?\s+[A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*){0,3})\s+(?:has|confirmed|started|cancelled|completed)/i);
                        if (match && match[1]) {
                            const searchedName = match[1].trim().replace(/^Dr\.?\s+/i, '');
                            const [matchedDoc] = await sql`
                                SELECT u.name, u.profile_image_url 
                                FROM users u 
                                JOIN doctors d ON d.uid = u.uid 
                                WHERE u.name ILIKE ${'%' + searchedName + '%'} 
                                LIMIT 1
                            `;
                            if (matchedDoc) {
                                imageUrl = imageUrl || matchedDoc.profile_image_url || null;
                                doctorName = doctorName || matchedDoc.name;
                            }
                        }
                    }

                    // 4. Fallback for appointment notifications: match latest appointment for this patient
                    if (appointmentRelated && !imageUrl) {
                        const [apt] = await sql`
                            SELECT u.name as doctor_name, u.profile_image_url 
                            FROM appointments a
                            JOIN doctors d ON a.did = d.did
                            JOIN users u ON d.uid = u.uid
                            WHERE a.pid = ${auth.data.pid}
                            ORDER BY a.created_at DESC
                            LIMIT 1
                        `;
                        if (apt) {
                            imageUrl = imageUrl || apt.profile_image_url || null;
                            doctorName = doctorName || apt.doctor_name;
                        }
                    }
                } catch (fallbackErr) {
                    console.error('Error resolving notification doctor image:', fallbackErr);
                }

                return {
                    ...n,
                    image_url: imageUrl,
                    avatar_url: imageUrl,
                    doctor_name: doctorName,
                };
            })
        );

        return NextResponse.json({
            success: true,
            notifications: enrichedNotifications || [],
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
    }
}
