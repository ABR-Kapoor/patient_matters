import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
    try {
        // Fetch all doctors with user details.
        // Visibility is gated on moderation outcome, not on approval: a doctor who has been
        // explicitly rejected stays hidden, while one still awaiting admin review is listed.
        // Filtering on is_verified here hid every freshly registered doctor, because nothing in
        // this service ever sets that flag (there is no /api/admin/verify route).
        const doctors = await sql`
            SELECT d.*, u.name, u.email, u.phone, u.profile_image_url
            FROM doctors d
            JOIN users u ON d.uid = u.uid
            WHERE COALESCE(d.verification_rejected, false) = false
                AND u.name IS NOT NULL AND TRIM(u.name) <> ''
            ORDER BY d.created_at DESC
        `;

        const formattedDoctors = doctors.map(doc => ({
            ...doc,
            consultationFee: doc.consultation_fee,
            yearsOfExperience: doc.years_of_experience,
            verificationStatus: doc.is_verified ? 'verified' : 'pending',
            user: { name: doc.name, email: doc.email, phone: doc.phone, profileImageUrl: doc.profile_image_url }
        }));

        const count = formattedDoctors.length;
        console.log(`[API] Found ${count} doctors`);

        return NextResponse.json({
            success: true,
            doctors: formattedDoctors,
            count,
        });
    } catch (error) {
        console.error('Find doctors error:', error);
        return NextResponse.json({ error: 'Failed to fetch doctors' }, { status: 500 });
    }
}
