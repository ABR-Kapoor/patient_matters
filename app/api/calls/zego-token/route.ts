import { NextResponse } from 'next/server';
import { requirePatient, loadAppointmentForToken } from '@/lib/authz';
import { generateToken04 } from '../../../../lib/zegoServerAssistant';

const ROOM_PREFIX = 'appointment_';

export async function POST(req: Request) {
    const auth = await requirePatient();
    if (!auth.ok) return auth.response;

    const { clerkId, pid, name } = auth.data;

    try {
        const body = await req.json();
        const { roomId } = body;

        if (!roomId || typeof roomId !== 'string') {
            return NextResponse.json({ success: false, error: 'Missing roomId' }, { status: 400 });
        }

        // The room must resolve to an appointment the caller is the patient on;
        // it is not a free-form client string.
        if (!roomId.startsWith(ROOM_PREFIX)) {
            return NextResponse.json({ success: false, error: 'Invalid room' }, { status: 400 });
        }

        const aid = roomId.slice(ROOM_PREFIX.length);
        const appointment = await loadAppointmentForToken(aid);
        if (!appointment) {
            return NextResponse.json({ success: false, error: 'Appointment not found' }, { status: 404 });
        }
        if (appointment.pid !== pid) {
            return NextResponse.json({ success: false, error: 'You are not a participant in this consultation' }, { status: 403 });
        }

        const appId = parseInt(process.env.ZEGO_APP_ID || process.env.NEXT_PUBLIC_ZEGO_APP_ID || '', 10);
        // Fail closed. This used to fall back to a secret hardcoded in the
        // repository, which is a full credential exposure.
        const serverSecret = process.env.ZEGO_SERVER_SECRET;

        if (!appId || Number.isNaN(appId) || !serverSecret) {
            console.error('ZEGO credentials are not configured on this server');
            return NextResponse.json({ success: false, error: 'Video service not configured' }, { status: 500 });
        }

        const effectiveTimeInSeconds = 7200;

        // A UIKit token is NOT a bare Token04. The client SDK's
        // `generateKitTokenForProduction` is literally
        //     `<token04> + "#" + base64({userID, roomID, userName, appID})`
        // and `ZegoUIKitPrebuilt.create()` parses that suffix for the room and
        // identity. Returning the raw token04 made joins fail at runtime, and the
        // previous fix replaced that by exposing the server secret to the browser
        // via `generateKitTokenForTest`. This builds the real thing server-side so
        // the secret never leaves the server.
        //
        // Identity is the Clerk session id and the DB name — never a body value.
        const accessToken = generateToken04(appId, clerkId, serverSecret, effectiveTimeInSeconds, '');
        const kitToken =
            accessToken +
            '#' +
            Buffer.from(
                JSON.stringify({
                    userID: clerkId,
                    roomID: roomId,
                    userName: encodeURIComponent(name || 'Patient'),
                    appID: appId,
                }),
                'utf8'
            ).toString('base64');

        return NextResponse.json({
            success: true,
            token: kitToken,
        });
    } catch (error) {
        console.error('Zego Token Error:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
