import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/shared/notifications/email';
import { generateAppointmentCreatedEmail, generatePrescriptionCreatedEmail, generatePaymentReceiptEmail } from '@/lib/shared/notifications/templates';
import { formatDate } from '@/lib/formatDate';
import sql from '@/lib/db';
import { requireSessionUser, maskAccountNumber } from '@/lib/authz';
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
