import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requirePatient, requireOwnAppointment } from '@/lib/authz';

export async function POST(
    request: NextRequest,
    { params }: { params: { aid: string } }
) {
    const identity = await requirePatient();
    if (!identity.ok) return identity.response;

    // Recording consent is a legal assertion about a specific call. It must be
    // tied to the caller's own appointment.
    const owned = await requireOwnAppointment(identity.data, params.aid);
    if (!owned.ok) return owned.response;

    try {
        const { aid } = params;
        const body = await request.json();
        const { consent_ip } = body;

        const [data] = await sql`
            UPDATE appointments
            SET consent_given_at = NOW(),
                consent_ip = ${consent_ip || ''}
            WHERE aid = ${aid} AND pid = ${identity.data.pid}
            RETURNING aid, consent_given_at, consent_ip
        `;

        if (!data) {
            return NextResponse.json(
                { success: false, error: 'Appointment not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error('[API] Consent update error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
