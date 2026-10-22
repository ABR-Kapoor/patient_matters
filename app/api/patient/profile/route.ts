import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requirePatient, type PatientIdentity } from '@/lib/authz';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Columns returned to the client. Previously this route used `SELECT *` on
 * both tables, which leaked `users.auth_id` (the Clerk linkage) and internal
 * bookkeeping fields. Keep this list explicit.
 */
const USER_COLUMNS = `
    u.uid, u.email, u.name, u.phone, u.profile_image_url,
    u.role, u.is_verified, u.created_at
`;

const PATIENT_COLUMNS = `
    p.pid, p.uid, p.date_of_birth, p.gender, p.blood_group,
    p.allergies, p.current_medications, p.chronic_conditions,
    p.address_line1, p.address_line2, p.city, p.state, p.postal_code,
    p.emergency_contact_name, p.emergency_contact_relationship, p.emergency_contact_phone
`;

export async function GET() {
    const auth = await requirePatient();
    if (!auth.ok) return auth.response;

    const [user] = await sql`
        SELECT ${sql.unsafe(USER_COLUMNS)}
        FROM users u
        WHERE u.uid = ${auth.data.uid}
        LIMIT 1
    `;

    const [patient] = await sql`
        SELECT ${sql.unsafe(PATIENT_COLUMNS)}
        FROM patients p
        WHERE p.pid = ${auth.data.pid}
        LIMIT 1
    `;

    return NextResponse.json({
        success: true,
        user: user ?? null,
        patient: patient ?? null,
    });
}

export async function PATCH(request: NextRequest) {
    const auth = await requirePatient();
    if (!auth.ok) return auth.response;

    const identity: PatientIdentity = auth.data;

    try {
        // `uid` is deliberately ignored: the target is always the signed-in
        // patient. A client cannot address another account.
        const { user, patient } = await request.json();

        const cleanedPatient = patient ? {
            date_of_birth: patient.date_of_birth !== undefined ? patient.date_of_birth : (patient.dateOfBirth !== undefined ? patient.dateOfBirth : null),
            gender: patient.gender !== undefined ? patient.gender.toLowerCase() : null,
            blood_group: patient.blood_group !== undefined ? patient.blood_group : (patient.bloodGroup !== undefined ? patient.bloodGroup : null),
            address_line1: patient.address_line1 !== undefined ? patient.address_line1 : (patient.addressLine1 !== undefined ? patient.addressLine1 : null),
            address_line2: patient.address_line2 !== undefined ? patient.address_line2 : (patient.addressLine2 !== undefined ? patient.addressLine2 : null),
            city: patient.city !== undefined ? patient.city : null,
            state: patient.state !== undefined ? patient.state : null,
            postal_code: patient.postal_code !== undefined ? patient.postal_code : (patient.postalCode !== undefined ? patient.postalCode : null),
            emergency_contact_name: patient.emergency_contact_name !== undefined ? patient.emergency_contact_name : (patient.emergencyContactName !== undefined ? patient.emergencyContactName : null),
            emergency_contact_relationship: patient.emergency_contact_relationship !== undefined ? patient.emergency_contact_relationship : (patient.emergencyContactRelationship !== undefined ? patient.emergencyContactRelationship : null),
            emergency_contact_phone: patient.emergency_contact_phone !== undefined ? patient.emergency_contact_phone : (patient.emergencyContactPhone !== undefined ? patient.emergencyContactPhone : null),
            allergies: patient.allergies !== undefined ? patient.allergies : [],
            current_medications: patient.current_medications !== undefined ? patient.current_medications : (patient.currentMedications !== undefined ? patient.currentMedications : []),
            chronic_conditions: patient.chronic_conditions !== undefined ? patient.chronic_conditions : (patient.chronicConditions !== undefined ? patient.chronicConditions : []),
        } : null;

        await sql.begin(async (tx) => {
            // postgres.js types TransactionSql as Omit<Sql,...>, which drops the tagged-template
            // call signature. Re-alias so queries stay type-checked.
            const q = tx as unknown as typeof sql;

            if (user) {
                const setFields: string[] = [];
                const values: any[] = [identity.uid];

                if (user.name !== undefined) {
                    setFields.push('name = $' + (values.length + 1));
                    values.push(user.name);
                }
                if (user.phone !== undefined) {
                    setFields.push('phone = $' + (values.length + 1));
                    values.push(user.phone);
                }
                if (user.profile_image_url !== undefined || user.profileImageUrl !== undefined) {
                    setFields.push('profile_image_url = $' + (values.length + 1));
                    values.push(user.profile_image_url !== undefined ? user.profile_image_url : user.profileImageUrl);
                }

                if (setFields.length > 0) {
                    const updateQuery = `UPDATE users SET ${setFields.join(', ')} WHERE uid = $1`;
                    await q.unsafe(updateQuery, values);
                }
            }

            if (cleanedPatient) {
                await q`
                    UPDATE patients
                    SET date_of_birth = ${cleanedPatient.date_of_birth},
                        gender = ${cleanedPatient.gender},
                        blood_group = ${cleanedPatient.blood_group},
                        address_line1 = ${cleanedPatient.address_line1},
                        address_line2 = ${cleanedPatient.address_line2},
                        city = ${cleanedPatient.city},
                        state = ${cleanedPatient.state},
                        postal_code = ${cleanedPatient.postal_code},
                        emergency_contact_name = ${cleanedPatient.emergency_contact_name},
                        emergency_contact_relationship = ${cleanedPatient.emergency_contact_relationship},
                        emergency_contact_phone = ${cleanedPatient.emergency_contact_phone},
                        allergies = ${cleanedPatient.allergies},
                        current_medications = ${cleanedPatient.current_medications},
                        chronic_conditions = ${cleanedPatient.chronic_conditions}
                    WHERE pid = ${identity.pid}
                `;
            }

            // Create in-app notification for profile update
            await q`
                INSERT INTO notifications (uid, title, body, type, is_read)
                VALUES (
                    ${identity.uid},
                    'Profile Updated',
                    'Your personal and clinical profile information was successfully updated.',
                    'profile',
                    false
                )
            `;
        });

        return NextResponse.json({ success: true, message: 'Profile updated successfully' });
    } catch (error: any) {
        console.error('Profile update error:', error);

        if (error.code === 'P0001' && error.message?.includes('role "doctor"')) {
            return NextResponse.json({
                error: 'ROLE_VIOLATION',
                message: 'You are registered as a doctor and cannot access the patient portal.',
                details: error.message
            }, { status: 403 });
        }

        if (error.code === '23505') {
            const field = error.constraint_name || 'value';
            const isPhone = String(field).includes('phone');
            return NextResponse.json({
                error: 'DUPLICATE_VALUE',
                field,
                message: isPhone
                    ? 'This phone number is already registered to another account. Please use a different number.'
                    : `This ${field} is already in use.`,
                details: error.message
            }, { status: 409 });
        }

        if (error.code === '23503') {
            return NextResponse.json({
                error: 'REFERENCE_ERROR',
                message: 'A related record could not be found. Please sign in again.',
                details: error.message
            }, { status: 400 });
        }

        return NextResponse.json({
            error: 'Failed to update profile',
            details: error.message || 'Unknown error'
        }, { status: 500 });
    }
}
