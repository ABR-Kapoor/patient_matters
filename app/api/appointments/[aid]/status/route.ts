import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requirePatient, requireOwnAppointment } from '@/lib/authz';

export async function GET(
    request: NextRequest,
    { params }: { params: { aid: string } }
) {
    const identity = await requirePatient();
    if (!identity.ok) return identity.response;

    const owned = await requireOwnAppointment(identity.data, params.aid);
    if (!owned.ok) return owned.response;

    try {
        const { aid } = params;

        const [data] = await sql`
            SELECT status, call_started_at, call_ended_at
            FROM appointments WHERE aid = ${aid}
        `;

        if (!data) {
            return NextResponse.json(
                { success: false, error: 'Appointment not found' },
                { status: 404 }
            );
        }

        const responseData = {
            ...data,
            callStartedAt: data.callStartedAt || data.call_started_at,
            callEndedAt: data.callEndedAt || data.call_ended_at,
            call_started_at: data.call_started_at || data.callStartedAt,
            call_ended_at: data.call_ended_at || data.callEndedAt,
        };

        return NextResponse.json({ success: true, data: responseData });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
