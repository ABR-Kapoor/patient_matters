import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/shared/notifications/email';
import { generateAppointmentCreatedEmail, generatePrescriptionCreatedEmail, generatePaymentReceiptEmail } from '@/lib/shared/notifications/templates';
import { formatDate } from '@/lib/formatDate';
import sql from '@/lib/db';
import { requireSessionUser, maskAccountNumber } from '@/lib/authz';
import { notifyOnce, NOTIFICATION_URLS } from '@/lib/shared/notifications/inApp';
import { timingSafeEqual } from 'crypto';

export const dynamic = 'force-dynamic';

const ADMIN_NOTIFICATION_EMAILS = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim())
    .filter(Boolean);

/**
 * This endpoint previously had no authentication at all and accepted arbitrary
 * `patientId`/`doctorId` values, so anyone could trigger appointment,
 * prescription and payment emails — including doctor bank details — to be sent
 * to a hardcoded list of personal Gmail addresses.
 *
 * Two callers are legitimate:
 *   1. The patient/doctor apps, with a Clerk session (bearer or cookie).
 *   2. doctor_view server-to-server, which has no user session. That path
 *      requires the shared INTERNAL_SERVICE_SECRET.
 */
async function authorize(request: NextRequest) {
    const provided = request.headers.get('x-service-secret');
    const expected = process.env.INTERNAL_SERVICE_SECRET;

    if (provided && expected) {
        const a = Buffer.from(provided);
        const b = Buffer.from(expected);
        if (a.length === b.length && timingSafeEqual(a, b)) {
            return { ok: true as const, mode: 'service' as const };
        }
        return {
            ok: false as const,
            response: NextResponse.json({ success: false, error: 'Invalid service secret' }, { status: 401 }),
        };
    }

    const session = await requireSessionUser();
    if (!session.ok) return session;

    return {
        ok: true as const,
        mode: 'session' as const,
        role: session.data.role,
        uid: session.data.uid,
    };
}

/**
 * Confirms the caller is actually a party to the notification being sent.
 * A patient may only raise notifications naming their own `patientId`; a doctor
 * only those naming their own `doctorId`.
 */
async function assertParty(caller: { role: string; uid: string }, data: any) {
    if (caller.role === 'patient') {
        if (!data?.patientId) return;
        const [row] = await sql`SELECT pid FROM patients WHERE uid = ${caller.uid} LIMIT 1`;
        if (!row || row.pid !== data.patientId) {
            return { ok: false as const, response: NextResponse.json({ success: false, error: 'Not your patient record' }, { status: 403 }) };
        }
        return;
    }

    if (caller.role === 'doctor') {
        if (!data?.doctorId) return;
        const [row] = await sql`SELECT did FROM doctors WHERE uid = ${caller.uid} LIMIT 1`;
        if (!row || row.did !== data.doctorId) {
            return { ok: false as const, response: NextResponse.json({ success: false, error: 'Not your doctor record' }, { status: 403 }) };
        }
    }
}

async function getPatientWithUser(patientId: string) {
    const [result] = await sql`
        SELECT p.*, u.uid as user_uid, u.name, u.email, u.profile_image_url
        FROM patients p
        JOIN users u ON p.uid = u.uid
        WHERE p.pid = ${patientId}
    `;
    if (!result) return null;
    return { ...result, user: { uid: result.user_uid, name: result.name, email: result.email, profileImageUrl: result.profile_image_url } };
}

async function getDoctorWithUser(doctorId: string): Promise<any> {
    const [result] = await sql`
        SELECT d.*,
               u.uid as user_uid, u.name, u.email, u.profile_image_url,
               d.bank_account_holder_name, d.bank_account_number, d.bank_ifsc_code, d.bank_name, d.payout_upi_id
        FROM doctors d
        JOIN users u ON d.uid = u.uid
        WHERE d.did = ${doctorId}
    `;
    if (!result) return null;
    return { ...result, user: { uid: result.user_uid, name: result.name, email: result.email, profileImageUrl: result.profile_image_url } };
}

async function notifyAdmins(subject: string, html: string) {
    if (ADMIN_NOTIFICATION_EMAILS.length === 0) {
        console.warn('[notifications/send] ADMIN_EMAILS is not set; admin notification skipped');
        return [];
    }
    return Promise.all(
        ADMIN_NOTIFICATION_EMAILS.map((email) => sendEmail({ to: email, subject, html }))
    );
}

export async function POST(request: NextRequest) {
    const auth = await authorize(request);
    if (!auth.ok) return auth.response;

    try {
        const body = await request.json();
        const { type, data } = body;

        if (!type || !data) {
            return NextResponse.json(
                { success: false, error: 'Missing type or data' },
                { status: 400 }
            );
        }

        if (auth.mode === 'session') {
            const party = await assertParty({ role: auth.role, uid: auth.uid }, data);
            if (party && !party.ok) return party.response;
        }

        let results: any[] = [];

        if (type === 'appointment_created') {
            const {
                patientId, doctorId, appointmentDate, appointmentTime,
                mode, chiefComplaint, meetingLink, tokenNumber,
            } = data;

            const patient = await getPatientWithUser(patientId);
            const doctor = await getDoctorWithUser(doctorId);

            if (!patient?.user || !doctor?.user) {
                return NextResponse.json(
                    { success: false, error: 'Patient or doctor not found' },
                    { status: 404 }
                );
            }

            const patientEmailHtml = generateAppointmentCreatedEmail({
                recipientName: patient.user.name, recipientType: 'patient',
                patientName: patient.user.name, doctorName: doctor.user.name,
                appointmentDate, appointmentTime, mode, chiefComplaint, meetingLink, tokenNumber,
            });

            const doctorEmailHtml = generateAppointmentCreatedEmail({
                recipientName: doctor.user.name, recipientType: 'doctor',
                patientName: patient.user.name, doctorName: doctor.user.name,
                appointmentDate, appointmentTime, mode, chiefComplaint, meetingLink, tokenNumber,
            });

            const adminEmailHtml = generateAppointmentCreatedEmail({
                recipientName: 'Admin Team', recipientType: 'admin',
                patientName: patient.user.name, doctorName: doctor.user.name,
                appointmentDate, appointmentTime, mode, chiefComplaint, meetingLink, tokenNumber,
                doctorBankDetails: {
                    accountName: doctor.bank_account_holder_name,
                    accountNumber: maskAccountNumber(doctor.bank_account_number),
                    ifscCode: doctor.bank_ifsc_code,
                    bankName: doctor.bank_name,
                    upiId: doctor.payout_upi_id
                }
            });

            if (!patient.user.email || !doctor.user.email) {
                return NextResponse.json({ success: false, error: 'Patient or doctor email not found' }, { status: 400 });
            }

            // Send to both parties simultaneously
            const [patientEmailResult, doctorEmailResult] = await Promise.all([
                sendEmail({ to: patient.user.email, subject: 'Appointment Confirmed - AuraSutra', html: patientEmailHtml }),
                sendEmail({ to: doctor.user.email, subject: 'New Appointment Scheduled - AuraSutra', html: doctorEmailHtml }),
            ]);

            const adminEmailResults = await notifyAdmins(
                `Admin Alert: Appointment Booked for ${doctor.user.name} - AuraSutra`,
                adminEmailHtml
            );

            results.push(
                { recipient: 'patient', email: patient.user.email, ...patientEmailResult },
                { recipient: 'doctor', email: doctor.user.email, ...doctorEmailResult },
                ...ADMIN_NOTIFICATION_EMAILS.map((email, index) => ({
                    recipient: 'admin',
                    email,
                    ...adminEmailResults[index],
                })),
            );
        }

        else if (type === 'prescription_created') {
            const { patientId, doctorId, diagnosis, medicines, instructions } = data;

            const patient = await getPatientWithUser(patientId);
            const doctor = await getDoctorWithUser(doctorId);

            if (!patient?.user || !doctor?.user) {
                return NextResponse.json(
                    { success: false, error: 'Patient or doctor not found' },
                    { status: 404 }
                );
            }

            const dashboardLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/prescriptions`;

            const patientEmailHtml = generatePrescriptionCreatedEmail({
                recipientName: patient.user.name, recipientType: 'patient',
                patientName: patient.user.name, doctorName: doctor.user.name,
                diagnosis, medicines, instructions, dashboardLink,
            });
            const patientEmailResult = await sendEmail({ to: patient.user.email, subject: `New Prescription from ${doctor.user.name} - AuraSutra`, html: patientEmailHtml });
            results.push({ recipient: 'patient', email: patient.user.email, ...patientEmailResult });

            const doctorEmailHtml = generatePrescriptionCreatedEmail({
                recipientName: doctor.user.name, recipientType: 'doctor',
                patientName: patient.user.name, doctorName: doctor.user.name,
                diagnosis, medicines, instructions,
                dashboardLink: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/dashboard/prescriptions`,
            });
            const doctorEmailResult = await sendEmail({ to: doctor.user.email, subject: `Prescription Created for ${patient.user.name} - AuraSutra`, html: doctorEmailHtml });
            results.push({ recipient: 'doctor', email: doctor.user.email, ...doctorEmailResult });

            try {
                const [prescription] = await sql`
                    SELECT prescription_id
                    FROM prescriptions
                    WHERE pid = ${patientId}
                      AND did = ${doctorId}
                      AND sent_to_patient = true
                    ORDER BY COALESCE(sent_at, created_at) DESC
                    LIMIT 1
                `;
                if (prescription?.prescription_id) {
                    const doctorName = `Dr. ${String(doctor.user.name || 'Doctor').replace(/^Dr\.?\s+/i, '')}`;
                    await notifyOnce({
                        uid: patient.user.uid,
                        title: `New Prescription from ${doctorName}`,
                        body: `Your prescription for ${diagnosis || 'your consultation'} is ready.`,
                        type: 'prescription',
                        actionUrl: NOTIFICATION_URLS.prescriptions,
                        eventKey: `prescription:${prescription.prescription_id}:sent`,
                        metadata: {
                            prescription_id: prescription.prescription_id,
                            doctor_name: doctorName,
                            image_url: doctor.user.profileImageUrl || null,
                            avatar_url: doctor.user.profileImageUrl || null,
                        },
                    });
                }
            } catch (notifErr) {
                console.error('Prescription in-app notification failed:', notifErr);
            }
        }

        else if (type === 'payment_completed') {
            const { patientId, doctorId, transactionId, paymentMethod, appointmentDate, appointmentTime, mode, platformFee } = data;
            // amount may arrive as a string from DB (numeric type) — coerce to number
            const amount = Number(data.amount);
            const platformFeeAmount = Number(platformFee || 0);

            const patient = await getPatientWithUser(patientId);
            const doctor = await getDoctorWithUser(doctorId);

            if (!patient?.user || !doctor?.user) {
                return NextResponse.json(
                    { success: false, error: 'Patient or doctor not found' },
                    { status: 404 }
                );
            }

            const paymentDate = `${formatDate(new Date())} at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;

            const patientEmailHtml = generatePaymentReceiptEmail({
                recipientName: patient.user.name, recipientType: 'patient',
                patientName: patient.user.name, doctorName: doctor.user.name,
                amount, transactionId, paymentMethod, appointmentDate, appointmentTime, mode, paymentDate,
            });

            const doctorEmailHtml = generatePaymentReceiptEmail({
                recipientName: doctor.user.name, recipientType: 'doctor',
                patientName: patient.user.name, doctorName: doctor.user.name,
                amount, transactionId, paymentMethod, appointmentDate, appointmentTime, mode, paymentDate,
            });

            const adminEmailHtml = generatePaymentReceiptEmail({
                recipientName: 'Admin Team', recipientType: 'admin',
                patientName: patient.user.name, doctorName: doctor.user.name,
                amount, transactionId, paymentMethod, appointmentDate, appointmentTime, mode, paymentDate,
                platformFeeAmount,
                doctorBankDetails: {
                    accountName: doctor.bank_account_holder_name,
                    accountNumber: maskAccountNumber(doctor.bank_account_number),
                    ifscCode: doctor.bank_ifsc_code,
                    bankName: doctor.bank_name,
                    upiId: doctor.payout_upi_id
                }
            });

            // Send to both parties simultaneously
            const [patientEmailResult, doctorEmailResult] = await Promise.all([
                sendEmail({ to: patient.user.email, subject: 'Payment Receipt - AuraSutra', html: patientEmailHtml }),
                sendEmail({ to: doctor.user.email, subject: `Payment Received from ${patient.user.name} - AuraSutra`, html: doctorEmailHtml }),
            ]);

            const adminEmailResults = await notifyAdmins(
                `Admin Alert: Payment Collected for ${doctor.user.name} - AuraSutra`,
                adminEmailHtml
            );

            results.push(
                { recipient: 'patient', email: patient.user.email, ...patientEmailResult },
                { recipient: 'doctor', email: doctor.user.email, ...doctorEmailResult },
                ...ADMIN_NOTIFICATION_EMAILS.map((email, index) => ({
                    recipient: 'admin',
                    email,
                    ...adminEmailResults[index],
                })),
            );

            if (transactionId) {
                try {
                    const doctorName = `Dr. ${String(doctor.user.name || 'Doctor').replace(/^Dr\.?\s+/i, '')}`;
                    await notifyOnce({
                        uid: patient.user.uid,
                        title: 'Payment Successful',
                        body: `INR ${Number(amount || 0).toFixed(2)} paid for your consultation with ${doctorName}.`,
                        type: 'payment',
                        actionUrl: NOTIFICATION_URLS.appointments,
                        eventKey: `payment:${transactionId}:paid`,
                        metadata: {
                            razorpay_payment_id: transactionId,
                            doctor_name: doctorName,
                            image_url: doctor.user.profileImageUrl || null,
                            avatar_url: doctor.user.profileImageUrl || null,
                        },
                    });
                } catch (notifErr) {
                    console.error('Payment in-app notification failed:', notifErr);
                }
            }
        }

        else if (type === 'appointment_status') {
            const { appointmentId, status, mode, doctorId, updatedAt } = data;

            if (!appointmentId) {
                return NextResponse.json({ success: false, error: 'appointmentId is required' }, { status: 400 });
            }
            if (!status && !mode) {
                return NextResponse.json({ success: false, error: 'status or mode is required' }, { status: 400 });
            }

            const [appointment] = await sql`
                SELECT
                    a.aid, a.did, a.pid, a.status, a.mode, a.scheduled_date, a.scheduled_time,
                    p.uid AS patient_uid,
                    pu.name AS patient_name,
                    pu.profile_image_url AS patient_image,
                    du.name AS doctor_name,
                    du.profile_image_url AS doctor_image
                FROM appointments a
                JOIN patients p ON a.pid = p.pid
                JOIN users pu ON p.uid = pu.uid
                JOIN doctors d ON a.did = d.did
                JOIN users du ON d.uid = du.uid
                WHERE a.aid = ${appointmentId}
                LIMIT 1
            `;

            if (!appointment) {
                return NextResponse.json({ success: false, error: 'Appointment not found' }, { status: 404 });
            }

            // Service callers are already trusted. A user session may only trigger
            // status notifications for an appointment they are actually part of.
            if (auth.mode === 'session') {
                if (auth.role === 'doctor') {
                    const [row] = await sql`SELECT did FROM doctors WHERE uid = ${auth.uid} LIMIT 1`;
                    if (!row || row.did !== appointment.did) {
                        return NextResponse.json({ success: false, error: 'Not your appointment' }, { status: 403 });
                    }
                } else if (auth.role === 'patient') {
                    const [row] = await sql`SELECT pid FROM patients WHERE uid = ${auth.uid} LIMIT 1`;
                    if (!row || row.pid !== appointment.pid) {
                        return NextResponse.json({ success: false, error: 'Not your appointment' }, { status: 403 });
                    }
                } else {
                    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
                }
            }

            if (doctorId && appointment.did !== doctorId) {
                return NextResponse.json({ success: false, error: 'Appointment does not belong to this doctor' }, { status: 403 });
            }

            const displayDoctorName = `Dr. ${String(appointment.doctor_name || 'Doctor').replace(/^Dr\.?\s+/i, '')}`;
            const patientName = appointment.patient_name || 'Patient';
            const appointmentWhen = `${String(appointment.scheduled_date).slice(0, 10)} at ${String(appointment.scheduled_time || '').slice(0, 5)}`;
            const doctorImage = appointment.doctor_image || null;
            const patientImage = appointment.patient_image || null;
            const modeLabel = mode === 'online' ? 'Online Video Consultation' : 'In-Clinic Visit';
            const updatedAtMs = updatedAt && !Number.isNaN(new Date(updatedAt).getTime())
                ? new Date(updatedAt).getTime()
                : Date.now();

            let patientTitle = '';
            let patientBody = '';
            let doctorTitle = '';
            let doctorBody = '';

            if (status === 'confirmed') {
                patientTitle = 'Appointment Confirmed';
                patientBody = `${displayDoctorName} has confirmed your consultation for ${appointmentWhen}.`;
                doctorTitle = 'Appointment Confirmed';
                doctorBody = `You confirmed the appointment with ${patientName}.`;
            } else if (status === 'in_progress') {
                patientTitle = 'Consultation Started';
                patientBody = `${displayDoctorName} has started your consultation session.`;
                doctorTitle = 'Consultation In Progress';
                doctorBody = `Consultation with ${patientName} is currently in progress.`;
            } else if (status === 'completed') {
                patientTitle = 'Consultation Completed';
                patientBody = `Your consultation with ${displayDoctorName} has been marked as completed.`;
                doctorTitle = 'Consultation Completed';
                doctorBody = `You marked the consultation with ${patientName} as completed.`;
            } else if (status === 'cancelled') {
                patientTitle = 'Appointment Cancelled';
                patientBody = `${displayDoctorName} cancelled the appointment on ${String(appointment.scheduled_date).slice(0, 10)}. A full refund will be processed.`;
                doctorTitle = 'Appointment Cancelled';
                doctorBody = `You cancelled the appointment with ${patientName}.`;
            } else if (status === 'rescheduled') {
                patientTitle = 'Appointment Rescheduled';
                patientBody = `Your appointment with ${displayDoctorName} is now scheduled for ${appointmentWhen}.`;
                doctorTitle = 'Appointment Rescheduled';
                doctorBody = `The appointment with ${patientName} is now scheduled for ${appointmentWhen}.`;
            } else if (mode) {
                patientTitle = 'Visit Mode Updated';
                patientBody = `Your appointment mode has been changed to ${modeLabel}.`;
                doctorTitle = 'Visit Mode Updated';
                doctorBody = `Appointment mode with ${patientName} was changed to ${modeLabel}.`;
            }

            if (!patientTitle || !doctorTitle) {
                return NextResponse.json({ success: true, skipped: true, results: [] });
            }

            const patientEventKey = mode && !status
                ? `appointment:${appointmentId}:mode:${mode}:${updatedAtMs}`
                : `appointment:${appointmentId}:${status}`;
            const doctorEventKey = mode && !status
                ? `doctor:appointment:${appointmentId}:mode:${mode}:${updatedAtMs}`
                : `doctor:appointment:${appointmentId}:${status}`;

            const patientNotification = await notifyOnce({
                uid: appointment.patient_uid,
                title: patientTitle,
                body: patientBody,
                type: 'appointment',
                actionUrl: NOTIFICATION_URLS.appointments,
                eventKey: patientEventKey,
                metadata: {
                    appointment_id: appointmentId,
                    aid: appointmentId,
                    did: appointment.did,
                    doctor_name: displayDoctorName,
                    image_url: doctorImage,
                    avatar_url: doctorImage,
                    ...(mode ? { mode } : {}),
                    ...(status ? { status } : {}),
                },
            });

            // The doctor-side notification uses the doctor's user id, which is not
            // exposed in the appointment query above. Fetch it from the doctor row.
            const [doctorUser] = await sql`
                SELECT d.uid AS doctor_uid
                FROM doctors d
                WHERE d.did = ${appointment.did}
                LIMIT 1
            `;

            const doctorResult = doctorUser?.doctor_uid
                ? await notifyOnce({
                    uid: doctorUser.doctor_uid,
                    title: doctorTitle,
                    body: doctorBody,
                    type: 'appointment',
                    actionUrl: NOTIFICATION_URLS.appointments,
                    eventKey: doctorEventKey,
                    pushChannelId: 'doctor-updates',
                    metadata: {
                        appointment_id: appointmentId,
                        aid: appointmentId,
                        did: appointment.did,
                        pid: appointment.pid,
                        patient_name: patientName,
                        image_url: patientImage,
                        avatar_url: patientImage,
                        ...(mode ? { mode } : {}),
                        ...(status ? { status } : {}),
                    },
                })
                : null;

            results.push(
                { recipient: 'patient', ...patientNotification },
                { recipient: 'doctor', ...doctorResult },
            );
            return NextResponse.json({ success: true, results });
        }

        else {
            return NextResponse.json({ success: false, error: 'Invalid notification type' }, { status: 400 });
        }

        const allSuccess = results.every(r => r.success);
        return NextResponse.json({
            success: allSuccess,
            results,
            message: allSuccess ? 'All notifications sent successfully' : 'Some notifications failed',
        });

    } catch (error: any) {
        console.error('Notification error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to send notifications' },
            { status: 500 }
        );
    }
}
