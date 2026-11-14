-- Doctor/patient wallet ledger, payout requests and refund settlement.
-- Apply ONCE against the shared patient/doctor database:
--   psql "$DATABASE_URL" -f migrations/20261113_wallet_ledger.sql
-- The file is idempotent and safe to re-run.

BEGIN;

-- ---------------------------------------------------------------------------
-- Payout requests (admin processes these outside this repo)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payout_requests (
    payout_request_id uuid DEFAULT gen_random_uuid() NOT NULL,
    did uuid NOT NULL REFERENCES public.doctors(did) ON DELETE CASCADE,
    amount numeric(10,2) NOT NULL,
    payout_fee_amount numeric(10,2) DEFAULT 9 NOT NULL,
    net_amount numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'INR' NOT NULL,
    status character varying(20) DEFAULT 'pending' NOT NULL,
    payout_method character varying(20),
    bank_account_holder_name character varying(255),
    bank_account_number character varying(100),
    bank_ifsc_code character varying(20),
    bank_name character varying(255),
    bank_account_type character varying(50),
    bank_branch_name character varying(255),
    payout_upi_id character varying(255),
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    processed_by text,
    failure_reason text,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payout_requests_amount_check CHECK (amount > 0),
    CONSTRAINT payout_requests_fee_check CHECK (payout_fee_amount >= 0),
    CONSTRAINT payout_requests_net_check CHECK (net_amount = amount - payout_fee_amount),
    CONSTRAINT payout_requests_status_check CHECK (
        status IN ('pending', 'processing', 'processed', 'rejected', 'failed', 'cancelled')
    ),
    CONSTRAINT payout_requests_pkey PRIMARY KEY (payout_request_id)
);

CREATE INDEX IF NOT EXISTS payout_requests_did_created_idx
    ON public.payout_requests (did, requested_at DESC);

CREATE INDEX IF NOT EXISTS payout_requests_status_idx
    ON public.payout_requests (status);

-- A doctor can only have one open payout request at a time so a wallet cannot
-- be double-held by concurrent requests.
CREATE UNIQUE INDEX IF NOT EXISTS payout_requests_one_open_per_doctor_uniq
    ON public.payout_requests (did)
    WHERE status IN ('pending', 'processing');

-- ---------------------------------------------------------------------------
-- Wallet ledger (single source of truth; balances are derived, never stored)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    wallet_transaction_id uuid DEFAULT gen_random_uuid() NOT NULL,
    did uuid REFERENCES public.doctors(did) ON DELETE CASCADE,
    pid uuid REFERENCES public.patients(pid) ON DELETE CASCADE,
    aid uuid REFERENCES public.appointments(aid) ON DELETE SET NULL,
    direction character varying(10) NOT NULL,
    category character varying(30) NOT NULL,
    status character varying(20) DEFAULT 'completed' NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'INR' NOT NULL,
    description text,
    reference_type character varying(40),
    reference_id text,
    finance_transaction_id uuid REFERENCES public.finance_transactions(transaction_id) ON DELETE SET NULL,
    payout_request_id uuid REFERENCES public.payout_requests(payout_request_id) ON DELETE SET NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT wallet_transactions_pkey PRIMARY KEY (wallet_transaction_id),
    CONSTRAINT wallet_transactions_owner_check CHECK (did IS NOT NULL OR pid IS NOT NULL),
    CONSTRAINT wallet_transactions_direction_check CHECK (direction IN ('credit', 'debit')),
    CONSTRAINT wallet_transactions_category_check CHECK (
        category IN ('consultation', 'refund', 'payout', 'payout_fee', 'adjustment')
    ),
    CONSTRAINT wallet_transactions_status_check CHECK (
        status IN ('pending', 'completed', 'failed', 'reversed')
    ),
    CONSTRAINT wallet_transactions_amount_check CHECK (amount > 0)
);

-- Idempotency key: one row per reference/category/direction. Consultation
-- payments produce a doctor credit and a patient debit (different direction),
-- so both coexist; payout hold and completion reuse the same pending row.
CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_reference_uniq
    ON public.wallet_transactions (reference_type, reference_id, category, direction)
    WHERE reference_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS wallet_transactions_did_created_idx
    ON public.wallet_transactions (did, created_at DESC)
    WHERE did IS NOT NULL;

CREATE INDEX IF NOT EXISTS wallet_transactions_pid_created_idx
    ON public.wallet_transactions (pid, created_at DESC)
    WHERE pid IS NOT NULL;

CREATE INDEX IF NOT EXISTS wallet_transactions_status_idx
    ON public.wallet_transactions (status);

CREATE INDEX IF NOT EXISTS wallet_transactions_aid_idx
    ON public.wallet_transactions (aid)
    WHERE aid IS NOT NULL;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS update_payout_requests_updated_at ON public.payout_requests;
CREATE TRIGGER update_payout_requests_updated_at
    BEFORE UPDATE ON public.payout_requests
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_wallet_transactions_updated_at ON public.wallet_transactions;
CREATE TRIGGER update_wallet_transactions_updated_at
    BEFORE UPDATE ON public.wallet_transactions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Payout lifecycle: request holds funds, processing completes them
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.wallet_hold_payout_on_request()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.wallet_transactions (
        did, direction, category, status, amount, currency, description,
        reference_type, reference_id, payout_request_id, metadata
    )
    VALUES (
        NEW.did, 'debit', 'payout', 'pending', NEW.amount, NEW.currency,
        'Payout request hold', 'payout_request', NEW.payout_request_id::text,
        NEW.payout_request_id,
        jsonb_build_object('payout_method', NEW.payout_method)
    )
    ON CONFLICT DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wallet_hold_payout_on_request ON public.payout_requests;
CREATE TRIGGER wallet_hold_payout_on_request
    AFTER INSERT ON public.payout_requests
    FOR EACH ROW EXECUTE FUNCTION public.wallet_hold_payout_on_request();

CREATE OR REPLACE FUNCTION public.wallet_settle_payout_on_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_doctor_uid uuid;
BEGIN
    IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
        RETURN NEW;
    END IF;

    IF NEW.status = 'processed' THEN
        -- Release the hold as a completed debit.
        UPDATE public.wallet_transactions
           SET status = 'completed',
               description = 'Payout processed',
               metadata = metadata || jsonb_build_object(
                   'processed_at', NEW.processed_at,
                   'processed_by', NEW.processed_by
               )
         WHERE payout_request_id = NEW.payout_request_id
           AND category = 'payout'
           AND status = 'pending';

        -- Payout fee is only charged when the payout actually completes.
        IF NEW.payout_fee_amount > 0 THEN
            INSERT INTO public.wallet_transactions (
                did, direction, category, status, amount, currency, description,
                reference_type, reference_id, payout_request_id, metadata
            )
            VALUES (
                NEW.did, 'debit', 'payout_fee', 'completed', NEW.payout_fee_amount,
                NEW.currency, 'Payout processing fee', 'payout_fee',
                NEW.payout_request_id::text, NEW.payout_request_id,
                jsonb_build_object('payout_request_id', NEW.payout_request_id)
            )
            ON CONFLICT DO NOTHING;
        END IF;

        SELECT uid INTO v_doctor_uid FROM public.doctors WHERE did = NEW.did;
        IF v_doctor_uid IS NOT NULL THEN
            INSERT INTO public.notifications (uid, title, body, type, action_url, metadata)
            VALUES (
                v_doctor_uid,
                'Payout processed',
                'Your payout of ' || NEW.currency || ' ' || to_char(NEW.net_amount, 'FM999999990.00') ||
                    ' has been processed.',
                'payment',
                '/dashboard/finance',
                jsonb_build_object(
                    'event_key', 'payout_processed:' || NEW.payout_request_id,
                    'payout_request_id', NEW.payout_request_id
                )
            )
            ON CONFLICT DO NOTHING;
        END IF;
    ELSIF NEW.status IN ('rejected', 'failed', 'cancelled') THEN
        -- Release the pending hold without ever charging the doctor.
        UPDATE public.wallet_transactions
           SET status = 'reversed',
               description = 'Payout request ' || NEW.status,
               metadata = metadata || jsonb_build_object(
                   'failure_reason', NEW.failure_reason,
                   'status', NEW.status
               )
         WHERE payout_request_id = NEW.payout_request_id
           AND category = 'payout'
           AND status = 'pending';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wallet_settle_payout_on_status ON public.payout_requests;
CREATE TRIGGER wallet_settle_payout_on_status
    AFTER UPDATE OF status ON public.payout_requests
    FOR EACH ROW EXECUTE FUNCTION public.wallet_settle_payout_on_status();

-- ---------------------------------------------------------------------------
-- Refund settlement: external admin flips refund_requests.status='processed'
-- and the ledger debits the doctor (pro-rata, capped) and credits the patient.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.wallet_settle_refund_on_processed()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_paid_amount numeric(10,2) := 0;
    v_doctor_credit numeric(10,2) := 0;
    v_doctor_debit numeric(10,2) := 0;
    v_patient_uid uuid;
    v_transaction_id uuid;
BEGIN
    IF NEW.status <> 'processed' OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
        RETURN NEW;
    END IF;

    SELECT ft.transaction_id, ft.amount
      INTO v_transaction_id, v_paid_amount
      FROM public.finance_transactions ft
     WHERE ft.aid = NEW.aid
       AND ft.transaction_type = 'consultation'
       AND ft.status = 'paid'
     ORDER BY ft.paid_at DESC NULLS LAST, ft.created_at DESC
     LIMIT 1;

    IF v_transaction_id IS NOT NULL THEN
        SELECT COALESCE(SUM(wt.amount), 0)
          INTO v_doctor_credit
          FROM public.wallet_transactions wt
         WHERE wt.finance_transaction_id = v_transaction_id
           AND wt.category = 'consultation'
           AND wt.direction = 'credit'
           AND wt.status = 'completed';
    END IF;

    IF v_doctor_credit > 0 AND v_paid_amount > 0 THEN
        -- Doctor bears the refund proportionally to their net credit.
        v_doctor_debit := LEAST(
            v_doctor_credit,
            ROUND(v_doctor_credit * LEAST(NEW.amount, v_paid_amount) / v_paid_amount, 2)
        );
    END IF;

    IF v_doctor_debit > 0 THEN
        INSERT INTO public.wallet_transactions (
            did, pid, aid, direction, category, status, amount, currency, description,
            reference_type, reference_id, finance_transaction_id, metadata
        )
        VALUES (
            NEW.did, NEW.pid, NEW.aid, 'debit', 'refund', 'completed', v_doctor_debit,
            'INR', 'Refund to patient', 'refund_request', NEW.refund_id::text,
            v_transaction_id, jsonb_build_object('refund_type', NEW.refund_type)
        )
        ON CONFLICT DO NOTHING;
    END IF;

    INSERT INTO public.wallet_transactions (
        did, pid, aid, direction, category, status, amount, currency, description,
        reference_type, reference_id, finance_transaction_id, metadata
    )
    VALUES (
        NEW.did, NEW.pid, NEW.aid, 'credit', 'refund', 'completed', NEW.amount,
        'INR', 'Refund credited from ' || COALESCE(NEW.reason, 'refund'),
        'refund_request', NEW.refund_id::text, v_transaction_id,
        jsonb_build_object('refund_type', NEW.refund_type)
    )
    ON CONFLICT DO NOTHING;

    SELECT uid INTO v_patient_uid FROM public.patients WHERE pid = NEW.pid;
    IF v_patient_uid IS NOT NULL THEN
        INSERT INTO public.notifications (uid, title, body, type, action_url, metadata)
        VALUES (
            v_patient_uid,
            'Refund credited',
            'A refund of INR ' || to_char(NEW.amount, 'FM999999990.00') ||
                ' has been credited to your wallet.',
            'payment',
            '/dashboard/transactions',
            jsonb_build_object(
                'event_key', 'refund_credited:' || NEW.refund_id,
                'refund_id', NEW.refund_id
            )
        )
        ON CONFLICT DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wallet_settle_refund_on_processed ON public.refund_requests;
CREATE TRIGGER wallet_settle_refund_on_processed
    AFTER UPDATE OF status ON public.refund_requests
    FOR EACH ROW EXECUTE FUNCTION public.wallet_settle_refund_on_processed();

-- ---------------------------------------------------------------------------
-- Derived balance views
-- ---------------------------------------------------------------------------

-- A single ledger row can reference both the doctor and the patient for
-- display/joins. Ownership is derived from category + direction so that the
-- doctor balance never includes the patient's payment leg (and vice versa).
CREATE OR REPLACE FUNCTION public.wallet_owner_role(p_category text, p_direction text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN p_category IN ('payout', 'payout_fee') THEN 'doctor'
        WHEN p_category = 'consultation' AND p_direction = 'credit' THEN 'doctor'
        WHEN p_category = 'consultation' AND p_direction = 'debit' THEN 'patient'
        WHEN p_category = 'refund' AND p_direction = 'debit' THEN 'doctor'
        WHEN p_category = 'refund' AND p_direction = 'credit' THEN 'patient'
        WHEN p_category = 'adjustment' THEN 'doctor'
        ELSE NULL
    END
$$;

CREATE OR REPLACE VIEW public.v_doctor_wallet_balances AS
SELECT
    d.did,
    COALESCE(SUM(wt.amount) FILTER (
        WHERE wt.status = 'completed' AND wt.direction = 'credit'
    ), 0)::numeric(12,2) AS lifetime_credited,
    COALESCE(SUM(wt.amount) FILTER (
        WHERE wt.status = 'completed' AND wt.direction = 'debit'
    ), 0)::numeric(12,2) AS lifetime_debited,
    COALESCE(SUM(wt.amount) FILTER (
        WHERE wt.status = 'pending' AND wt.direction = 'debit'
    ), 0)::numeric(12,2) AS held_amount,
    (
        COALESCE(SUM(wt.amount) FILTER (
            WHERE wt.status = 'completed' AND wt.direction = 'credit'
        ), 0)
        - COALESCE(SUM(wt.amount) FILTER (
            WHERE wt.status = 'completed' AND wt.direction = 'debit'
        ), 0)
        - COALESCE(SUM(wt.amount) FILTER (
            WHERE wt.status = 'pending' AND wt.direction = 'debit'
        ), 0)
    )::numeric(12,2) AS available_balance,
    COALESCE(SUM(wt.amount) FILTER (
        WHERE wt.status = 'completed' AND wt.direction = 'debit' AND wt.category = 'payout'
    ), 0)::numeric(12,2) AS lifetime_withdrawn,
    COALESCE(SUM(wt.amount) FILTER (
        WHERE wt.status = 'completed' AND wt.direction = 'debit' AND wt.category = 'payout_fee'
    ), 0)::numeric(12,2) AS lifetime_payout_fees,
    MAX(wt.created_at) AS last_transaction_at
FROM public.doctors d
LEFT JOIN public.wallet_transactions wt
    ON wt.did = d.did
   AND public.wallet_owner_role(wt.category, wt.direction) = 'doctor'
GROUP BY d.did;

CREATE OR REPLACE VIEW public.v_patient_wallet_summary AS
SELECT
    p.pid,
    COALESCE(SUM(wt.amount) FILTER (
        WHERE wt.status = 'completed' AND wt.direction = 'credit'
    ), 0)::numeric(12,2) AS lifetime_credited,
    COALESCE(SUM(wt.amount) FILTER (
        WHERE wt.status = 'completed' AND wt.direction = 'debit'
    ), 0)::numeric(12,2) AS lifetime_debited,
    -- Patients can only hold refund credits; consultation payments are spend
    -- history and must not make the displayed balance negative.
    COALESCE(SUM(wt.amount) FILTER (
        WHERE wt.status = 'completed' AND wt.direction = 'credit'
    ), 0)::numeric(12,2) AS wallet_balance,
    MAX(wt.created_at) AS last_transaction_at
FROM public.patients p
LEFT JOIN public.wallet_transactions wt
    ON wt.pid = p.pid
   AND public.wallet_owner_role(wt.category, wt.direction) = 'patient'
GROUP BY p.pid;

-- ---------------------------------------------------------------------------
-- Backfill: existing paid consultations and processed refunds
-- ---------------------------------------------------------------------------

-- Doctor earnings from existing paid consultations.
INSERT INTO public.wallet_transactions (
    did, pid, aid, direction, category, status, amount, currency, description,
    reference_type, reference_id, finance_transaction_id, metadata, created_at
)
SELECT
    ft.did,
    ft.pid,
    ft.aid,
    'credit',
    'consultation',
    'completed',
    COALESCE(ft.final_net_amount, ft.doctor_net_amount, ft.amount),
    COALESCE(ft.currency, 'INR'),
    'Consultation earnings',
    'finance_transaction',
    ft.transaction_id::text,
    ft.transaction_id,
    jsonb_build_object('backfilled', true),
    COALESCE(ft.paid_at, ft.created_at, now())
FROM public.finance_transactions ft
WHERE ft.transaction_type = 'consultation'
  AND ft.status = 'paid'
  AND ft.did IS NOT NULL
  AND COALESCE(ft.final_net_amount, ft.doctor_net_amount, ft.amount) > 0
ON CONFLICT DO NOTHING;

-- Patient payments for existing paid consultations (spend history only).
INSERT INTO public.wallet_transactions (
    did, pid, aid, direction, category, status, amount, currency, description,
    reference_type, reference_id, finance_transaction_id, metadata, created_at
)
SELECT
    ft.did,
    ft.pid,
    ft.aid,
    'debit',
    'consultation',
    'completed',
    ft.amount,
    COALESCE(ft.currency, 'INR'),
    'Consultation payment',
    'finance_transaction',
    ft.transaction_id::text,
    ft.transaction_id,
    jsonb_build_object('backfilled', true),
    COALESCE(ft.paid_at, ft.created_at, now())
FROM public.finance_transactions ft
WHERE ft.transaction_type = 'consultation'
  AND ft.status = 'paid'
  AND ft.amount > 0
ON CONFLICT DO NOTHING;

-- Refunds already marked processed before this migration.
WITH refund_context AS (
    SELECT
        rr.refund_id,
        rr.did,
        rr.pid,
        rr.aid,
        rr.amount AS refund_amount,
        rr.refund_type,
        ft.transaction_id AS finance_transaction_id,
        ft.amount AS paid_amount,
        COALESCE((
            SELECT SUM(wt.amount)
              FROM public.wallet_transactions wt
             WHERE wt.finance_transaction_id = ft.transaction_id
               AND wt.category = 'consultation'
               AND wt.direction = 'credit'
               AND wt.status = 'completed'
        ), 0) AS doctor_credit
    FROM public.refund_requests rr
    LEFT JOIN LATERAL (
        SELECT ft.transaction_id, ft.amount
          FROM public.finance_transactions ft
         WHERE ft.aid = rr.aid
           AND ft.transaction_type = 'consultation'
           AND ft.status = 'paid'
         ORDER BY ft.paid_at DESC NULLS LAST, ft.created_at DESC
         LIMIT 1
    ) ft ON true
    WHERE rr.status = 'processed'
)
INSERT INTO public.wallet_transactions (
    did, pid, aid, direction, category, status, amount, currency, description,
    reference_type, reference_id, finance_transaction_id, metadata
)
SELECT
    rc.did,
    rc.pid,
    rc.aid,
    'debit',
    'refund',
    'completed',
    LEAST(
        rc.doctor_credit,
        ROUND(rc.doctor_credit * LEAST(rc.refund_amount, rc.paid_amount) / NULLIF(rc.paid_amount, 0), 2)
    ),
    'INR',
    'Refund to patient',
    'refund_request',
    rc.refund_id::text,
    rc.finance_transaction_id,
    jsonb_build_object('backfilled', true, 'refund_type', rc.refund_type)
FROM refund_context rc
WHERE rc.doctor_credit > 0
  AND rc.paid_amount > 0
  AND LEAST(
        rc.doctor_credit,
        ROUND(rc.doctor_credit * LEAST(rc.refund_amount, rc.paid_amount) / NULLIF(rc.paid_amount, 0), 2)
      ) > 0
ON CONFLICT DO NOTHING;

WITH refund_context AS (
    SELECT
        rr.refund_id,
        rr.did,
        rr.pid,
        rr.aid,
        rr.amount AS refund_amount,
        rr.refund_type,
        ft.transaction_id AS finance_transaction_id
    FROM public.refund_requests rr
    LEFT JOIN LATERAL (
        SELECT ft.transaction_id
          FROM public.finance_transactions ft
         WHERE ft.aid = rr.aid
           AND ft.transaction_type = 'consultation'
           AND ft.status = 'paid'
         ORDER BY ft.paid_at DESC NULLS LAST, ft.created_at DESC
         LIMIT 1
    ) ft ON true
    WHERE rr.status = 'processed'
)
INSERT INTO public.wallet_transactions (
    did, pid, aid, direction, category, status, amount, currency, description,
    reference_type, reference_id, finance_transaction_id, metadata
)
SELECT
    rc.did,
    rc.pid,
    rc.aid,
    'credit',
    'refund',
    'completed',
    rc.refund_amount,
    'INR',
    'Refund credited',
    'refund_request',
    rc.refund_id::text,
    rc.finance_transaction_id,
    jsonb_build_object('backfilled', true, 'refund_type', rc.refund_type)
FROM refund_context rc
WHERE rc.refund_amount > 0
ON CONFLICT DO NOTHING;

COMMIT;

