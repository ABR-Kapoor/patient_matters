// AURASUTRA-REVIEWS:patient_submit_review
import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requirePatient, requireOwnAppointment } from '@/lib/authz';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const identity = await requirePatient();
  if (!identity.ok) return identity.response;

  try {
    const body = await request.json();
    const { aid, rating, comment } = body;

    if (!aid) {
      return NextResponse.json({ success: false, error: 'aid is required' }, { status: 400 });
    }
    const r = Number(rating);
    if (!Number.isInteger(r) || r < 1 || r > 5) {
      return NextResponse.json({ success: false, error: 'rating must be 1-5' }, { status: 400 });
    }

    let c: string | null = null;
    if (comment !== undefined && comment !== null) {
      c = String(comment).trim();
      if (c.length > 500) {
        return NextResponse.json({ success: false, error: 'comment must be <= 500 characters' }, { status: 400 });
      }
      if (c.length === 0) c = null;
    }

    const owned = await requireOwnAppointment(identity.data, aid);
    if (!owned.ok) return owned.response;

    const [apt] = await sql`
      SELECT status, completed_at, call_ended_at, did, pid
      FROM appointments
      WHERE aid = ${aid}
      LIMIT 1
    `;
    if (!apt) {
      return NextResponse.json({ success: false, error: 'Appointment not found' }, { status: 404 });
    }
    if (apt.status === 'cancelled') {
      return NextResponse.json({ success: false, error: 'Cannot review a cancelled appointment' }, { status: 400 });
    }
    if (apt.status !== 'completed') {
      return NextResponse.json({ success: false, error: 'Only completed appointments can be reviewed' }, { status: 400 });
    }

    const [review] = await sql`
      INSERT INTO reviews (aid, pid, did, rating, comment)
      VALUES (${aid}, ${identity.data.pid}, ${apt.did}, ${r}, ${c})
      ON CONFLICT (aid) DO UPDATE
        SET rating = EXCLUDED.rating,
            comment = EXCLUDED.comment,
            updated_at = CURRENT_TIMESTAMP
      RETURNING review_id, aid, pid, did, rating, comment, is_published, created_at, updated_at
    `;

    return NextResponse.json({ success: true, review });
  } catch (error: any) {
    console.error('[patient/reviews POST] error:', error?.message, error?.code);
    const bad = error?.code === '22P02' || error?.code === '23503' || error?.code === '23514';
    return NextResponse.json(
      { success: false, error: bad ? 'Invalid review data' : 'Failed to submit review' },
      { status: bad ? 400 : 500 }
    );
  }
}
