import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { computePaymentSplit } from '@/lib/paymentPolicy';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');
        const doctorFeeStr = searchParams.get('doctorFee');

        if (!code || !code.trim()) {
            return NextResponse.json({ valid: false, error: 'Coupon code is required' }, { status: 400 });
        }

        const cleanCode = code.trim().toUpperCase();
        const doctorFee = doctorFeeStr ? Number(doctorFeeStr) : 0;

        if (isNaN(doctorFee) || doctorFee < 0) {
            return NextResponse.json({ valid: false, error: 'Invalid doctor fee value' }, { status: 400 });
        }

        // 1. Check if global coupon system is active
        const [couponSetting] = await sql`
            SELECT value FROM global_settings WHERE key = 'coupon_system_active'
        `;
        const couponSystemActive = couponSetting ? couponSetting.value === 'true' : true;

        if (!couponSystemActive) {
            return NextResponse.json({ 
                valid: false, 
                error: 'Promo codes are currently disabled on the platform' 
            });
        }

        // 2. Fetch platform fee
        const [feeSetting] = await sql`
            SELECT value FROM global_settings WHERE key = 'platform_fee'
        `;
        const platformFee = feeSetting ? Number(feeSetting.value) : 20;

        // 3. Find coupon
        const [coupon] = await sql`
            SELECT id, code, discount_type, discount_value, is_active
            FROM coupons
            WHERE UPPER(code) = ${cleanCode}
        `;

        if (!coupon) {
            return NextResponse.json({ 
                valid: false, 
                error: `Invalid promo code '${cleanCode}'` 
            });
        }

        if (!coupon.is_active) {
            return NextResponse.json({ 
                valid: false, 
                error: `Promo code '${cleanCode}' has expired or is inactive` 
            });
        }

        // 4. Calculate split
        const pricing = computePaymentSplit(
            doctorFee,
            new Date(),
            cleanCode,
            platformFee,
            {
                discountType: coupon.discount_type as 'percentage' | 'fixed',
                discountValue: Number(coupon.discount_value),
                couponSystemActive: true
            }
        );

        return NextResponse.json({
            valid: true,
            code: coupon.code,
            discountType: coupon.discount_type,
            discountValue: Number(coupon.discount_value),
            platformFee,
            doctorFee,
            promoDiscount: pricing.promoDiscount,
            totalPayable: pricing.totalPayable,
            pricing
        });
    } catch (error: any) {
        console.error('Error validating coupon:', error);
        return NextResponse.json({ valid: false, error: error.message }, { status: 500 });
    }
}
