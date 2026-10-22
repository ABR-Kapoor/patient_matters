import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { symptoms } = body;

        if (!symptoms || symptoms.trim().length < 10) {
            return NextResponse.json(
                { success: false, error: 'Please provide more detailed symptoms (at least 10 characters)' },
                { status: 400 }
            );
        }

        const doctors = await getRealDoctorsWithAI(symptoms);

        return NextResponse.json({
            success: true,
            doctors,
        });
    } catch (error) {
        console.error('AI search error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to process your request' },
            { status: 500 }
        );
    }
}

async function getRealDoctorsWithAI(symptoms: string) {
    try {
        const relevantSpecs = analyzeSymptoms(symptoms);
        console.log('Relevant specializations:', relevantSpecs);

        const doctors = await sql`
            SELECT d.*, u.name, u.email, u.profile_image_url
            FROM doctors d
            JOIN users u ON d.uid = u.uid
            WHERE COALESCE(d.verification_rejected, false) = false
                AND u.name IS NOT NULL AND TRIM(u.name) <> ''
                AND u.phone IS NOT NULL AND TRIM(u.phone) <> ''
                -- AND u.profile_image_url IS NOT NULL
                -- AND d.specialization IS NOT NULL
                 -- AND d.qualification IS NOT NULL
                AND d.years_of_experience IS NOT NULL AND d.years_of_experience > 0
                AND d.consultation_fee IS NOT NULL AND d.consultation_fee > 0
                AND d.city IS NOT NULL AND TRIM(d.city) <> ''
                AND d.state IS NOT NULL AND TRIM(d.state) <> ''
        `;

        if (!doctors || doctors.length === 0) {
            return [];
        }

        // Format doctors to match expected structure
        const formattedDoctors = doctors.map(doc => ({
            ...doc,
            consultationFee: doc.consultation_fee,
            yearsOfExperience: doc.years_of_experience,
            user: { name: doc.name, email: doc.email, profileImageUrl: doc.profile_image_url }
        }));

        const symptomKeywords = symptoms.toLowerCase().split(' ').filter(w => w.length > 3);

        const matchedDoctors = formattedDoctors.filter((doctor: any) => {
            const doctorSpecs = doctor.specialization || [];
            const customSpecs = doctor.custom_specializations || '';

            const specsMatch = relevantSpecs.some(spec =>
                doctorSpecs.some((dSpec: string) => dSpec.toLowerCase().includes(spec.toLowerCase()) || spec.toLowerCase().includes(dSpec.toLowerCase()))
            );

            const customKeywords = customSpecs.toLowerCase().split(',').map((k: string) => k.trim());
            const keywordsMatch = symptomKeywords.some(symptom =>
                customKeywords.some((keyword: string) => keyword.includes(symptom) || symptom.includes(keyword))
            );

            return specsMatch || keywordsMatch;
        });

        const doctorsToUse = matchedDoctors.length > 0 ? matchedDoctors : formattedDoctors;

        return mapDoctorsToRecommendations(doctorsToUse, symptoms, relevantSpecs);
    } catch (error) {
        console.error('Database error:', error);
        return [];
    }
}

function analyzeSymptoms(symptoms: string): string[] {
    const symptomsLower = symptoms.toLowerCase();
    const specializations: string[] = [];

    if (symptomsLower.match(/digest|stomach|bloat|constip|diarr|acid|gas|ibs/)) {
        specializations.push('Panchakarma Specialist', 'Kayachikitsa (Internal Medicine)');
    }
    if (symptomsLower.match(/stress|anxiety|sleep|insomnia|depress|mental|mind/)) {
        specializations.push('Rasayana (Rejuvenation)', 'Swasthavritta (Preventive Medicine)');
    }
    if (symptomsLower.match(/pain|joint|arthrit|back|neck|muscle|inflam/)) {
        specializations.push('Panchakarma Specialist', 'Kayachikitsa (Internal Medicine)');
    }
    if (symptomsLower.match(/skin|rash|eczema|psoriasis|acne|itch/)) {
        specializations.push('Kayachikitsa (Internal Medicine)');
    }
    if (symptomsLower.match(/cough|cold|asthma|breath|lung|respirat/)) {
        specializations.push('Kayachikitsa (Internal Medicine)', 'Shalakya Tantra (ENT & Ophthalmology)');
    }
    if (symptomsLower.match(/period|menstrual|pregnan|fertility|pcos/)) {
        specializations.push('Prasuti Tantra (Gynecology & Obstetrics)');
    }
    if (symptomsLower.match(/child|baby|infant|pediatric/)) {
        specializations.push('Kaumara Bhritya (Pediatrics)');
    }
    if (specializations.length === 0) {
        specializations.push('General Ayurveda');
    }

    return [...new Set(specializations)];
}

function mapDoctorsToRecommendations(doctors: any[], symptoms: string, relevantSpecs: string[]) {
    return doctors.slice(0, 3).map((doctor) => {
        const doctorSpecs = doctor.specialization || [];
        const matchCount = relevantSpecs.filter(spec => doctorSpecs.includes(spec)).length;
        const matchScore = Math.min(98, 85 + (matchCount * 5) + Math.random() * 3);
        const primarySpec = doctorSpecs.find((spec: string) => relevantSpecs.includes(spec)) || doctorSpecs[0] || 'General Ayurveda';

        return {
            name: doctor.user?.name || ` ${doctor.qualification}`,
            specialization: primarySpec,
            experience: doctor.yearsOfExperience || 5,
            fee: Number(doctor.consultationFee) || 500,
            location: doctor.city && doctor.state ? `${doctor.city}, ${doctor.state}` : 'India',
            // AURASUTRA-REVIEWS:ai_search_real_rating
            // Was `rating: 4.5 + (Math.random() * 0.5)` — a fresh random score on
            // every request, so every AI match displayed 4.5-5.0 whether or not the
            // doctor had ever been reviewed. Now the real trigger-maintained
            // aggregate, null until the first review lands.
            avgRating: doctor.avg_rating != null ? Number(doctor.avg_rating) : null,
            totalReviews: Number(doctor.total_reviews ?? 0),
            matchScore: Math.round(matchScore),
            reason: getReasonForRecommendation(primarySpec, symptoms),
            did: doctor.did,
            profileImageUrl: doctor.user?.profileImageUrl || null,
        };
    }).sort((a, b) => b.matchScore - a.matchScore);
}

function getReasonForRecommendation(specialization: string, symptoms: string): string {
    const reasons: { [key: string]: string } = {
        'Panchakarma Specialist': 'Panchakarma therapy is highly effective for detoxification, digestive disorders, and chronic pain management',
        'Rasayana (Rejuvenation)': 'Rasayana treatments focus on rejuvenation, stress relief, immunity building, and mental wellness',
        'Kayachikitsa (Internal Medicine)': 'Specializes in internal medicine with a holistic approach to treating various systemic conditions',
        'Shalakya Tantra (ENT & Ophthalmology)': 'Expert in treating ear, nose, throat, and eye-related disorders using Ayurvedic principles',
        'Kaumara Bhritya (Pediatrics)': 'Specialized in child health care, growth, and development using gentle Ayurvedic treatments',
        'Prasuti Tantra (Gynecology & Obstetrics)': 'Focused on women\'s health, reproductive wellness, and pregnancy care through Ayurveda',
        'General Ayurveda': 'Experienced in treating a wide range of conditions with personalized Ayurvedic care',
    };
    return reasons[specialization] || 'Comprehensive Ayurvedic treatment with proven expertise in patient care';
}
