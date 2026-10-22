import { NextRequest, NextResponse } from 'next/server';
import { verifyClerkUser } from '@/lib/clerk-verify';
import { sendEmail } from '@/lib/shared/notifications/email';
import { generateRefundRequestForAdminEmail } from '@/lib/shared/notifications/templates';
import sql from '@/lib/db';

const ADMIN_NOTIFICATION_EMAILS = [
  'abrkapoor@gmail.com',
  'abrmkprm@gmail.com',
  'gauravkumar4841@gmail.com',
  'atkola12345@gmail.com',
];

export async function POST(request: NextRequest) {
  try {
    const kindeUser = await verifyClerkUser();
    if (!kindeUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { razorpay_payment_id, razorpay_order_id, amount, reason } = await request.json();

    if (!razorpay_payment_id) {
      return NextResponse.json({ error: 'razorpay_payment_id is required' }, { status: 400 });
    }

    // Look up the patient PID from the authenticated Clerk user
    const [patient] = await sql`
      SELECT p.pid FROM patients p
      JOIN users u ON p.uid = u.uid
      WHERE u.auth_id = ${kindeUser.id}
    `;

    const notifyAdmins = async (refundId: string | null) => {
      try {
        const userEmail = kindeUser.emailAddresses?.[0]?.emailAddress || 'unknown';
        const userName = kindeUser.fullName || 'Patient';

        const html = generateRefundRequestForAdminEmail({
          recipientName: 'Admin Team',
          patientName: userName,
          patientEmail: userEmail,
          doctorName: 'System (Auto-Refund)',
          amount: amount || 0,
          refundId: refundId || 'NOT RECORDED',
          reason: reason || 'Payment captured but appointment creation failed',
          status: 'pending',
        });

        await Promise.all(
          ADMIN_NOTIFICATION_EMAILS.map((email) =>
            sendEmail({
              to: email,
              subject: `Auto-Refund Request — Payment ${razorpay_payment_id}`,
              html,
            })
          )
        );
      } catch (emailErr) {
        console.error('Auto-refund email notification failed:', emailErr);
      }
    };

    // refund_requests.pid is NOT NULL, so an unprovisioned account cannot be
    // recorded here. Escalate loudly instead of crashing on a constraint
    // violation, otherwise the captured payment is lost with no trace.
    if (!patient) {
      console.error(
        '[initiate-auto] No patients row for auth_id %s — refund NOT recorded, payment %s must be refunded manually',
        kindeUser.id,
        razorpay_payment_id
      );
      await notifyAdmins(null);

      return NextResponse.json(
        {
          success: false,
          error: 'Could not record auto-refund: no patient record for this account. Admin notified for manual refund.',
          code: 'PATIENT_RECORD_MISSING',
        },
        { status: 409 }
      );
    }

    const [inserted] = await sql`
      INSERT INTO refund_requests (
        aid, pid, razorpay_payment_id, amount,
        refund_type, reason, status, reviewer_role
      )
      VALUES (
        NULL,
        ${patient.pid},
        ${razorpay_payment_id},
        ${amount || 0},
        'full',
        ${reason || 'Auto-refund: payment captured but appointment not created'},
        'pending',
        'system'
      )
      RETURNING refund_id
    `;

    await notifyAdmins(inserted?.refund_id || null);

    return NextResponse.json({
      success: true,
      message: 'Auto-refund request recorded. Admin will process it shortly.',
    });
  } catch (error: any) {
    console.error('Auto-refund error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to record auto-refund' },
      { status: 500 }
    );
  }
}
