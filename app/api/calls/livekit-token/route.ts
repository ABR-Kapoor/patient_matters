import { NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';
import sql from '@/lib/db';
import { requirePatient, loadAppointmentForToken } from '@/lib/authz';

// A consultation is far shorter than this, but a long-lived token means a client that
// reconnects mid-call (network handover, backgrounding) does not have to fetch a new one.
const TOKEN_TTL = '2h';

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

        // The room is fully client-controlled, and this route previously minted a
        // token for whatever room and whatever identity the body asked for. Any
        // authenticated patient could therefore join another patient's
        // consultation. The room must now resolve to an appointment the caller
        // is actually the patient on.
        if (!roomId.startsWith(ROOM_PREFIX)) {
            return NextResponse.json({ success: false, error: 'Invalid room' }, { status: 400 });
        }

        const aid = roomId.slice(ROOM_PREFIX.length);
        if (!/^[0-9a-f-]{36}$/i.test(aid)) {
            return NextResponse.json({ success: false, error: 'Invalid room' }, { status: 400 });
        }

        const appointment = await loadAppointmentForToken(aid);
        if (!appointment) {
            return NextResponse.json({ success: false, error: 'Appointment not found' }, { status: 404 });
        }

        if (appointment.pid !== pid) {
            return NextResponse.json({ success: false, error: 'You are not a participant in this consultation' }, { status: 403 });
        }

        const apiKey = process.env.LIVEKIT_API_KEY;
        const apiSecret = process.env.LIVEKIT_API_SECRET;
        if (!apiKey || !apiSecret) {
            console.error('LiveKit credentials are not configured on this server');
            return NextResponse.json({ success: false, error: 'Video service not configured' }, { status: 500 });
        }

        // Identity is the Clerk session id, never a body value, so a caller
        // cannot impersonate the doctor or another patient in the room.
        const at = new AccessToken(apiKey, apiSecret, {
            identity: clerkId,
            name: name ? String(name).slice(0, 64) : undefined,
            ttl: TOKEN_TTL,
        });

        // Scoped to the single appointment room: the client can join and publish,
        // but cannot reach any other room on the project.
        at.addGrant({
            room: roomId,
            roomJoin: true,
            canPublish: true,
            canSubscribe: true,
        });

        const token = await at.toJwt();

        return NextResponse.json({ success: true, token });
    } catch (error) {
        console.error('LiveKit Token Error:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
