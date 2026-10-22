import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [feeSetting] = await sql`
      SELECT value FROM global_settings WHERE key = 'platform_fee'
    `;
    
    const platformFee = feeSetting ? Number(feeSetting.value) : 0;
    
    return NextResponse.json({ success: true, platformFee });
  } catch (error: any) {
    console.error('Error fetching platform fee:', error);
    // Fall back gracefully to the default platform fee of 0
    return NextResponse.json({ success: true, platformFee: 0, error: error.message });
  }
}
