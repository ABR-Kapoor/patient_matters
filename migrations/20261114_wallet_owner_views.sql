-- Fix wallet ownership: a ledger row may reference both did and pid for display,
-- but balances must only include the leg owned by that wallet.
-- Apply after 20261113_wallet_ledger.sql. Idempotent.

BEGIN;

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

COMMIT;

