import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requirePatient } from '@/lib/authz';

export async function POST(request: NextRequest) {
    const identity = await requirePatient();
    if (!identity.ok) return identity.response;

    try {
        const body = await request.json();
        const {
            did,
            scheduled_date,
            scheduled_time,
            mode,
            chief_complaint,
            symptoms = [],
            payment_id,
            payment_status = 'pending',
            consent_given_at,
            consent_ip,
        } = body;

        const missingFields = [];
        if (!did) missingFields.push('did');
        if (!scheduled_date) missingFields.push('scheduled_date');
        if (!scheduled_time) missingFields.push('scheduled_time');
        if (!mode) missingFields.push('mode');
        if (!chief_complaint) missingFields.push('chief_complaint');

        if (missingFields.length > 0) {
            return NextResponse.json({
                error: 'Missing required fields',
                missingFields,
            }, { status: 400 });
        }

        // Verify doctor exists
        const [doctorData] = await sql`SELECT did FROM doctors WHERE did = ${did}`;

        if (!doctorData) {
            return NextResponse.json({ error: 'Doctor not found' }, { status: 404 });
        }

        // Create appointment. `pid` comes from the session, never the body.
        const [appointment] = await sql`
            INSERT INTO appointments (pid, did, mode, status, scheduled_date, scheduled_time, chief_complaint, symptoms, payment_id, payment_status, consent_given_at, consent_ip)
            VALUES (${identity.data.pid}, ${did}, ${mode}, 'scheduled', ${scheduled_date}, ${scheduled_time}, ${chief_complaint}, ${symptoms.length > 0 ? symptoms : null}, ${payment_id || null}, ${payment_status}, ${consent_given_at || null}, ${consent_ip || null})
            RETURNING *
        `;

        // Fetch doctor's user id and patient's name to generate rich notifications
        try {
            const [doctorUser] = await sql`SELECT uid FROM doctors WHERE did = ${did}`;
            const [patientUser] = await sql`
                SELECT u.name FROM patients p 
                JOIN users u ON p.uid = u.uid 
                WHERE p.pid = ${identity.data.pid}
            `;
            const patientName = patientUser?.name || 'A patient';
            const visitType = mode === 'online' ? 'Online Video Consultation' : 'In-Clinic Visit';

            // Notification for Patient
            await sql`
                INSERT INTO notifications (uid, title, body, type, is_read)
                VALUES (
                    ${identity.data.uid},
                    'Appointment Booked',
                    ${`Your ${visitType} has been scheduled for ${scheduled_date} at ${scheduled_time}.`},
                    'appointment',
                    false
                )
            `;

            // Notification for Doctor
            if (doctorUser?.uid) {
                await sql`
                    INSERT INTO notifications (uid, title, body, type, is_read)
                    VALUES (
                        ${doctorUser.uid},
                        'New Appointment Booked',
                        ${`${patientName} has booked a ${visitType} on ${scheduled_date} at ${scheduled_time}.`},
                        'appointment',
                        false
                    )
                `;
            }
        } catch (notifErr) {
            console.error('Failed to dispatch in-app notifications:', notifErr);
        }

        return NextResponse.json({
            success: true,
            appointment,
            message: 'Appointment booked successfully!',
        });
    } catch (error: any) {
        console.error('Appointment creation error:', error);
        return NextResponse.json({ error: 'Failed to create appointment: ' + error.message, details: error }, { status: 500 });
    }
}
