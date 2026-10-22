const DEFAULT_PROMO_START = '2026-03-31T00:00:00.000Z';
const DEFAULT_PROMO_DURATION_DAYS = 60;
const DEFAULT_POST_PROMO_FEE = 0;
const DEFAULT_PROMO_CODE = 'AURA20';
const DEFAULT_PROMO_DISCOUNT = 20;
const DEFAULT_DOCTOR_PAYOUT_FEE = 9;

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolvePromoWindow(now: Date): { promoStart: Date; promoEnd: Date } {
  const startInput = process.env.PLATFORM_FEE_PROMO_START_AT || DEFAULT_PROMO_START;
  const promoStart = new Date(startInput);
  const safePromoStart = Number.isNaN(promoStart.getTime()) ? new Date(DEFAULT_PROMO_START) : promoStart;

  const endInput = process.env.PLATFORM_FEE_PROMO_END_AT;
  if (endInput) {
    const promoEnd = new Date(endInput);
    if (!Number.isNaN(promoEnd.getTime())) {
      return { promoStart: safePromoStart, promoEnd };
    }
  }

  const durationDays = parseNumber(process.env.PLATFORM_FEE_PROMO_DURATION_DAYS, DEFAULT_PROMO_DURATION_DAYS);
  const promoEnd = new Date(safePromoStart);
  promoEnd.setUTCDate(promoEnd.getUTCDate() + Math.max(0, Math.floor(durationDays)));

  if (promoEnd < now && !process.env.PLATFORM_FEE_PROMO_END_AT && !process.env.PLATFORM_FEE_PROMO_START_AT) {
    const rollingStart = new Date(now);
    rollingStart.setUTCHours(0, 0, 0, 0);
    const rollingEnd = new Date(rollingStart);
    rollingEnd.setUTCDate(rollingEnd.getUTCDate() + DEFAULT_PROMO_DURATION_DAYS);
    return { promoStart: rollingStart, promoEnd: rollingEnd };
  }

  return { promoStart: safePromoStart, promoEnd };
}

export function getPlatformFee(now: Date = new Date()): number {
  return parseNumber(process.env.PLATFORM_FEE_AFTER_PROMO, DEFAULT_POST_PROMO_FEE);
}

export function getDoctorPayoutFee(): number {
  return parseNumber(process.env.DOCTOR_PAYOUT_FEE, DEFAULT_DOCTOR_PAYOUT_FEE);
}

function isPromoWindowActive(now: Date = new Date()): boolean {
  const { promoStart, promoEnd } = resolvePromoWindow(now);
  return now >= promoStart && now < promoEnd;
}

export function getPromoCodeConfig() {
  return {
    code: process.env.PLATFORM_PROMO_CODE || DEFAULT_PROMO_CODE,
    discount: parseNumber(process.env.PLATFORM_PROMO_DISCOUNT, DEFAULT_PROMO_DISCOUNT),
  };
}

export interface CouponDetails {
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  couponSystemActive?: boolean;
}

export function computePaymentSplit(
  doctorFee: number, 
  now: Date = new Date(), 
  promoCode?: string, 
  platformFeeOverride?: number,
  couponDetails?: CouponDetails
) {
  const safeDoctorFee = Number.isFinite(doctorFee) && doctorFee > 0 ? doctorFee : 0;
  const platformFee = typeof platformFeeOverride === 'number' ? platformFeeOverride : getPlatformFee(now);
  const payoutFee = getDoctorPayoutFee();
  
  let promoDiscountApplied = 0;
  let isPromoValid = false;

  const hasPromoInput = typeof promoCode === 'string' && promoCode.trim().length > 0;

  if (hasPromoInput) {
    if (couponDetails) {
      // Dynamic coupon system path
      const systemActive = couponDetails.couponSystemActive !== false;
      if (systemActive) {
        isPromoValid = true;
        const totalOverallFee = safeDoctorFee + platformFee;
        if (couponDetails.discountType === 'percentage') {
          promoDiscountApplied = (couponDetails.discountValue / 100) * totalOverallFee;
        } else {
          promoDiscountApplied = couponDetails.discountValue;
        }
        // Cap coupon discount at overall subtotal fee
        promoDiscountApplied = Math.min(promoDiscountApplied, totalOverallFee);
      }
    } else {
      // Static fallback code configuration (e.g. AURA20 environment variable)
      const { code, discount } = getPromoCodeConfig();
      const promoWindowActive = isPromoWindowActive(now);
      isPromoValid = promoWindowActive && promoCode.trim().toUpperCase() === code.toUpperCase();
      // Original static coupons apply ONLY to platform fee
      promoDiscountApplied = isPromoValid ? Math.min(discount, platformFee) : 0;
    }
  }

  const totalPayable = Math.max(0, safeDoctorFee + platformFee - promoDiscountApplied);
  const doctorNetAmount = Number(safeDoctorFee.toFixed(2));

  return {
    doctorFee: Number(safeDoctorFee.toFixed(2)),
    platformFee: Number(platformFee.toFixed(2)),
    payoutFee: Number(payoutFee.toFixed(2)),
    promoDiscount: Number(promoDiscountApplied.toFixed(2)),
    promoCodeValid: Boolean(isPromoValid),
    promoWindowActive: couponDetails ? (couponDetails.couponSystemActive !== false) : isPromoWindowActive(now),
    totalPayable: Number(totalPayable.toFixed(2)),
    doctorNetAmount: Number(doctorNetAmount.toFixed(2)),
  };
}

