import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { sendEmail } from '@/lib/shared/notifications/email';
import { generateRefundRequestForAdminEmail, generateRefundRequestForDoctorEmail, generateRefundRequestForPatientEmail } from '@/lib/shared/notifications/templates';
import { requirePatient, requireOwnAppointment } from '@/lib/authz';

export async function POST(request: NextRequest, { params }: { params: { aid: string } }) {
  const identity = await requirePatient();
  if (!identity.ok) return identity.response;

  // A refund is a financial action on a real charge. It must be scoped to the
  // signed-in patient's own appointment, otherwise anyone can file refunds
  // against any `aid` they learn.
  const owned = await requireOwnAppointment(identity.data, params.aid);
  if (!owned.ok) return owned.response;

  try {
    const { aid } = params;
    const body = await request.json();
    const { reason } = body;

    if (!reason || !reason.trim()) {
      return NextResponse.json({ success: false, error: 'Reason required' }, { status: 400 });
    }

    const [apt] = await sql`
      SELECT a.*, d.consultation_fee, d.did as doctor_did
      FROM appointments a
      JOIN doctors d ON a.did = d.did
      WHERE a.aid = ${aid}
    `;

    if (!apt) {
      return NextResponse.json({ success: false, error: 'Appointment not found' }, { status: 404 });
    }

    if (apt.payment_status !== 'completed' && apt.payment_status !== 'paid') {
      return NextResponse.json({ success: false, error: 'No payment found for this appointment' }, { status: 400 });
    }

    const [existingRefund] = await sql`
      SELECT refund_id FROM refund_requests WHERE aid = ${aid}
    `;

    if (existingRefund) {
      return NextResponse.json({ success: false, error: 'Refund request already exists' }, { status: 400 });
    }

    // Get actual paid amount from finance_transactions (most accurate source of truth)
    const [tx] = await sql`
      SELECT amount, platform_fee_applied, razorpay_payment_id FROM finance_transactions
      WHERE aid = ${aid} AND transaction_type = 'consultation' AND status = 'paid'
      ORDER BY created_at DESC LIMIT 1
    `;

    const consultationFee = Number(apt.consultation_fee || 0);
    const platformFee = tx ? Number(tx.platform_fee_applied || 20) : 20;
    let refundAmount = tx ? Number(tx.amount) : consultationFee + platformFee;

    let refundType = 'full';
    if (apt.status === 'cancelled') {
      const scheduledTime = new Date(apt.scheduled_date);
      if (apt.scheduled_time) {
        const timeStr = String(apt.scheduled_time);
        const [time, period] = timeStr.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
        scheduledTime.setHours(hours, minutes, 0, 0);
      }

      const cancelledAt = apt.cancelled_at ? new Date(apt.cancelled_at) : new Date();
      const hoursDifference = (scheduledTime.getTime() - cancelledAt.getTime()) / (1000 * 60 * 60);

      if (hoursDifference < 2 && hoursDifference >= 0) {
        refundAmount = refundAmount / 2;
        refundType = 'partial';
      }
    }

    const [refundRequest] = await sql`
      INSERT INTO refund_requests (aid, pid, did, razorpay_payment_id, amount, refund_type, reason, status)
      VALUES (${aid}, ${apt.pid}, ${apt.doctor_did}, ${tx?.razorpay_payment_id || null}, ${refundAmount}, ${refundType}, ${reason.trim()}, 'pending')
      RETURNING *
    `;

    try {
      const [patientData] = await sql`
        SELECT u.name, u.email FROM patients p
        JOIN users u ON p.uid = u.uid
        WHERE p.pid = ${apt.pid}
      `;

      const [doctorData] = await sql`
        SELECT u.name, u.email FROM doctors d
        JOIN users u ON d.uid = u.uid
        WHERE d.did = ${apt.doctor_did}
      `;

      const adminHtml = generateRefundRequestForAdminEmail({
        recipientName: 'Admin Team',
        patientName: patientData?.name || 'Unknown',
        patientEmail: patientData?.email || '',
        doctorName: doctorData?.name || 'Unknown',
        amount: refundAmount,
        refundId: refundRequest.refund_id,
        reason: reason.trim(),
        status: 'pending',
      });

      // Notify admins listed in ADMIN_EMAILS. Previously this was a hardcoded
      // list of four personal Gmail addresses baked into the source.
      const adminEmails = (process.env.ADMIN_EMAILS || '')
        .split(',')
        .map(e => e.trim())
        .filter(Boolean);

      if (adminEmails.length > 0) {
        await Promise.all(
          adminEmails.map((email) =>
            sendEmail({
              to: email,
              subject: `[Refund Request] ${patientData?.name || 'Patient'} → ₹${refundAmount.toFixed(2)} | Reason: ${reason.trim().slice(0, 60)}`,
              html: adminHtml,
            })
          )
        );
      } else {
        console.warn('[refund] ADMIN_EMAILS is not set; admin notification skipped');
      }

      // Notify the doctor — they need to see the reason too
      if (doctorData?.email) {
        const doctorHtml = generateRefundRequestForDoctorEmail({
          recipientName: doctorData.name || 'Doctor',
          patientName: patientData?.name || 'Unknown',
          amount: refundAmount,
          reason: reason.trim(),
        });

        await sendEmail({
          to: doctorData.email,
          subject: `[Refund Requested] Patient ${patientData?.name || ''} has requested a refund — ₹${refundAmount.toFixed(2)}`,
          html: doctorHtml,
        });
      }

      // Notify the patient
      if (patientData?.email) {
        const patientHtml = generateRefundRequestForPatientEmail({
          recipientName: patientData.name || 'Patient',
          patientName: patientData.name || 'Unknown',
          doctorName: doctorData?.name || 'Doctor',
          amount: refundAmount,
          reason: reason.trim(),
        });

        await sendEmail({
          to: patientData.email,
          subject: `Refund request received — ₹${refundAmount.toFixed(2)}`,
          html: patientHtml,
        });
        // In-app notifications for refund request
        try {
          const [docRow] = await sql`SELECT uid FROM doctors WHERE did = ${apt.doctor_did}`;
          await sql`
            INSERT INTO notifications (uid, title, body, type, is_read)
            VALUES (
              ${identity.data.uid},
              'Refund Request Submitted',
              ${`Your refund request of ₹${refundAmount.toFixed(2)} has been submitted for review.`},
              'refund',
              false
            )
          `;

          if (docRow?.uid) {
            await sql`
              INSERT INTO notifications (uid, title, body, type, is_read)
              VALUES (
                ${docRow.uid},
                'Refund Requested by Patient',
                ${`${patientData?.name || 'A patient'} requested a refund of ₹${refundAmount.toFixed(2)}.`},
                'refund',
                false
              )
            `;
          }
        } catch (notifErr) {
          console.error('In-app refund notification error:', notifErr);
        }
      }
    } catch (emailErr) {
      console.error('Refund notification email failed:', emailErr);
    }

    return NextResponse.json({
      success: true,
      refundRequest,
      message: 'Refund requested successfully. Admin will review it shortly.',
    });
  } catch (error: any) {
    console.error('Refund request error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
