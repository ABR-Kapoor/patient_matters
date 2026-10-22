import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET(
    request: NextRequest,
    { params }: { params: { did: string } }
) {
    try {
        const { did } = params;

        if (!did) {
            return NextResponse.json({ error: 'Doctor ID is required' }, { status: 400 });
        }

        // Fetch doctor with user details. Hidden only if an admin explicitly rejected them,
        // otherwise booking a pending doctor 404s and the patient cannot proceed.
        const [doctor] = await sql`
            SELECT d.*, u.name, u.email, u.phone, u.profile_image_url
            FROM doctors d
            JOIN users u ON d.uid = u.uid
            WHERE d.did = ${did}
                AND COALESCE(d.verification_rejected, false) = false
        `;

        if (!doctor) {
            return NextResponse.json({ error: 'Doctor not found' }, { status: 404 });
        }

        // Shape response to match original format
        const formattedDoctor = {
            ...doctor,
            yearsOfExperience: doctor.years_of_experience,
            consultationFee: doctor.consultation_fee,
            verificationStatus: doctor.is_verified ? 'verified' : 'pending',
            user: { name: doctor.name, email: doctor.email, phone: doctor.phone, profileImageUrl: doctor.profile_image_url }
        };

        return NextResponse.json({
            success: true,
            doctor: formattedDoctor,
        });
    } catch (error) {
        console.error('Error fetching doctor:', error);
        return NextResponse.json({ error: 'Failed to fetch doctor details' }, { status: 500 });
    }
}
