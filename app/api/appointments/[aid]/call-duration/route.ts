import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requirePatient, requireOwnAppointment } from '@/lib/authz';

export async function PATCH(
    request: NextRequest,
    { params }: { params: { aid: string } }
) {
    const identity = await requirePatient();
    if (!identity.ok) return identity.response;

    // Duration writes are scoped to the caller's own appointment.
    const owned = await requireOwnAppointment(identity.data, params.aid);
    if (!owned.ok) return owned.response;

    try {
        const { aid } = params;
        const body = await request.json();
        const { start_time, end_time, duration_minutes } = body;

        if (!end_time && duration_minutes === undefined) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const [existing] = await sql`
            SELECT call_started_at, call_ended_at, call_duration_minutes
            FROM appointments
            WHERE aid = ${aid}
        `;

        if (!existing) {
            return NextResponse.json(
                { success: false, error: 'Appointment not found' },
                { status: 404 }
            );
        }

        const callStartedAt = existing.callStartedAt || existing.call_started_at;
        const callEndedAt = existing.callEndedAt || existing.call_ended_at;
        const callDurationMinutes = existing.callDurationMinutes || existing.call_duration_minutes;

        const effectiveStart = callStartedAt || start_time || new Date().toISOString();
        const effectiveEnd = callEndedAt || end_time || new Date().toISOString();

        const parsedDuration = duration_minutes !== undefined ? Number(duration_minutes) : NaN;
        const rawMinutes = Number.isFinite(parsedDuration)
            ? parsedDuration
            : Math.max(
                  0,
                  (new Date(effectiveEnd).getTime() - new Date(effectiveStart).getTime()) / 60000
              );
        // Both duration columns are integer; a fractional value aborts the whole update.
        const computedDuration = Math.min(1440, Math.max(0, Math.round(rawMinutes)));

        // Duration only. Completing the visit is the doctor's decision, made via
        // PATCH /api/doctor/appointments, so hanging up never advances the status and
        // status is deliberately left untouched here.

        const [data] = await sql`
            UPDATE appointments
            SET call_started_at       = COALESCE(call_started_at, ${effectiveStart}),
                call_ended_at         = ${effectiveEnd},
                call_duration_minutes = ${computedDuration},
                duration_minutes      = ${computedDuration}
            WHERE aid = ${aid} AND pid = ${identity.data.pid}
            RETURNING *
        `;

        console.log(`[PATIENT API] call-duration saved — aid: ${aid}, start: ${effectiveStart}, end: ${effectiveEnd}, call_duration_minutes: ${computedDuration}`);

        return NextResponse.json({
            success: true,
            data,
            message: 'Call duration updated successfully',
        });
    } catch (error: any) {
        console.error('[API] Call duration update error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
