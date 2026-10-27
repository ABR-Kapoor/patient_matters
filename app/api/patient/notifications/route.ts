import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requirePatient } from '@/lib/authz';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const auth = await requirePatient();
        if (!auth.ok) return auth.response;

        // Sync active and due medication doses into in-app notifications
        try {
            const todayStr = new Date().toISOString().split('T')[0];
            const dueDoses = await sql`
                SELECT ma.adherence_id, ma.medicine_name, ma.scheduled_time, ma.scheduled_date
                FROM medication_adherence ma
                WHERE ma.pid = ${auth.data.pid}
                  AND ma.scheduled_date = ${todayStr}
                  AND (ma.is_taken IS FALSE OR ma.is_taken IS NULL)
                  AND (ma.is_skipped IS FALSE OR ma.is_skipped IS NULL)
                ORDER BY ma.scheduled_time ASC
                LIMIT 5
            `;

            for (const dose of dueDoses) {
                const notifTitle = 'Medicine Reminder: ' + dose.medicine_name;
                const notifBody = 'Time to take your scheduled dose of ' + dose.medicine_name + ' (' + String(dose.scheduled_time).substring(0, 5) + ').';
                
                // Avoid inserting duplicates for the same medicine today
                const [existing] = await sql`
                    SELECT notification_id FROM notifications
                    WHERE uid = ${auth.data.uid}
                      AND title = ${notifTitle}
                      AND created_at::date = CURRENT_DATE
                    LIMIT 1
                `;

                if (!existing) {
                    await sql`
                        INSERT INTO notifications (uid, title, body, type, is_read)
                        VALUES (${auth.data.uid}, ${notifTitle}, ${notifBody}, 'medication_reminder', false)
                    `;
                }
            }
        } catch (doseErr) {
            console.error('Failed to sync medication dose notifications:', doseErr);
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
            // Seed initial notifications so the page shows real updates
            await sql`
                INSERT INTO notifications (uid, title, body, type, is_read)
                VALUES 
                    (${auth.data.uid}, 'Welcome to AuraSutra', 'Your healthcare account is active. You can browse doctors, book consultations, and view prescriptions anytime.', 'welcome', false),
                    (${auth.data.uid}, 'Medication Reminder System Active', 'Automated reminders are enabled for your prescribed dosages.', 'reminder', false)
            `;
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

                let imageUrl = meta?.image_url || meta?.avatar_url || n.image_url || null;
                let doctorName = meta?.doctor_name || n.doctor_name || null;
                let did = meta?.did || null;

                try {
                    // 1. If did is known, get real profile image from database
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

                    // 2. Try to match doctor from notification body text: e.g. "with Dr. Ridhima Pandey"
                    if (!imageUrl || !doctorName) {
                        const match = String(n.body || '').match(/with\s+(Dr\.?\s+[^.]+?)(?:\s+has|\s+on|\.|$)/i);
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

                    // 3. Fallback for appointment notifications: match latest appointment for this patient
                    if (!imageUrl && (n.type === 'appointment' || String(n.title).toLowerCase().includes('appointment'))) {
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
