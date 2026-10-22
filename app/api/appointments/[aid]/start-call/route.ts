import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requirePatient, requireOwnAppointment, isJoinableStatus } from '@/lib/authz';

export async function POST(request: NextRequest, { params }: { params: { aid: string } }) {
    const identity = await requirePatient();
    if (!identity.ok) return identity.response;

    const owned = await requireOwnAppointment(identity.data, params.aid);
    if (!owned.ok) return owned.response;

    try {
        const { aid } = params;

        const [appointment] = await sql`SELECT call_started_at, status FROM appointments WHERE aid = ${aid}`;

        if (!appointment) {
            return NextResponse.json({ success: false, error: 'Appointment not found' }, { status: 404 });
        }

        // The doctor must confirm first. Previously this only rejected
        // `cancelled`/`completed`, so a `scheduled` appointment could be moved
        // straight to `in_progress` by either party.
        if (!isJoinableStatus(appointment.status)) {
            return NextResponse.json({
                success: false,
                error: `Cannot start call for ${appointment.status} appointment`,
            }, { status: 409 });
        }

        if (appointment?.call_started_at) {
            return NextResponse.json({ success: true, message: 'Call already started', data: appointment });
        }

        const [data] = await sql`
            UPDATE appointments
            SET call_started_at = ${new Date().toISOString()},
                call_ended_at = NULL,
                status = 'in_progress'
            WHERE aid = ${aid} AND pid = ${identity.data.pid}
            RETURNING *
        `;

        return NextResponse.json({ success: true, data, message: 'Call started successfully' });
    } catch (error: any) {
        console.error('[API] Start call error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
