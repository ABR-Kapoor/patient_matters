// AURASUTRA-REVIEWS:public_rating_summary
import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: { did: string } }
) {
  try {
    const { did } = params;
    const [agg] = await sql`
      SELECT
        COALESCE(ROUND(AVG(rating)::numeric,2), NULL) AS avg_rating,
        COUNT(*)::int AS total_reviews
      FROM reviews
      WHERE did = ${did} AND is_published = true
    `;
    const dist = await sql`
      SELECT rating, COUNT(*)::int AS count
      FROM reviews
      WHERE did = ${did} AND is_published = true
      GROUP BY rating
      ORDER BY rating
    `;
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const d of dist) {
      if (d.rating >= 1 && d.rating <= 5) {
        distribution[d.rating] = d.count;
      }
    }
    return NextResponse.json({
      success: true,
      avgRating: agg?.avg_rating ?? null,
      totalReviews: agg?.total_reviews ?? 0,
      distribution,
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Failed to fetch rating summary' }, { status: 500 });
  }
}
