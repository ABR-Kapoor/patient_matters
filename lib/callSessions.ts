import sql from '@/lib/db';
import { isJoinableStatus } from '@/lib/authz';

export type CallRole = 'patient' | 'doctor';
export type CallStatus = 'ringing' | 'active' | 'rejected' | 'cancelled' | 'expired' | 'ended';
export type CallAction = 'accept' | 'reject' | 'cancel' | 'end';

export interface CallActor {
    uid: string;
    role: CallRole;
}

export interface CallContext {
    aid: string;
    pid: string;
    did: string;
    patient_uid: string;
    doctor_uid: string;
    appointment_status: string;
    mode: string;
    scheduled_date: string | Date;
    scheduled_time: string;
    scheduled_at: Date | string;
    call_opens_at: Date | string;
    db_now: Date | string;
    patient_name: string | null;
    patient_image: string | null;
    doctor_name: string | null;
    doctor_image: string | null;
    doctor_specialization: string[] | null;
}

export interface CallSessionRow {
    id: string;
    aid: string;
    patient_uid: string;
    doctor_uid: string;
    initiator_uid: string;
    initiator_role: CallRole;
    status: CallStatus;
    ring_expires_at: Date | string;
    accepted_at: Date | string | null;
    ended_at: Date | string | null;
    ended_by_uid: string | null;
    end_reason: string | null;
    created_at: Date | string;
    updated_at: Date | string;
}

export interface CallPeer {
    role: CallRole;
    name: string;
    imageUrl: string | null;
    specialization?: string[] | null;
}

export interface CallSessionView {
    id: string;
    aid: string;
    status: CallStatus;
    direction: 'incoming' | 'outgoing' | 'active';
    initiatorRole: CallRole;
    isInitiator: boolean;
    role: CallRole;
    ringExpiresAt: string | null;
    acceptedAt: string | null;
    endedAt: string | null;
    endReason: string | null;
    createdAt: string;
    peer: CallPeer;
    appointment: {
        aid: string;
        status: string;
        mode: string;
        scheduledDate: string | Date;
        scheduledTime: string;
        scheduledAt: string;
        callOpensAt: string;
    };
}

export interface ActiveCallState {
    serverTime: string;
    session: CallSessionView | null;
    recentTerminal: CallSessionView | null;
}

type CallFailure = {
    ok: false;
    status: number;
    code: string;
    message: string;
};

type CallSuccess<T> = {
    ok: true;
    data: T;
};

export type CallResult<T> = CallSuccess<T> | CallFailure;

function iso(value: Date | string | null | undefined): string | null {
    if (!value) return null;
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function asTime(value: Date | string): number {
    return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function fail(status: number, code: string, message: string): CallFailure {
    return { ok: false, status, code, message };
}

export function toSessionView(
    session: CallSessionRow,
    context: CallContext,
    uid: string,
): CallSessionView {
    const role: CallRole = uid === context.patient_uid ? 'patient' : 'doctor';
    const peerRole: CallRole = role === 'patient' ? 'doctor' : 'patient';
    const isInitiator = session.initiator_uid === uid;
    const direction: CallSessionView['direction'] =
        session.status === 'active'
            ? 'active'
            : isInitiator
                ? 'outgoing'
                : 'incoming';

    return {
        id: session.id,
        aid: session.aid,
        status: session.status,
        direction,
        initiatorRole: session.initiator_role,
        isInitiator,
        role,
        ringExpiresAt: iso(session.ring_expires_at),
        acceptedAt: iso(session.accepted_at),
        endedAt: iso(session.ended_at),
        endReason: session.end_reason,
        createdAt: iso(session.created_at) as string,
        peer: {
            role: peerRole,
            name: peerRole === 'patient'
                ? context.patient_name || 'Patient'
                : context.doctor_name || 'Doctor',
            imageUrl: peerRole === 'patient' ? context.patient_image : context.doctor_image,
            specialization: peerRole === 'doctor' ? context.doctor_specialization : null,
        },
        appointment: {
            aid: context.aid,
            status: context.appointment_status,
            mode: context.mode,
            scheduledDate: context.scheduled_date,
            scheduledTime: context.scheduled_time,
            scheduledAt: iso(context.scheduled_at) as string,
            callOpensAt: iso(context.call_opens_at) as string,
        },
    };
}

const CONTEXT_SELECT = sql`
    SELECT
        a.aid,
        a.pid,
        a.did,
        p.uid AS patient_uid,
        d.uid AS doctor_uid,
        a.status AS appointment_status,
        a.mode,
        a.scheduled_date,
        a.scheduled_time,
        ((a.scheduled_date + a.scheduled_time) AT TIME ZONE 'Asia/Kolkata') AS scheduled_at,
        (((a.scheduled_date + a.scheduled_time) AT TIME ZONE 'Asia/Kolkata') - interval '10 minutes') AS call_opens_at,
        NOW() AS db_now,
        pu.name AS patient_name,
        pu.profile_image_url AS patient_image,
        du.name AS doctor_name,
        du.profile_image_url AS doctor_image,
        d.specialization AS doctor_specialization
    FROM appointments a
    JOIN patients p ON p.pid = a.pid
    JOIN doctors d ON d.did = a.did
    JOIN users pu ON pu.uid = p.uid
    JOIN users du ON du.uid = d.uid
`;

export async function loadCallContext(aid: string): Promise<CallContext | null> {
    if (!/^[0-9a-f-]{36}$/i.test(aid)) return null;
    const [context] = await sql`
        ${CONTEXT_SELECT}
        WHERE a.aid = ${aid}
        LIMIT 1
    `;
    return (context as CallContext) ?? null;
}

async function loadCallContextForUpdate(tx: any, aid: string): Promise<CallContext | null> {
    const [context] = await tx`
        ${CONTEXT_SELECT}
        WHERE a.aid = ${aid}
        FOR UPDATE OF a
    `;
    return (context as CallContext) ?? null;
}

function contextIsCallable(context: CallContext): boolean {
    return (
        context.mode === 'online' &&
        isJoinableStatus(context.appointment_status) &&
        asTime(context.db_now) >= asTime(context.call_opens_at)
    );
}

async function expireOwnStaleRinging(txOrSql: any, uid: string): Promise<void> {
    await txOrSql`
        UPDATE call_sessions
        SET status = 'expired',
            ended_at = COALESCE(ended_at, NOW()),
            end_reason = COALESCE(end_reason, 'no_answer'),
            updated_at = NOW()
        WHERE status = 'ringing'
          AND ring_expires_at <= NOW()
          AND (patient_uid = ${uid} OR doctor_uid = ${uid})
    `;
}

async function expireParticipantStaleRinging(tx: any, patientUid: string, doctorUid: string): Promise<void> {
    await tx`
        UPDATE call_sessions
        SET status = 'expired',
            ended_at = COALESCE(ended_at, NOW()),
            end_reason = COALESCE(end_reason, 'no_answer'),
            updated_at = NOW()
        WHERE status = 'ringing'
          AND ring_expires_at <= NOW()
          AND (
              patient_uid IN (${patientUid}, ${doctorUid})
              OR doctor_uid IN (${patientUid}, ${doctorUid})
          )
    `;
}

async function reconcileOpenSessions(uid: string): Promise<void> {
    await expireOwnStaleRinging(sql, uid);
    await sql`
        UPDATE call_sessions cs
        SET status = 'ended',
            ended_at = COALESCE(cs.ended_at, NOW()),
            end_reason = COALESCE(cs.end_reason, 'appointment_closed'),
            updated_at = NOW()
        FROM appointments a
        WHERE cs.aid = a.aid
          AND cs.status IN ('ringing', 'active')
          AND (cs.patient_uid = ${uid} OR cs.doctor_uid = ${uid})
          AND (a.mode <> 'online' OR a.status NOT IN ('confirmed', 'in_progress'))
    `;
}

async function loadOpenSessionForUser(db: any, uid: string): Promise<CallSessionRow | null> {
    const [session] = await db`
        SELECT *
        FROM call_sessions
        WHERE status IN ('ringing', 'active')
          AND (patient_uid = ${uid} OR doctor_uid = ${uid})
        ORDER BY created_at DESC
        LIMIT 1
    `;
    return (session as CallSessionRow) ?? null;
}

async function loadLatestSessionForAid(db: any, aid: string, forUpdate = false): Promise<CallSessionRow | null> {
    const rows = forUpdate
        ? await db`
            SELECT *
            FROM call_sessions
            WHERE aid = ${aid}
            ORDER BY created_at DESC
            LIMIT 1
            FOR UPDATE
        `
        : await db`
            SELECT *
            FROM call_sessions
            WHERE aid = ${aid}
            ORDER BY created_at DESC
            LIMIT 1
        `;
    return (rows[0] as CallSessionRow) ?? null;
}

async function loadRecentTerminal(db: any, uid: string): Promise<CallSessionRow | null> {
    const [session] = await db`
        SELECT *
        FROM call_sessions
        WHERE status IN ('rejected', 'cancelled', 'expired', 'ended')
          AND (patient_uid = ${uid} OR doctor_uid = ${uid})
          AND updated_at >= NOW() - interval '90 seconds'
        ORDER BY updated_at DESC
        LIMIT 1
    `;
    return (session as CallSessionRow) ?? null;
}

export async function getActiveCallState(uid: string): Promise<ActiveCallState> {
    await reconcileOpenSessions(uid);

    const [clock] = await sql`SELECT NOW() AS now`;
    const session = await loadOpenSessionForUser(sql, uid);
    const context = session ? await loadCallContext(session.aid) : null;
    const recent = session ? null : await loadRecentTerminal(sql, uid);
    const recentContext = recent ? await loadCallContext(recent.aid) : null;

    return {
        serverTime: iso(clock.now) as string,
        session: session && context ? toSessionView(session, context, uid) : null,
        recentTerminal: recent && recentContext ? toSessionView(recent, recentContext, uid) : null,
    };
}

export async function startCallSession(actor: CallActor, aid: string): Promise<CallResult<CallSessionView>> {
    try {
        return await sql.begin(async (tx: any) => {
            const context = await loadCallContextForUpdate(tx, aid);
            if (!context) return fail(404, 'NOT_FOUND', 'Appointment not found.');
            if (actor.uid !== context.patient_uid && actor.uid !== context.doctor_uid) {
                return fail(403, 'FORBIDDEN', 'You do not have access to this appointment.');
            }
            if (!contextIsCallable(context)) {
                return fail(409, 'CALL_NOT_AVAILABLE', 'This appointment is not available for calling yet.');
            }

            await expireParticipantStaleRinging(tx, context.patient_uid, context.doctor_uid);

            const existing = await loadOpenSessionForUser(tx, actor.uid);
            if (existing) {
                if (existing.aid === aid) {
                    return { ok: true, data: toSessionView(existing, context, actor.uid) };
                }
                return fail(409, 'CALL_BUSY', 'You are already in another call.');
            }

            const [participantConflict] = await tx`
                SELECT id
                FROM call_sessions
                WHERE status IN ('ringing', 'active')
                  AND (
                      patient_uid IN (${context.patient_uid}, ${context.doctor_uid})
                      OR doctor_uid IN (${context.patient_uid}, ${context.doctor_uid})
                  )
                LIMIT 1
            `;
            if (participantConflict) {
                return fail(409, 'CALL_BUSY', 'The other participant is already in another call.');
            }

            const [session] = await tx`
                INSERT INTO call_sessions (
                    aid,
                    patient_uid,
                    doctor_uid,
                    initiator_uid,
                    initiator_role,
                    status,
                    ring_expires_at
                ) VALUES (
                    ${aid},
                    ${context.patient_uid},
                    ${context.doctor_uid},
                    ${actor.uid},
                    ${actor.role},
                    'ringing',
                    NOW() + interval '60 seconds'
                )
                RETURNING *
            `;

            return { ok: true, data: toSessionView(session as CallSessionRow, context, actor.uid) };
        });
    } catch (error: any) {
        if (error?.code === '23505') {
            const context = await loadCallContext(aid);
            const existing = await loadOpenSessionForUser(sql, actor.uid);
            if (context && existing?.aid === aid) {
                return { ok: true, data: toSessionView(existing, context, actor.uid) };
            }
            return fail(409, 'CALL_BUSY', 'The other participant is already in another call.');
        }
        console.error('[CallSessions] start error:', error);
        return fail(500, 'INTERNAL_ERROR', 'Could not start the call.');
    }
}

async function markAppointmentCallStarted(tx: any, aid: string): Promise<void> {
    await tx`
        UPDATE appointments
        SET status = 'in_progress',
            call_started_at = NOW(),
            call_ended_at = NULL,
            duration_minutes = NULL,
            call_duration_minutes = NULL,
            updated_at = NOW()
        WHERE aid = ${aid}
    `;
}

async function markAppointmentCallEnded(tx: any, aid: string, acceptedAt: Date | string | null): Promise<void> {
    await tx`
        UPDATE appointments
        SET call_ended_at = NOW(),
            duration_minutes = CASE
                WHEN ${acceptedAt}::timestamptz IS NULL THEN duration_minutes
                ELSE GREATEST(0, LEAST(1440, ROUND(EXTRACT(EPOCH FROM (NOW() - ${acceptedAt}::timestamptz)) / 60)::int))
            END,
            call_duration_minutes = CASE
                WHEN ${acceptedAt}::timestamptz IS NULL THEN call_duration_minutes
                ELSE GREATEST(0, LEAST(1440, ROUND(EXTRACT(EPOCH FROM (NOW() - ${acceptedAt}::timestamptz)) / 60)::int))
            END,
            updated_at = NOW()
        WHERE aid = ${aid}
    `;
}

export async function performCallAction(
    actor: CallActor,
    aid: string,
    action: CallAction,
): Promise<CallResult<CallSessionView>> {
    if (!/^[0-9a-f-]{36}$/i.test(aid)) {
        return fail(400, 'BAD_REQUEST', 'A valid appointment id is required.');
    }

    try {
        return await sql.begin(async (tx: any) => {
            const context = await loadCallContextForUpdate(tx, aid);
            if (!context) return fail(404, 'NOT_FOUND', 'Appointment not found.');
            if (actor.uid !== context.patient_uid && actor.uid !== context.doctor_uid) {
                return fail(403, 'FORBIDDEN', 'You do not have access to this appointment.');
            }

            const session = await loadLatestSessionForAid(tx, aid, true);
            if (!session) {
                return fail(404, 'NOT_FOUND', 'No call session found for this appointment.');
            }

            if (action === 'accept') {
                if (session.status === 'active') {
                    return { ok: true, data: toSessionView(session, context, actor.uid) };
                }
                if (session.status !== 'ringing') {
                    return fail(409, 'CALL_STATE_CHANGED', 'This call is no longer ringing.');
                }
                if (session.initiator_uid === actor.uid) {
                    return fail(409, 'CANNOT_ACCEPT_OWN_CALL', 'You cannot accept your own call.');
                }
                if (asTime(session.ring_expires_at) <= asTime(context.db_now)) {
                    await tx`
                        UPDATE call_sessions
                        SET status = 'expired', ended_at = NOW(), end_reason = 'no_answer', updated_at = NOW()
                        WHERE id = ${session.id}
                    `;
                    return fail(409, 'CALL_EXPIRED', 'This call has expired.');
                }
                if (!contextIsCallable(context)) {
                    await tx`
                        UPDATE call_sessions
                        SET status = 'ended', ended_at = NOW(), end_reason = 'appointment_closed', updated_at = NOW()
                        WHERE id = ${session.id}
                    `;
                    return fail(409, 'CALL_NOT_AVAILABLE', 'This appointment is no longer available for calling.');
                }

                const [updated] = await tx`
                    UPDATE call_sessions
                    SET status = 'active', accepted_at = NOW(), updated_at = NOW()
                    WHERE id = ${session.id}
                    RETURNING *
                `;
                await markAppointmentCallStarted(tx, aid);
                return { ok: true, data: toSessionView(updated as CallSessionRow, context, actor.uid) };
            }

            if (action === 'reject') {
                if (session.initiator_uid === actor.uid) {
                    return fail(409, 'CANNOT_REJECT_OWN_CALL', 'You cannot reject your own call.');
                }
                if (session.status === 'rejected') {
                    return { ok: true, data: toSessionView(session, context, actor.uid) };
                }
                if (session.status !== 'ringing') {
                    return fail(409, 'CALL_STATE_CHANGED', 'This call is no longer ringing.');
                }
                const [updated] = await tx`
                    UPDATE call_sessions
                    SET status = 'rejected',
                        ended_at = NOW(),
                        ended_by_uid = ${actor.uid},
                        end_reason = 'declined',
                        updated_at = NOW()
                    WHERE id = ${session.id}
                    RETURNING *
                `;
                return { ok: true, data: toSessionView(updated as CallSessionRow, context, actor.uid) };
            }

            if (action === 'cancel') {
                if (session.initiator_uid !== actor.uid) {
                    return fail(409, 'NOT_CALL_INITIATOR', 'Only the caller can cancel the call.');
                }
                if (session.status === 'cancelled') {
                    return { ok: true, data: toSessionView(session, context, actor.uid) };
                }
                if (session.status !== 'ringing') {
                    return fail(409, 'CALL_STATE_CHANGED', 'This call is no longer ringing.');
                }
                const [updated] = await tx`
                    UPDATE call_sessions
                    SET status = 'cancelled',
                        ended_at = NOW(),
                        ended_by_uid = ${actor.uid},
                        end_reason = 'cancelled_by_caller',
                        updated_at = NOW()
                    WHERE id = ${session.id}
                    RETURNING *
                `;
                return { ok: true, data: toSessionView(updated as CallSessionRow, context, actor.uid) };
            }

            if (session.status === 'ended') {
                return { ok: true, data: toSessionView(session, context, actor.uid) };
            }
            if (session.status !== 'active') {
                return fail(409, 'CALL_STATE_CHANGED', 'This call is not active.');
            }

            const [updated] = await tx`
                UPDATE call_sessions
                SET status = 'ended',
                    ended_at = NOW(),
                    ended_by_uid = ${actor.uid},
                    end_reason = 'hung_up',
                    updated_at = NOW()
                WHERE id = ${session.id}
                RETURNING *
            `;
            await markAppointmentCallEnded(tx, aid, session.accepted_at);
            return { ok: true, data: toSessionView(updated as CallSessionRow, context, actor.uid) };
        });
    } catch (error: any) {
        console.error('[CallSessions] action error:', error);
        return fail(500, 'INTERNAL_ERROR', 'Could not update the call.');
    }
}

export async function getActiveSessionForToken(
    actor: CallActor,
    aid: string,
): Promise<CallResult<CallSessionRow>> {
    if (!/^[0-9a-f-]{36}$/i.test(aid)) {
        return fail(400, 'BAD_REQUEST', 'Invalid room');
    }

    const context = await loadCallContext(aid);
    if (!context) return fail(404, 'NOT_FOUND', 'Appointment not found.');
    if (actor.uid !== context.patient_uid && actor.uid !== context.doctor_uid) {
        return fail(403, 'FORBIDDEN', 'You are not a participant in this consultation.');
    }
    if (!contextIsCallable(context)) {
        return fail(403, 'CALL_NOT_AVAILABLE', 'This appointment is not available for calling.');
    }

    const [session] = await sql`
        SELECT *
        FROM call_sessions
        WHERE aid = ${aid}
          AND status = 'active'
          AND (patient_uid = ${actor.uid} OR doctor_uid = ${actor.uid})
        ORDER BY created_at DESC
        LIMIT 1
    `;

    if (!session) {
        return fail(403, 'CALL_NOT_ACTIVE', 'The call has not been accepted.');
    }

    return { ok: true, data: session as CallSessionRow };
}

export async function hasOpenCallForAppointment(aid: string): Promise<boolean> {
    const [row] = await sql`
        SELECT id
        FROM call_sessions
        WHERE aid = ${aid}
          AND status IN ('ringing', 'active')
        LIMIT 1
    `;
    return Boolean(row);
}

export async function closeOpenCallForAppointment(
    aid: string,
    reason: string,
): Promise<{ acceptedAt: Date | string | null }> {
    const [row] = await sql`
        UPDATE call_sessions
        SET status = 'ended',
            ended_at = COALESCE(ended_at, NOW()),
            end_reason = COALESCE(end_reason, ${reason}),
            updated_at = NOW()
        WHERE aid = ${aid}
          AND status IN ('ringing', 'active')
        RETURNING accepted_at
    `;
    return { acceptedAt: row?.accepted_at ?? null };
}

export function callErrorResponse(error: CallFailure): { status: number; body: { success: false; error: string; code: string } } {
    return {
        status: error.status,
        body: {
            success: false,
            error: error.message,
            code: error.code,
        },
    };
}
