// AURASUTRA-REVIEWS:patient_submit_review
import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requirePatient, requireOwnAppointment } from '@/lib/authz';
import { notifyMany, NOTIFICATION_URLS, type CreateNotificationInput } from '@/lib/shared/notifications/inApp';

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

    try {
      const [doctorUser] = await sql`
        SELECT d.uid, u.name, u.profile_image_url
        FROM doctors d
        JOIN users u ON u.uid = d.uid
        WHERE d.did = ${apt.did}
        LIMIT 1
      `;
      const [patientUser] = await sql`
        SELECT u.name, u.profile_image_url
        FROM patients p
        JOIN users u ON u.uid = p.uid
        WHERE p.pid = ${identity.data.pid}
        LIMIT 1
      `;

      const doctorName = doctorUser?.name
        ? `Dr. ${String(doctorUser.name).replace(/^Dr\.?\s+/i, '')}`
        : 'your doctor';
      const patientName = patientUser?.name || 'A patient';
      const timestamp = new Date(review.updated_at || review.created_at || Date.now()).getTime();
      const eventKey = `review:${review.review_id}:${timestamp}`;

      const inputs: CreateNotificationInput[] = [
        {
          uid: identity.data.uid,
          title: 'Review Submitted',
          body: `Thanks for sharing your feedback about ${doctorName}.`,
          type: 'review' as const,
          actionUrl: NOTIFICATION_URLS.appointments,
          eventKey,
          metadata: {
            review_id: review.review_id,
            aid,
            rating: review.rating,
            doctor_name: doctorName,
            image_url: doctorUser?.profile_image_url || null,
            avatar_url: doctorUser?.profile_image_url || null,
          },
          push: false,
        },
      ];

      if (doctorUser?.uid) {
        inputs.push({
          uid: doctorUser.uid,
          title: 'New Review Received',
          body: `${patientName} rated your consultation ${review.rating}/5.`,
          type: 'review' as const,
          actionUrl: NOTIFICATION_URLS.appointments,
          eventKey,
          pushChannelId: 'doctor-updates',
          metadata: {
            review_id: review.review_id,
            aid,
            rating: review.rating,
            patient_name: patientName,
            image_url: patientUser?.profile_image_url || null,
            avatar_url: patientUser?.profile_image_url || null,
          },
          push: true,
        });
      }

      await notifyMany(inputs);
    } catch (notifErr) {
      console.error('[patient/reviews POST] notification failed:', notifErr);
    }

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
