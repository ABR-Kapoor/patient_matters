import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requirePatient } from '@/lib/authz';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest) {
    const auth = await requirePatient();
    if (!auth.ok) return auth.response;

    try {
        const { notification_id, markAll } = await request.json();

        if (markAll) {
            await sql`
                UPDATE notifications
                SET is_read = true
                WHERE uid = ${auth.data.uid} AND is_read = false
            `;
            return NextResponse.json({ success: true });
        }

        if (!notification_id) {
            return NextResponse.json({ error: 'Notification ID required' }, { status: 400 });
        }

        // Scoped by uid so a notification_id belonging to another patient is
        // not addressable.
        await sql`
            UPDATE notifications
            SET is_read = true
            WHERE notification_id = ${notification_id} AND uid = ${auth.data.uid}
        `;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating notification:', error);
        return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
    }
}
