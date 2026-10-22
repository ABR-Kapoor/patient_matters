// AURASUTRA-REVIEWS:public_doctor_reviews_list
import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function maskName(full: string | null): string | null {
  if (!full) return null;
  const parts = full.trim().split(/\s+/);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { did: string } }
) {
  try {
    const { did } = params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 20, 1), 50);
    const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);

    const reviews = await sql`
      SELECT r.review_id, r.aid, r.did, r.rating, r.comment, r.created_at,
             u.name AS patient_name
      FROM reviews r
      JOIN patients p ON p.pid = r.pid
      JOIN users u ON u.uid = p.uid
      WHERE r.did = ${did} AND r.is_published = true
      ORDER BY r.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const [{ count }] = await sql`
      SELECT COUNT(*)::int AS count
      FROM reviews
      WHERE did = ${did} AND is_published = true
    `;

    const items = reviews.map((x: any) => ({
      reviewId: x.review_id,
      aid: x.aid,
      did: x.did,
      rating: x.rating,
      comment: x.comment,
      createdAt: x.created_at,
      patientName: maskName(x.patient_name),
    }));

    return NextResponse.json({ success: true, items, count, limit, offset });
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Failed to fetch reviews' }, { status: 500 });
  }
}
