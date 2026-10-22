import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifyClerkUser } from '@/lib/clerk-verify';

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const kindeUser = await verifyClerkUser();

    if (!kindeUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: 'Missing payment verification details' },
        { status: 400 }
      );
    }

    // Support local sandbox mock orders bypass
    if (razorpay_order_id.startsWith('order_mock_')) {
      console.warn("WARNING: Verifying mock sandbox development payment order:", razorpay_order_id);
      return NextResponse.json({
        success: true,
        message: 'Mock payment verified successfully',
        payment_id: razorpay_payment_id,
        order_id: razorpay_order_id,
      });
    }

    // Verify signature
    const rawSecret = process.env.RAZORPAY_KEY_SECRET || '';
    const cleanSecret = rawSecret.split(' ')[0].trim();

    const generatedSignature = crypto
      .createHmac('sha256', cleanSecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return NextResponse.json(
        { error: 'Invalid payment signature' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verified successfully',
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id,
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify payment' },
      { status: 500 }
    );
  }
}
