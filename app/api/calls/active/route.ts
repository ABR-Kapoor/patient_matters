import { NextResponse } from 'next/server';
import { requirePatient } from '@/lib/authz';
import { getActiveCallState } from '@/lib/callSessions';

export const dynamic = 'force-dynamic';

export async function GET() {
    const auth = await requirePatient();
    if (!auth.ok) return auth.response;

    try {
        const state = await getActiveCallState(auth.data.uid);
        return NextResponse.json({ success: true, ...state });
    } catch (error) {
        console.error('[API] Active call error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
