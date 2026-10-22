import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";
import { verifyClerkUser } from '@/lib/clerk-verify';
import sql from '@/lib/db';
import { computePaymentSplit, getPromoCodeConfig } from '@/lib/paymentPolicy';

function getCleanEnv(val: string | undefined): string {
  if (!val) return '';
  return val.split(' ')[0].trim();
}

const razorpay = new Razorpay({
  key_id: getCleanEnv(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID),
  key_secret: getCleanEnv(process.env.RAZORPAY_KEY_SECRET),
});

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const kindeUser = await verifyClerkUser();

    if (!kindeUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const { did, currency = "INR", receipt, notes, promo_code, amount } = body;

    if (!did) {
      return NextResponse.json({ error: "Doctor ID is required" }, { status: 400 });
    }

    const [doctor] = await sql`
      SELECT
        did,
        consultation_fee
      FROM doctors
      WHERE did = ${did}
    `;

    if (!doctor) {
      return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
    }

    const baseFee = Number(doctor.consultationFee || doctor.consultation_fee || 0);

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
      console.error('Failed to fetch platform fee/system activation from DB:', dbErr);
    }

    if (promoCodeInput) {
      if (!couponSystemActive) {
        return NextResponse.json(
          { error: 'Promo codes are currently disabled on the platform' },
          { status: 400 }
        );
      }

      // Query coupon
      const [coupon] = await sql`
        SELECT code, discount_type, discount_value, is_active
        FROM coupons
        WHERE UPPER(code) = ${promoCodeInput}
      `;

      if (!coupon) {
        return NextResponse.json(
          { error: `Invalid promo code '${promoCodeInput}'` },
          { status: 400 }
        );
      }

      if (!coupon.isActive) {
        return NextResponse.json(
          { error: `Promo code '${promoCodeInput}' has expired or is inactive` },
          { status: 400 }
        );
      }

      couponDetails = {
        discountType: coupon.discountType as 'percentage' | 'fixed',
        discountValue: Number(coupon.discountValue),
        couponSystemActive: true
      };
    }

    const pricing = computePaymentSplit(
      baseFee,
      new Date(),
      promoCodeInput,
      dbPlatformFee,
      couponDetails
    );

    // Validate amount
    if (!pricing.totalPayable || pricing.totalPayable <= 0) {
      console.error('Invalid payable amount derived:', pricing);
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const commonPaymentId = `pay_${Date.now()}_${String(did).replace(/-/g, '').slice(0, 8)}`;

    const options: any = {
      amount: Math.round(pricing.totalPayable * 100),
      currency,
      receipt: receipt || `receipt_${Date.now()}`,
      notes: {
        ...(notes || {}),
        did,
        common_payment_id: commonPaymentId,
        doctor_fee: pricing.doctorFee,
        platform_fee: pricing.platformFee,
        payout_fee: pricing.payoutFee,
        doctor_net_amount: pricing.doctorNetAmount,
        promo_code: pricing.promoCodeValid ? promoCodeInput : '',
        promo_discount: pricing.promoDiscount,
      },
    };

    let order;
    try {
      order = await razorpay.orders.create(options);
    } catch (error: any) {
      console.error("Razorpay order creation error:", JSON.stringify(error, null, 2));
      throw error;
    }

    return NextResponse.json({
      success: true,
      order,
      pricing,
      common_payment_id: commonPaymentId,
      applied_promo_code: pricing.promoCodeValid ? promoCodeInput : '',
      doctor_net_amount: pricing.doctorNetAmount,
      payout_fee: pricing.payoutFee,
    });
  } catch (error: any) {
    console.error("Outer payments route error:", error);
    const errorMessage = error.error?.description || error.message || "Failed to create payment order";
    return NextResponse.json(
      { error: errorMessage, details: error },
      { status: 500 },
    );
  }
}
