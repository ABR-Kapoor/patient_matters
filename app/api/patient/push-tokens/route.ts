import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requirePatient } from '@/lib/authz';

export const dynamic = 'force-dynamic';

const VALID_PLATFORMS = new Set(['ios', 'android', 'web', 'unknown']);

function validToken(token: unknown): token is string {
    return typeof token === 'string' && /^(Exponent|Expo)PushToken\[[^\]]+\]$/.test(token);
}

export async function POST(request: NextRequest) {
    const auth = await requirePatient();
    if (!auth.ok) return auth.response;

    try {
        const body = await request.json();
        const token = body?.token;
        if (!validToken(token)) {
            return NextResponse.json({ success: false, error: 'Invalid push token' }, { status: 400 });
        }

        const platform = VALID_PLATFORMS.has(String(body?.platform))
            ? String(body.platform)
            : 'unknown';
        const rawDeviceName = body?.deviceName ?? body?.device_name;
        const deviceName = typeof rawDeviceName === 'string'
            ? rawDeviceName.slice(0, 200)
            : null;

        await sql`
            INSERT INTO push_tokens (token, uid, platform, device_name)
            VALUES (${token}, ${auth.data.uid}, ${platform}, ${deviceName})
            ON CONFLICT (token) DO UPDATE
            SET uid = EXCLUDED.uid,
                platform = EXCLUDED.platform,
                device_name = EXCLUDED.device_name,
                updated_at = NOW()
        `;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[push-tokens POST] failed:', error);
        return NextResponse.json({ success: false, error: 'Failed to register push token' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const auth = await requirePatient();
    if (!auth.ok) return auth.response;

    try {
        const body = await request.json().catch(() => ({}));
        const token = body?.token;
        if (!validToken(token)) {
            return NextResponse.json({ success: false, error: 'Invalid push token' }, { status: 400 });
        }

        await sql`
            DELETE FROM push_tokens
            WHERE token = ${token}
              AND uid = ${auth.data.uid}
        `;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[push-tokens DELETE] failed:', error);
        return NextResponse.json({ success: false, error: 'Failed to remove push token' }, { status: 500 });
    }
}
