import { NextResponse, NextRequest } from 'next/server';
import { verifyClerkUser } from '@/lib/clerk-verify';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        // Use verifyClerkUser to get authenticated user from Clerk
        const clerkUser = await verifyClerkUser();

        if (!clerkUser?.id) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        // Check if user exists in database by auth_id or email
        const [existingUser] = await sql`
            SELECT * FROM users WHERE auth_id = ${clerkUser.id} OR email = ${clerkUser.email || ''} LIMIT 1
        `;

        if (existingUser) {
            if (existingUser.role === 'doctor') {
                return NextResponse.json(
                    { error: 'Doctor accounts cannot access the patient portal', code: 'ROLE_MISMATCH' },
                    { status: 403 }
                );
            }

            // Update role to 'patient' since they're logging in through patient_view
            // Also update auth_id in case they are migrating to the new Clerk project
            // Sync profile image and name from provider if database value is missing or generic
            const profileImageUrl = existingUser.profile_image_url || existingUser.profileImageUrl || clerkUser.picture || null;
            const currentName = existingUser.name || '';
            const clerkName = `${clerkUser.given_name || ''} ${clerkUser.family_name || ''}`.trim();
            const shouldUpdateName = !currentName || currentName.toLowerCase() === 'user' || currentName.toLowerCase() === 'profile';

            const [updatedUser] = await sql`
                UPDATE users
                SET last_login = ${new Date().toISOString()},
                    auth_id = ${clerkUser.id},
                    profile_image_url = ${profileImageUrl},
                    name = ${shouldUpdateName && clerkName ? clerkName : currentName}
                WHERE uid = ${existingUser.uid}
                RETURNING *
            `;

            return NextResponse.json({ user: updatedUser || existingUser });
        }

        // Create new user with profile picture if available
        const [newUser] = await sql`
            INSERT INTO users (auth_id, email, name, role, is_verified, profile_image_url, last_login)
            VALUES (
                ${clerkUser.id},
                ${clerkUser.email || ''},
                ${`${clerkUser.given_name || ''} ${clerkUser.family_name || ''}`.trim() || 'User'},
                'patient',
                true,
                ${clerkUser.picture || null},
                ${new Date().toISOString()}
            )
            RETURNING *
        `;

        return NextResponse.json({ user: newUser, isNew: true });
    } catch (error) {
        console.error('Sync error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
