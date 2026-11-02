-- Real-time in-app notifications and Expo mobile push tokens.
-- Apply this migration against the shared patient/doctor database before
-- deploying the notification stream and push registration endpoints.

BEGIN;

CREATE TABLE IF NOT EXISTS public.push_tokens (
    token text PRIMARY KEY,
    uid uuid NOT NULL REFERENCES public.users(uid) ON DELETE CASCADE,
    platform character varying(20) NOT NULL DEFAULT 'unknown',
    device_name text,
    created_at timestamp with time zone NOT NULL DEFAULT NOW(),
    updated_at timestamp with time zone NOT NULL DEFAULT NOW(),
    CONSTRAINT push_tokens_platform_check
        CHECK (platform IN ('ios', 'android', 'web', 'unknown'))
);

CREATE INDEX IF NOT EXISTS push_tokens_uid_idx
    ON public.push_tokens (uid);

-- Every lifecycle notification gets an event key so concurrent clients,
-- retries and reconciliation cannot create duplicate rows or duplicate pushes.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_uid_event_key_uniq
    ON public.notifications (uid, ((metadata ->> 'event_key')))
    WHERE metadata ? 'event_key';

CREATE INDEX IF NOT EXISTS notifications_uid_created_at_idx
    ON public.notifications (uid, created_at DESC);

CREATE INDEX IF NOT EXISTS appointments_pid_updated_at_idx
    ON public.appointments (pid, updated_at DESC);

CREATE INDEX IF NOT EXISTS prescriptions_pid_sent_at_idx
    ON public.prescriptions (pid, sent_at DESC)
    WHERE is_active = true AND sent_to_patient = true;

COMMIT;
