import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { sendEmail } from '@/lib/shared/notifications/email';
import { generateAppointmentCancelledForDoctorEmail } from '@/lib/shared/notifications/templates';
import { requirePatient, requireOwnAppointment } from '@/lib/authz';

export async function PATCH(request: NextRequest, { params }: { params: { aid: string } }) {
    const identity = await requirePatient();
    if (!identity.ok) return identity.response;

    // Without this, any caller who learned an `aid` could cancel someone
    // else's appointment and trigger a doctor notification email.
    const owned = await requireOwnAppointment(identity.data, params.aid);
    if (!owned.ok) return owned.response;

    try {
        const { aid } = params;

        const [existing] = await sql`
            SELECT call_started_at, payment_status, did
            FROM appointments
            WHERE aid = ${aid}
        `;

        if (!existing) {
            return NextResponse.json({ success: false, error: 'Appointment not found' }, { status: 404 });
        }

        const endedAt = new Date().toISOString();
        let durationMinutes: number | null = null;

        if (existing.call_started_at) {
            const rawMinutes = (new Date(endedAt).getTime() - new Date(existing.call_started_at).getTime()) / 60000;
            // duration_minutes / call_duration_minutes are integer columns. A
            // fractional value ("5833.0329...") makes Postgres abort the whole
            // UPDATE with `invalid input syntax for type integer`, so the
            // cancellation never lands. A stale call_started_at can also be days
            // old, hence the 1440 (24h) clamp.
            durationMinutes = Math.min(1440, Math.max(0, Math.round(rawMinutes)));
        }

        const [data] = await sql`
            UPDATE appointments
            SET status = 'cancelled',
                cancelled_at = ${endedAt},
                cancelled_by = ${identity.data.pid},
                call_ended_at = ${endedAt},
                duration_minutes = COALESCE(${durationMinutes}, duration_minutes),
                call_duration_minutes = COALESCE(${durationMinutes}, call_duration_minutes)
            WHERE aid = ${aid}
            RETURNING *
        `;

        // Notify doctor if payment was already made
        const isPaid = data.payment_status === 'paid' || data.payment_status === 'completed';
        if (isPaid && existing.did) {
            try {
                const [doctorInfo] = await sql`
                    SELECT u.name, u.email FROM doctors d
                    JOIN users u ON d.uid = u.uid
                    WHERE d.did = ${existing.did}
                `;
                const [patientInfo] = await sql`
                    SELECT u.name FROM patients p
                    JOIN users u ON p.uid = u.uid
                    WHERE p.pid = ${data.pid}
                `;

                if (doctorInfo?.email) {
                    const html = generateAppointmentCancelledForDoctorEmail({
                        recipientName: doctorInfo.name || 'Doctor',
                        patientName: patientInfo?.name || 'Patient',
                        amount: 0,
                        reason: data.cancellation_reason || undefined,
                    });
                    await sendEmail({
                        to: doctorInfo.email,
                        subject: `Appointment Cancelled — No Payout`,
                        html,
                    });
                }
            } catch (emailErr) {
                console.error('Failed to send cancellation email to doctor:', emailErr);
            }
        }

        // In-app notifications for cancellation
        try {
            const [doctorUser] = await sql`
                SELECT d.uid, u.name, u.profile_image_url 
                FROM doctors d 
                JOIN users u ON d.uid = u.uid 
                WHERE d.did = ${data.did}
                LIMIT 1
            `;
            const [patientUser] = await sql`
                SELECT u.name, u.profile_image_url 
                FROM patients p 
                JOIN users u ON p.uid = u.uid 
                WHERE p.pid = ${data.pid}
                LIMIT 1
            `;
            const patientName = patientUser?.name || 'Patient';
            const doctorName = doctorUser?.name ? `Dr. ${doctorUser.name.replace(/^Dr\.?\s+/i, '')}` : 'your doctor';
            const doctorProfileImg = doctorUser?.profile_image_url || null;
            const patientProfileImg = patientUser?.profile_image_url || null;

            await sql`
                INSERT INTO notifications (uid, title, body, type, is_read, metadata)
                VALUES (
                    ${identity.data.uid},
                    'Appointment Cancelled',
                    ${`Your appointment with ${doctorName} has been cancelled successfully.`},
                    'appointment_cancelled',
                    false,
                    ${JSON.stringify({
                        image_url: doctorProfileImg,
                        avatar_url: doctorProfileImg,
                        doctor_name: doctorName,
                        did: data.did,
                    })}
                )
            `;

            if (doctorUser?.uid) {
                await sql`
                    INSERT INTO notifications (uid, title, body, type, is_read, metadata)
                    VALUES (
                        ${doctorUser.uid},
                        'Appointment Cancelled',
                        ${`Appointment with ${patientName} on ${data.scheduled_date} was cancelled.`},
                        'appointment_cancelled',
                        false,
                        ${JSON.stringify({
                            image_url: patientProfileImg,
                            avatar_url: patientProfileImg,
                            patient_name: patientName,
                            pid: data.pid,
                        })}
                    )
                `;
            }
        } catch (notifErr) {
            console.error('Failed to record cancellation notifications:', notifErr);
        }

        return NextResponse.json({ success: true, appointment: data, message: 'Appointment cancelled successfully' });
    } catch (error: any) {
        // Postgres messages ("invalid input syntax for type uuid: ...") are not
        // actionable for a patient and can leak schema detail, so log them
        // server-side and return a generic failure to the client.
        console.error('[patient/appointments cancel] failed:', error?.message, error?.code);

        const isBadInput = error?.code === '22P02' || error?.code === '22P04';
        return NextResponse.json(
            {
                success: false,
                error: isBadInput
                    ? 'That appointment could not be found.'
                    : 'Could not cancel the appointment. Please try again.',
            },
            { status: isBadInput ? 404 : 500 }
        );
    }
}
