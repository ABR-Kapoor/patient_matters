import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requirePatient } from '@/lib/authz';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
    try {
        const auth = await requirePatient();
        if (!auth.ok) return auth.response;

        const pid = auth.data.pid;

        // Get all SENT prescriptions for patient
        const prescriptions = await sql`
            SELECT * FROM prescriptions
            WHERE pid = ${pid} AND is_active = true AND sent_to_patient = true
            ORDER BY created_at DESC
        `;

        // Add doctor info to each prescription
        const prescriptionsWithDoctors = await Promise.all(
            prescriptions.map(async (prescription) => {
                const [doctor] = await sql`
                    SELECT d.did, d.specialization, d.qualification, d.years_of_experience, d.bio, u.name, u.profile_image_url
                    FROM doctors d
                    JOIN users u ON d.uid = u.uid
                    WHERE d.did = ${prescription.did}
                `;

                // Handle medicines and symptoms being strings in the database
                const medicines = typeof prescription.medicines === 'string' 
                    ? JSON.parse(prescription.medicines) 
                    : prescription.medicines;
                const symptoms = typeof prescription.symptoms === 'string'
                    ? JSON.parse(prescription.symptoms)
                    : prescription.symptoms;

                const doctorObj = doctor ? { 
                    did: doctor.did, 
                    id: doctor.did,
                    name: doctor.name,
                    specialization: doctor.specialization,
                    qualification: doctor.qualification,
                    yearsOfExperience: doctor.years_of_experience,
                    years_of_experience: doctor.years_of_experience,
                    bio: doctor.bio,
                    about: doctor.bio,
                    profileImageUrl: doctor.profile_image_url,
                    profile_image_url: doctor.profile_image_url,
                    users: { 
                        name: doctor.name, 
                        profile_image_url: doctor.profile_image_url,
                        profileImageUrl: doctor.profile_image_url
                    },
                    user: {
                        name: doctor.name, 
                        profile_image_url: doctor.profile_image_url,
                        profileImageUrl: doctor.profile_image_url
                    }
                } : null;

                return {
                    ...prescription,
                    medicines: medicines || [],
                    symptoms: symptoms || [],
                    doctors: doctorObj,
                    doctor: doctorObj
                };
            })
        );

        // Since the SQL query already filters `sent_to_patient = true`, all are sent.
        const sent = prescriptionsWithDoctors;
        const drafts: any[] = [];

        return NextResponse.json({
            success: true,
            prescriptions: {
                sent,
                drafts,
                all: prescriptionsWithDoctors || [],
            },
        });
    } catch (error: any) {
        console.error('[API] Patient prescriptions fetch error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
