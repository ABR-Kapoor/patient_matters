-- Dedicated two-way appointment call state.
-- Apply this migration against the shared patient/doctor database before
-- deploying the call-session APIs.

BEGIN;

CREATE TABLE IF NOT EXISTS public.call_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    aid uuid NOT NULL REFERENCES public.appointments(aid) ON DELETE CASCADE,
    patient_uid uuid NOT NULL REFERENCES public.users(uid) ON DELETE CASCADE,
    doctor_uid uuid NOT NULL REFERENCES public.users(uid) ON DELETE CASCADE,
    initiator_uid uuid NOT NULL REFERENCES public.users(uid) ON DELETE CASCADE,
    initiator_role character varying(10) NOT NULL,
    status character varying(20) NOT NULL DEFAULT 'ringing',
    ring_expires_at timestamp with time zone NOT NULL,
    accepted_at timestamp with time zone,
    ended_at timestamp with time zone,
    ended_by_uid uuid REFERENCES public.users(uid) ON DELETE SET NULL,
    end_reason character varying(40),
    created_at timestamp with time zone NOT NULL DEFAULT NOW(),
    updated_at timestamp with time zone NOT NULL DEFAULT NOW(),
    CONSTRAINT call_sessions_initiator_role_check
        CHECK (initiator_role IN ('patient', 'doctor')),
    CONSTRAINT call_sessions_status_check
        CHECK (status IN ('ringing', 'active', 'rejected', 'cancelled', 'expired', 'ended')),
    CONSTRAINT call_sessions_participants_check
        CHECK (patient_uid <> doctor_uid)
);

CREATE UNIQUE INDEX IF NOT EXISTS call_sessions_one_open_per_appointment
    ON public.call_sessions (aid)
    WHERE status IN ('ringing', 'active');

CREATE UNIQUE INDEX IF NOT EXISTS call_sessions_one_open_per_patient
    ON public.call_sessions (patient_uid)
    WHERE status IN ('ringing', 'active');

CREATE UNIQUE INDEX IF NOT EXISTS call_sessions_one_open_per_doctor
    ON public.call_sessions (doctor_uid)
    WHERE status IN ('ringing', 'active');

CREATE INDEX IF NOT EXISTS idx_call_sessions_participant_recent
    ON public.call_sessions (patient_uid, doctor_uid, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_sessions_open_expiry
    ON public.call_sessions (ring_expires_at)
    WHERE status = 'ringing';

-- Preserve an in-flight legacy call across the deployment. Insert latest
-- legacy calls first and skip any row that would violate the one-open-session
-- constraint for either participant.
DO $$
DECLARE
    legacy RECORD;
BEGIN
    FOR legacy IN
        SELECT
            a.aid,
            p.uid AS patient_uid,
            d.uid AS doctor_uid,
            COALESCE(a.call_started_at, NOW()) AS started_at
        FROM public.appointments a
        JOIN public.patients p ON p.pid = a.pid
        JOIN public.doctors d ON d.did = a.did
        WHERE a.status = 'in_progress'
          AND a.mode = 'online'
          AND a.call_started_at IS NOT NULL
          AND a.call_ended_at IS NULL
        ORDER BY a.call_started_at DESC NULLS LAST
    LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM public.call_sessions cs
            WHERE cs.status IN ('ringing', 'active')
              AND (
                  cs.aid = legacy.aid
                  OR cs.patient_uid = legacy.patient_uid
                  OR cs.doctor_uid = legacy.doctor_uid
              )
        ) THEN
            INSERT INTO public.call_sessions (
                aid,
                patient_uid,
                doctor_uid,
                initiator_uid,
                initiator_role,
                status,
                ring_expires_at,
                accepted_at,
                created_at,
                updated_at
            ) VALUES (
                legacy.aid,
                legacy.patient_uid,
                legacy.doctor_uid,
                legacy.patient_uid,
                'patient',
                'active',
                legacy.started_at + interval '60 seconds',
                legacy.started_at,
                legacy.started_at,
                NOW()
            );
        END IF;
    END LOOP;
END
$$;

COMMIT;
