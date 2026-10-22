import { NextRequest, NextResponse } from 'next/server';
import { verifyClerkUser } from '@/lib/clerk-verify';
import sql from '@/lib/db';
import { computePaymentSplit } from '@/lib/paymentPolicy';

export async function POST(request: NextRequest) {
  try {
    const kindeUser = await verifyClerkUser();

    if (!kindeUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      aid,
      did,
      common_payment_id,
      promo_code,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      payment_method,
      razorpay_response,
      status = 'paid',
      amount,
    } = body;

    if (!did || !aid || !razorpay_payment_id || !razorpay_order_id) {
      return NextResponse.json({ error: 'Missing required payment fields' }, { status: 400 });
    }

    // Get user's UID
    const [userData] = await sql`
      SELECT uid FROM users WHERE auth_id = ${kindeUser.id}
    `;

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get patient ID
    const [patientData] = await sql`
      SELECT pid FROM patients WHERE uid = ${userData.uid}
    `;

    if (!patientData) {
      return NextResponse.json({ error: 'Patient record not found' }, { status: 404 });
    }

    const pid = patientData.pid;

    // Idempotency guard for duplicate callbacks/retries.
    const [existing] = await sql`
      SELECT *
      FROM finance_transactions
      WHERE razorpay_payment_id = ${razorpay_payment_id}
      LIMIT 1
    `;

    if (existing) {
      const linkedRows = await sql`
        SELECT *
        FROM finance_transactions
        WHERE common_payment_id = ${existing.common_payment_id || razorpay_order_id}
        ORDER BY created_at ASC
      `;

      return NextResponse.json({
        success: true,
        transaction: existing,
        linked_transactions: linkedRows,
        message: 'Transaction already recorded',
      });
    }

    const [doctorData] = await sql`
      SELECT
        d.did,
        d.consultation_fee,
        u.name as doctor_name
      FROM doctors d
      LEFT JOIN users u ON u.uid = d.uid
      WHERE d.did = ${did}
    `;

    if (!doctorData) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 });
    }

    const baseFee = Number(doctorData.consultationFee || doctorData.consultation_fee || 0);

    const promoCodeInput = typeof promo_code === 'string' ? promo_code.trim().toUpperCase() : '';
    let couponDetails: { discountType: 'percentage' | 'fixed'; discountValue: number; couponSystemActive?: boolean } | undefined;

    // Fetch live settings and coupons dynamically
    let dbPlatformFee = 0;
    let couponSystemActive = true;

    try {
      const settings = await sql`
        SELECT key, value FROM global_settings WHERE key IN ('platform_fee', 'coupon_system_active')
      `;
      const feeSetting = settings.find(s => s.key === 'platform_fee');
      const couponSetting = settings.find(s => s.key === 'coupon_system_active');

      if (feeSetting) dbPlatformFee = Number(feeSetting.value);
      if (couponSetting) couponSystemActive = couponSetting.value === 'true';
    } catch (dbErr) {
      console.error('Failed to fetch platform fee/system activation in record-transaction:', dbErr);
    }

    if (promoCodeInput && couponSystemActive) {
      try {
        const [coupon] = await sql`
          SELECT code, discount_type, discount_value, is_active
          FROM coupons
          WHERE UPPER(code) = ${promoCodeInput}
        `;

        if (coupon && coupon.isActive) {
          couponDetails = {
            discountType: coupon.discountType as 'percentage' | 'fixed',
            discountValue: Number(coupon.discountValue),
            couponSystemActive: true,
          };
        }
      } catch (couponErr) {
        console.error('Failed to resolve coupon during transaction recording:', couponErr);
      }
    }

    const pricing = computePaymentSplit(baseFee, new Date(), promoCodeInput, dbPlatformFee, couponDetails);
    const linkId = common_payment_id || razorpay_order_id;
    const nowIso = new Date().toISOString();
    const doctorNetAmount = Number(pricing.doctorNetAmount || 0);

    const transferStatus = status === 'paid' ? 'manual_pending' : 'pending';

    const [consultationTx] = await sql`
      INSERT INTO finance_transactions (
        aid, pid, did, transaction_type, amount, currency, status,
        razorpay_order_id, razorpay_payment_id, razorpay_signature,
        payment_method, razorpay_response, description,
        initiated_at, paid_at,
        common_payment_id, doctor_net_amount, platform_fee_applied, payout_fee_amount, transfer_status, final_net_amount
      )
      VALUES (
        ${aid}, ${pid}, ${did}, 'consultation', ${pricing.totalPayable}, 'INR', ${status},
        ${razorpay_order_id}, ${razorpay_payment_id}, ${razorpay_signature},
        ${payment_method || 'card'}, ${JSON.stringify(razorpay_response || {})},
        ${'Consultation payment for appointment ' + aid},
        ${nowIso},
        ${status === 'paid' ? nowIso : null},
        ${linkId}, ${doctorNetAmount}, ${pricing.platformFee}, ${0}, ${transferStatus}, ${doctorNetAmount}
      )
      RETURNING *
    `;

    return NextResponse.json({
      success: true,
      common_payment_id: linkId,
      transaction: consultationTx,
      pricing,
      message: 'Payment recorded. Doctor payout will be processed manually.',
    });
  } catch (error) {
    console.error('Transaction recording error:', error);
    return NextResponse.json({ error: 'Failed to record transaction' }, { status: 500 });
  }
}
