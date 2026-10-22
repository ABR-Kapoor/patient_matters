import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Hide only doctors an admin explicitly rejected; pending ones stay listed.
        const doctors = await sql`
                        SELECT d.*, u.name as "user_name", u.email as "user_email", u.profile_image_url as "user_profile_image_url"
            FROM doctors d
            JOIN users u ON d.uid = u.uid
            WHERE COALESCE(d.verification_rejected, false) = false
                AND u.name IS NOT NULL AND TRIM(u.name) <> ''
            ORDER BY d.years_of_experience DESC
        `;

        // Format to match old Supabase structure
        const formattedDoctors = doctors.map(d => ({
            ...d,
            verificationStatus: d.is_verified ? 'verified' : 'pending',
            user: {
                name: d.userName,
                email: d.userEmail,
                profileImageUrl: d.userProfileImageUrl,
            }
        }));

        return NextResponse.json(formattedDoctors);
    } catch (error: any) {
        console.error('Error fetching doctors:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
