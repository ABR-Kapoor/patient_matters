import { NextResponse } from 'next/server';
import { requirePatient } from '@/lib/authz';

export const dynamic = 'force-dynamic';

export async function GET() {
    const auth = await requirePatient();
    if (!auth.ok) return auth.response;

    return NextResponse.json({
        success: false,
        code: 'CLIENT_UPDATE_REQUIRED',
        error: 'Please update the app to use the new calling experience.',
    }, { status: 410 });
}
