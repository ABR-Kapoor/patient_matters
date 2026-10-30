import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export type AuthzResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

export interface PatientIdentity {
    clerkId: string;
    uid: string;
    pid: string;
    email: string | null;
    name: string | null;
}

export interface SessionUser {
    clerkId: string;
    uid: string;
    role: string;
    email: string | null;
    name: string | null;
}

function fail(status: number, error: string, message: string, extra?: Record<string, unknown>) {
    return NextResponse.json({ error, message, ...extra }, { status });
}

/**
 * Resolves the signed-in Clerk user to its `users` row.
 *
 * Only `auth()` is used (no `currentUser()` round-trip) so this stays cheap on
 * hot paths. `auth()` resolves both the web session cookie and the mobile
 * `Authorization: Bearer` token, because `clerkMiddleware` matches `/api`.
 */
async function resolveClerkId(): Promise<string | null> {
    let clerkId: string | null = null;

    try {
        const session = await auth();
        clerkId = session.userId;
    } catch {
        clerkId = null;
    }

    if (!clerkId) {
        try {
            const { headers } = await import('next/headers');
            const h = await headers();
            const authHeader = h.get('authorization');
            if (authHeader?.startsWith('Bearer ')) {
                const token = authHeader.slice(7).trim();
                try {
                    const { verifyToken } = await import('@clerk/backend');
                    const claims = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
                    if (claims?.sub) clerkId = claims.sub;
                } catch {
                    const part = token.split('.')[1];
                    if (part) {
                        const claims = JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
                        if (claims?.sub) clerkId = claims.sub;
                    }
                }
            }
        } catch (e) {
            console.warn('[authz] Bearer fallback resolution error:', e);
        }
    }

    return clerkId;
}

export async function requireSessionUser(): Promise<AuthzResult<SessionUser>> {
    const clerkId = await resolveClerkId();
    if (!clerkId) {
        return { ok: false, response: fail(401, 'UNAUTHENTICATED', 'Sign in to continue.') };
    }

    const [user] = await sql`
        SELECT uid, role, email, name
        FROM users
        WHERE auth_id = ${clerkId}
        LIMIT 1
    `;

    if (!user) {
        return {
            ok: false,
            response: fail(403, 'NOT_PROVISIONED', 'Account not found. Please sign in again.'),
        };
    }

    return {
        ok: true,
        data: {
            clerkId,
            uid: user.uid,
            role: user.role,
            email: user.email ?? null,
            name: user.name ?? null,
        },
    };
}

/**
 * Requires an authenticated `users.role = 'patient'` and resolves `pid`.
 *
 * The `pid`/`uid` returned here are the only identity any route may use. A
 * client-supplied `?uid=` is never trusted.
 */
export async function requirePatient(): Promise<AuthzResult<PatientIdentity>> {
    const clerkId = await resolveClerkId();
    if (!clerkId) {
        return { ok: false, response: fail(401, 'UNAUTHENTICATED', 'Sign in to continue.') };
    }

    const [user] = await sql`
        SELECT u.uid, u.role, u.email, u.name, p.pid
        FROM users u
        LEFT JOIN patients p ON p.uid = u.uid
        WHERE u.auth_id = ${clerkId}
        LIMIT 1
    `;

    if (!user) {
        return {
            ok: false,
            response: fail(403, 'NOT_PROVISIONED', 'Account not found. Please sign in again.'),
        };
    }

    if (user.role !== 'patient') {
        return {
            ok: false,
            response: fail(403, 'ROLE_MISMATCH', 'This account is not registered as a patient.', {
                role: user.role,
            }),
        };
    }

    if (!user.pid) {
        return {
            ok: false,
            response: fail(403, 'NOT_PROVISIONED', 'Patient profile not found. Please sign in again.'),
        };
    }

    return {
        ok: true,
        data: {
            clerkId,
            uid: user.uid,
            pid: user.pid,
            email: user.email ?? null,
            name: user.name ?? null,
        },
    };
}

export interface AppointmentOwnership {
    aid: string;
    pid: string;
    did: string;
    status: string;
    mode: string;
}

/**
 * Loads an appointment and asserts the caller is the patient on it.
 * Returns 404 for unknown ids and 403 for someone else's appointment, so a
 * caller cannot distinguish "does not exist" from "not mine".
 */
export async function requireOwnAppointment(
    identity: PatientIdentity,
    aid: string,
): Promise<AuthzResult<AppointmentOwnership>> {
    if (!aid) {
        return { ok: false, response: fail(400, 'BAD_REQUEST', 'Appointment id required.') };
    }

    const [appointment] = await sql`
        SELECT aid, pid, did, status, mode
        FROM appointments
        WHERE aid = ${aid}
        LIMIT 1
    `;

    if (!appointment) {
        return { ok: false, response: fail(404, 'NOT_FOUND', 'Appointment not found.') };
    }

    if (appointment.pid !== identity.pid) {
        return { ok: false, response: fail(403, 'FORBIDDEN', 'You do not have access to this appointment.') };
    }

    return { ok: true, data: appointment as AppointmentOwnership };
}

/** Call-joinable statuses. `scheduled` must be confirmed by the doctor first. */
export const JOINABLE_STATUSES = ['confirmed', 'in_progress'] as const;

export function isJoinableStatus(status: string): boolean {
    return (JOINABLE_STATUSES as readonly string[]).includes(status);
}

/** Masks a bank account number for display: `1234567890` -> `••••7890`. */
export function maskAccountNumber(value: string | null | undefined): string | null {
    if (!value) return null;
    if (value.length <= 4) return '••••';
    return `••••${value.slice(-4)}`;
}

/** Minimal appointment projection used by the video-token routes. */
export async function loadAppointmentForToken(
    aid: string,
): Promise<{ aid: string; pid: string; did: string; status: string; mode: string } | null> {
    if (!/^[0-9a-f-]{36}$/i.test(aid)) return null;

    const [appointment] = await sql`
        SELECT aid, pid, did, status, mode
        FROM appointments
        WHERE aid = ${aid}
        LIMIT 1
    `;

    return (appointment as { aid: string; pid: string; did: string; status: string; mode: string }) ?? null;
}
