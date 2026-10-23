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

        // Fetch doctor's user id/profile and patient's name/profile to generate rich notifications with profile images
        try {
            const [doctorUser] = await sql`
                SELECT d.uid, u.name, u.profile_image_url 
                FROM doctors d 
                JOIN users u ON d.uid = u.uid 
                WHERE d.did = ${did}
                LIMIT 1
            `;
            const [patientUser] = await sql`
                SELECT u.name, u.profile_image_url 
                FROM patients p 
                JOIN users u ON p.uid = u.uid 
                WHERE p.pid = ${identity.data.pid}
                LIMIT 1
            `;
            const patientName = patientUser?.name || 'A patient';
            const doctorName = doctorUser?.name ? `Dr. ${doctorUser.name.replace(/^Dr\.?\s+/i, '')}` : 'your doctor';
            const visitType = mode === 'online' ? 'Online Video Consultation' : 'In-Clinic Visit';

            const doctorProfileImg = doctorUser?.profile_image_url || null;
            const patientProfileImg = patientUser?.profile_image_url || null;

            // Notification for Patient (shows doctor's profile image and details)
            await sql`
                INSERT INTO notifications (uid, title, body, type, is_read, metadata)
                VALUES (
                    ${identity.data.uid},
                    'Appointment Booked',
                    ${`Your ${visitType} with ${doctorName} has been scheduled for ${scheduled_date} at ${scheduled_time}.`},
                    'appointment',
                    false,
                    ${JSON.stringify({
                        image_url: doctorProfileImg,
                        avatar_url: doctorProfileImg,
                        doctor_name: doctorName,
                        did: did,
                        appointment_id: appointment?.aid,
                    })}
                )
            `;

            // Notification for Doctor (shows patient's profile image and details)
            if (doctorUser?.uid) {
                await sql`
                    INSERT INTO notifications (uid, title, body, type, is_read, metadata)
                    VALUES (
                        ${doctorUser.uid},
                        'New Appointment Booked',
                        ${`${patientName} has booked a ${visitType} on ${scheduled_date} at ${scheduled_time}.`},
                        'appointment',
                        false,
                        ${JSON.stringify({
                            image_url: patientProfileImg,
                            avatar_url: patientProfileImg,
                            patient_name: patientName,
                            pid: identity.data.pid,
                            appointment_id: appointment?.aid,
                        })}
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
