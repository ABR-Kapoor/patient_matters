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
            SELECT * FROM notifications
            WHERE uid = ${auth.data.uid}
            ORDER BY created_at DESC
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

        return NextResponse.json({
            success: true,
            notifications: notifications || [],
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
    }
}
