import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requirePatient } from '@/lib/authz';
import { parseClinicGeo, formatClinicAddress } from '@/lib/clinic-geo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Booking is intentionally NOT exposed here. This route previously accepted a
 * caller-supplied `pid`, so anyone could book an appointment in another
 * patient's name. Live clients post to `/api/appointments/create`, which
 * derives `pid` from the session.
 */
export async function GET() {
    try {
        const auth = await requirePatient();
        if (!auth.ok) return auth.response;

        const pid = auth.data.pid;

        // No auto-completion sweep here by design. `completed` is written only
        // by the doctor via an explicit "Mark as Completed"; the previous
// AURASUTRA-REVIEWS:augment_appointments_with_myReview
        // grace-period UPDATE silently completed confirmed appointments and
        // bypassed that rule on every read.
        // AURASUTRA-REVIEWS:appointments_my_review_join
        // LEFT JOIN reviews so every appointment carries the caller's own review
        // inline. The client needs it to decide between "Rate doctor" and "Edit
        // review" without a second round trip, and the review fields are aliased
        // (`my_review_*`) so they cannot collide with `a.*` when the shape is
        // spread into the response.
        const appointments = await sql`
            SELECT a.*, ft.amount as paid_amount, ft.platform_fee_applied,
                   rr.refund_id, rr.amount as refund_amount, rr.status as refund_status,
                   rr.reason as refund_reason, rr.refund_type,
                   (rr.refund_id IS NOT NULL) as refund_requested,
                   r.review_id as my_review_id,
                   r.rating as my_review_rating,
                   r.comment as my_review_comment,
                   r.created_at as my_review_created_at,
                   r.updated_at as my_review_updated_at
            FROM appointments a
            LEFT JOIN finance_transactions ft ON a.aid = ft.aid AND ft.transaction_type = 'consultation'
            LEFT JOIN refund_requests rr ON rr.aid = a.aid
            LEFT JOIN reviews r ON r.aid = a.aid
            WHERE a.pid = ${pid}
            ORDER BY
              CASE WHEN a.status NOT IN ('completed', 'cancelled') THEN 0 ELSE 1 END ASC,
              CASE WHEN a.status NOT IN ('completed', 'cancelled') THEN a.scheduled_date END ASC,
              CASE WHEN a.status NOT IN ('completed', 'cancelled') THEN a.scheduled_time::time END ASC,
              CASE WHEN a.status IN ('completed', 'cancelled') THEN a.scheduled_date END DESC,
              CASE WHEN a.status IN ('completed', 'cancelled') THEN a.scheduled_time::time END DESC
        `;

        if (!appointments || appointments.length === 0) {
            return NextResponse.json({ success: true, appointments: [] });
        }

        // Get all unique doctor IDs
        const doctorIds = [...new Set(appointments.map(apt => apt.did))];

        // Fetch doctor details with user info. The clinic address columns are
        // included so in-clinic appointments can offer a directions link;
        // address_line2 may carry a JSON coordinate payload.
        const doctors = await sql`
            SELECT d.did, d.uid, d.specialization, d.consultation_fee,
                   d.clinic_name, d.address_line1, d.address_line2,
                   d.city, d.state, d.postal_code,
                   u.name, u.email, u.phone, u.profile_image_url
            FROM doctors d
            JOIN users u ON d.uid = u.uid
            WHERE d.did = ANY(${doctorIds}::uuid[])
        `;

        // Count unread doctor messages for each appointment
        const appointmentIds = appointments.map(apt => apt.aid);
        const unreadCounts = await sql`
            SELECT aid, COUNT(*)::int as count
            FROM appointment_messages
            WHERE aid = ANY(${appointmentIds}::uuid[])
              AND sender_role = 'doctor'
              AND read_at IS NULL
            GROUP BY aid
        `;
        const unreadMap = new Map((unreadCounts || []).map((r: any) => [r.aid, Number(r.count)]));

        // Map doctor data to appointments
        const enrichedAppointments = appointments.map(apt => {
            const doc = doctors?.find(d => d.did === apt.did);
            const unreadCount = unreadMap.get(apt.aid) || 0;
            return {
                ...apt,
                unread_messages_count: unreadCount,
                unreadMessagesCount: unreadCount,
                // Add camelCase aliases safely with snake_case fallbacks for frontend compatibility
                scheduledDate: apt.scheduledDate || apt.scheduled_date,
                scheduledTime: apt.scheduledTime || apt.scheduled_time,
                chiefComplaint: apt.chiefComplaint || apt.chief_complaint,
                consultationFee: apt.consultationFee || apt.consultation_fee,
                paymentStatus: apt.paymentStatus || apt.payment_status,
                paymentId: apt.paymentId || apt.payment_id,
                tokenNumber: apt.tokenNumber || apt.token_number,
                queuePosition: apt.queuePosition || apt.queue_position,
                estimatedWaitMinutes: apt.estimatedWaitMinutes || apt.estimated_wait_minutes,
                doctorNotes: apt.doctorNotes || apt.doctor_notes,
                cancellationReason: apt.cancellationReason || apt.cancellation_reason,
                paidAmount: apt.paidAmount || apt.paid_amount,
                platformFeeApplied: apt.platformFeeApplied || apt.platform_fee_applied,
                refundRequested: apt.refundRequested || apt.refund_requested,
                refundId: apt.refund_id,
                refundAmount: apt.refund_amount,
                refundStatus: apt.refund_status,
                refundReason: apt.refund_reason,
                refundType: apt.refund_type,
                // AURASUTRA-REVIEWS:appointments_my_review_shape
                // null means "not rated yet"; the review is present even if the
                // appointment was later reopened, so the client can offer an edit.
                myReview: apt.my_review_id ? {
                    reviewId: apt.my_review_id,
                    rating: Number(apt.my_review_rating),
                    comment: apt.my_review_comment ?? null,
                    createdAt: apt.my_review_created_at ?? null,
                    updatedAt: apt.my_review_updated_at ?? null,
                } : null,
                doctor: doc ? {
                    did: doc.did,
                    uid: doc.uid,
                    specialization: doc.specialization,
                    consultationFee: doc.consultationFee || doc.consultation_fee,
                    clinicAddress: formatClinicAddress({
                        clinic_name: doc.clinic_name,
                        address_line1: doc.address_line1,
                        city: doc.city,
                        state: doc.state,
                        postal_code: doc.postal_code,
                    }),
                    // Exact map point when the doctor has set one, else null.
                    clinicLocation: parseClinicGeo(doc.address_line2),
                    user: { 
                        name: doc.name, 
                        email: doc.email, 
                        phone: doc.phone, 
                        profileImageUrl: doc.profileImageUrl || doc.profile_image_url 
                    }
                } : null
            };
        });

        return NextResponse.json({
            success: true,
            appointments: enrichedAppointments,
        });
    } catch (error) {
        console.error('Appointments API error:', error);
        return NextResponse.json({ error: 'Failed to fetch appointments' }, { status: 500 });
    }
}
