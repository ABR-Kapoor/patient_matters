import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requirePatient } from '@/lib/authz';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    const auth = await requirePatient();
    if (!auth.ok) return auth.response;

    const pid = auth.data.pid;

    try {
        const body = await request.json();
        const { adherenceId, durationMinutes } = body;
        const adherence_id = adherenceId || body.adherence_id;
        const mins = Math.max(1, Math.min(1440, Number(durationMinutes) || 15));

        if (!adherence_id) {
            return NextResponse.json({ success: false, error: 'adherenceId is required' }, { status: 400 });
        }

        // Scoped by pid so an adherence_id from another patient is not addressable.
        const [record] = await sql`
            SELECT * FROM medication_adherence
            WHERE adherence_id = ${adherence_id} AND pid = ${pid}
        `;

        if (!record) {
            return NextResponse.json({ success: false, error: 'Adherence record not found' }, { status: 404 });
        }

        if (record.is_taken || record.is_skipped) {
            return NextResponse.json(
                { success: false, error: 'Cannot snooze an already completed dose' },
                { status: 400 }
            );
        }

        const intervalStr = `${mins} minutes`;

        const [data] = await sql`
            UPDATE medication_adherence
            SET snooze_count = COALESCE(snooze_count, 0) + 1,
                reminder_snoozed_until = CURRENT_TIMESTAMP + ${intervalStr}::interval,
                snooze_until = CURRENT_TIMESTAMP + ${intervalStr}::interval,
                status = 'pending',
                updated_at = CURRENT_TIMESTAMP
            WHERE adherence_id = ${adherence_id} AND pid = ${pid}
            RETURNING adherence_id, pid, medicine_name, scheduled_date::text as scheduled_date, scheduled_time,
                      is_taken, is_skipped, reminder_snoozed_until, snooze_until, snooze_count, status, updated_at
        `;

        try {
            await sql`REFRESH MATERIALIZED VIEW adherence_progress_summary`;
        } catch (err) {
            console.error('[API] Failed to refresh materialized view:', err);
        }

        return NextResponse.json({
            success: true,
            adherence: data,
            snoozed_until: data.reminder_snoozed_until,
            durationMinutes: mins,
            message: `Reminder snoozed for ${mins} minutes`
        });
    } catch (error: any) {
        console.error('[API] Snooze error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
    }
}
