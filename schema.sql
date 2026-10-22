--
-- PostgreSQL database dump
--



-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

--
-- Name: audit_adherence_status_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_adherence_status_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
            BEGIN
                IF NEW.status IS DISTINCT FROM OLD.status THEN
                    INSERT INTO medication_adherence_audit (
                        adherence_id, old_status, new_status, changed_at
                    ) VALUES (
                        NEW.adherence_id, OLD.status, NEW.status, CURRENT_TIMESTAMP
                    );
                END IF;
                RETURN NEW;
            END;
            $$;


--
-- Name: auto_create_adherence_records(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_create_adherence_records() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
                DECLARE
                  medicine_record JSONB;
                  v_medicine_name TEXT;
                  dosage_times TEXT[];
                  time_slot TEXT;
                  curr_date DATE;
                  end_date DATE;
                  duration_days INTEGER;
                  duration_text TEXT;
                BEGIN
                  IF NEW.sent_to_patient = TRUE AND (OLD IS NULL OR OLD.sent_to_patient IS DISTINCT FROM TRUE) THEN
                    FOR medicine_record IN SELECT * FROM jsonb_array_elements(NEW.medicines)
                    LOOP
                      v_medicine_name := medicine_record->>'name';
                      dosage_times := ARRAY(
                        SELECT jsonb_array_elements_text(medicine_record->'times')
                      );
                      duration_text := LOWER(TRIM(medicine_record->>'duration'));
                      duration_days := CASE
                        WHEN duration_text ~ '^\d+\s*day'   THEN (regexp_match(duration_text, '(\d+)'))[1]::INTEGER
                        WHEN duration_text ~ '^\d+\s*week'  THEN (regexp_match(duration_text, '(\d+)'))[1]::INTEGER * 7
                        WHEN duration_text ~ '^\d+\s*month' THEN (regexp_match(duration_text, '(\d+)'))[1]::INTEGER * 30
                        WHEN duration_text ~ '^\d+\s*year'  THEN (regexp_match(duration_text, '(\d+)'))[1]::INTEGER * 365
                        ELSE 7
                      END;
                      IF dosage_times IS NULL OR array_length(dosage_times, 1) IS NULL THEN
                        DECLARE
                          freq_text TEXT := LOWER(TRIM(medicine_record->>'frequency'));
                        BEGIN
                          IF freq_text ~ 'twice' OR freq_text ~ '2 times' OR freq_text ~ 'morning.*night' OR freq_text ~ 'morning.*evening' THEN
                            dosage_times := ARRAY['09:00', '21:00'];
                          ELSIF freq_text ~ 'thrice' OR freq_text ~ '3 times' OR freq_text ~ 'morning.*afternoon.*night' THEN
                            dosage_times := ARRAY['09:00', '14:00', '21:00'];
                          ELSIF freq_text ~ '4 times' OR freq_text ~ 'four times' THEN
                            dosage_times := ARRAY['08:00', '12:00', '16:00', '20:00'];
                          ELSIF freq_text ~ 'bedtime' OR freq_text ~ 'night' THEN
                            dosage_times := ARRAY['22:00'];
                          ELSIF freq_text ~ 'afternoon' OR freq_text ~ 'lunch' THEN
                            dosage_times := ARRAY['14:00'];
                          ELSIF freq_text ~ 'morning' OR freq_text ~ 'breakfast' THEN
                            dosage_times := ARRAY['08:00'];
                          ELSE
                            dosage_times := ARRAY['09:00'];
                          END IF;
                        END;
                      END IF;
                      curr_date := CURRENT_DATE;
                      end_date := curr_date + duration_days;
                      IF dosage_times IS NOT NULL AND array_length(dosage_times, 1) > 0 THEN
                        WHILE curr_date < end_date LOOP
                          FOREACH time_slot IN ARRAY dosage_times LOOP
                            INSERT INTO medication_adherence
                              (prescription_id, pid, medicine_name, scheduled_date, scheduled_time, is_taken, is_skipped, synced)
                            VALUES
                              (NEW.prescription_id, NEW.pid, v_medicine_name, curr_date, time_slot::TIME, false, false, false)
                            ON CONFLICT (prescription_id, medicine_name, scheduled_date, scheduled_time)
                            DO NOTHING;
                          END LOOP;
                          curr_date := curr_date + 1;
                        END LOOP;
                      END IF;
                    END LOOP;
                  END IF;
                  RETURN NEW;
                END;
                $$;


--
-- Name: FUNCTION auto_create_adherence_records(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.auto_create_adherence_records() IS 'Auto-creates medication adherence tracking records when a prescription is sent to a patient';


--
-- Name: auto_generate_receipt(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_generate_receipt() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE v_patient_name TEXT; v_doctor_name TEXT;
BEGIN
    SELECT u.name INTO v_patient_name FROM patients p JOIN users u ON u.uid = p.uid WHERE p.pid = NEW.pid;
    SELECT u.name INTO v_doctor_name FROM doctors d JOIN users u ON u.uid = d.uid WHERE d.did = NEW.did;
    INSERT INTO receipts (transaction_id, receipt_date, pid, did, patient_name, doctor_name,
        consultation_fee, tax_amount, discount_amount, total_amount, payment_method, razorpay_payment_id)
    VALUES (NEW.transaction_id, CURRENT_DATE, NEW.pid, NEW.did,
        COALESCE(v_patient_name,'Patient'), COALESCE(v_doctor_name,'Doctor'),
        COALESCE(NEW.doctor_net_amount,NEW.amount), 0, 0, NEW.amount,
        NEW.payment_method, NEW.razorpay_payment_id)
    ON CONFLICT DO NOTHING;
    RETURN NEW;
END;
$$;


--
-- Name: auto_insert_user_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_insert_user_role() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.role = 'patient' THEN
        INSERT INTO patients (uid)
        VALUES (NEW.uid)
        ON CONFLICT (uid) DO NOTHING;
    ELSIF NEW.role = 'doctor' THEN
        INSERT INTO doctors (uid)
        VALUES (NEW.uid)
        ON CONFLICT (uid) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: auto_manage_user_roles(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_manage_user_roles() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.role = 'patient' THEN
        INSERT INTO patients (uid)
        VALUES (NEW.uid)
        ON CONFLICT (uid) DO NOTHING;
    END IF;

    IF NEW.role = 'doctor' THEN
        INSERT INTO doctors (uid)
        VALUES (NEW.uid)
        ON CONFLICT (uid) DO NOTHING;
    END IF;

    IF NEW.role = 'clinic' THEN
        INSERT INTO clinics (uid, clinic_name)
        VALUES (NEW.uid, COALESCE(NEW.name, 'Unnamed Clinic'))
        ON CONFLICT (uid) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: FUNCTION auto_manage_user_roles(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.auto_manage_user_roles() IS 'Ensures role-specific table records exist when users are created or roles change';


--
-- Name: auto_skip_pending_medications(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_skip_pending_medications() RETURNS void
    LANGUAGE plpgsql
    AS $$
            BEGIN
                UPDATE medication_adherence
                SET is_skipped = true,
                    skip_reason = 'Auto-skipped (6 hours passed)',
                    updated_at = CURRENT_TIMESTAMP
                WHERE is_taken = false 
                  AND is_skipped = false
                  AND (scheduled_date + scheduled_time) < CURRENT_TIMESTAMP - interval '6 hours';
            END;
            $$;


--
-- Name: enforce_doctor_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_doctor_role() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role FROM users WHERE uid = NEW.uid;

    IF user_role IS NULL THEN
        RETURN NEW;
    END IF;

    IF user_role != 'doctor' THEN
        RAISE EXCEPTION 'User % does not have the doctor role (current role: %)', NEW.uid, user_role;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: enforce_patient_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_patient_role() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role FROM users WHERE uid = NEW.uid;

    IF user_role IS NULL THEN
        RETURN NEW;
    END IF;

    IF user_role != 'patient' THEN
        RAISE EXCEPTION 'User % does not have the patient role (current role: %)', NEW.uid, user_role;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: generate_receipt_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_receipt_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.receipt_number IS NULL OR NEW.receipt_number = '' THEN
        NEW.receipt_number := 'RCP-' ||
                             TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' ||
                             LPAD(nextval('receipt_number_seq')::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: generate_token_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_token_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    next_token INTEGER;
BEGIN
    IF NEW.mode IN ('offline', 'in_person') AND NEW.token_number IS NULL THEN
        SELECT COALESCE(MAX(token_number), 0) + 1
        INTO next_token
        FROM appointments
        WHERE did = NEW.did
          AND scheduled_date = NEW.scheduled_date
          AND mode IN ('offline', 'in_person');

        NEW.token_number := next_token;
        NEW.queue_position := next_token;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: refresh_adherence_summary(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_adherence_summary() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY adherence_progress_summary;
    RETURN NULL;
EXCEPTION
    WHEN OTHERS THEN
        REFRESH MATERIALIZED VIEW adherence_progress_summary;
        RETURN NULL;
END;
$$;


--
-- Name: refresh_doctor_rating(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_doctor_rating() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  target_did uuid := COALESCE(NEW.did, OLD.did);
BEGIN
  UPDATE public.doctors d
  SET
    avg_rating = (SELECT ROUND(AVG(r.rating)::numeric, 2) FROM public.reviews r WHERE r.did = target_did AND r.is_published = true),
    total_reviews = (SELECT COUNT(*) FROM public.reviews r WHERE r.did = target_did AND r.is_published = true)
  WHERE d.did = target_did;
  RETURN NULL;
END;
$$;


--
-- Name: set_appointment_completed_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_appointment_completed_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    NEW.completed_at := COALESCE(NEW.call_ended_at, NOW());
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: sync_appointment_payment_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_appointment_payment_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.status = 'paid' AND NEW.aid IS NOT NULL THEN
        UPDATE appointments
        SET payment_status       = 'paid',
            payment_id           = NEW.razorpay_payment_id,
            razorpay_order_id    = NEW.razorpay_order_id,
            razorpay_payment_id  = NEW.razorpay_payment_id
        WHERE aid = NEW.aid AND payment_status != 'paid';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: sync_clinic_doctor_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_clinic_doctor_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE clinics SET
        total_doctors = (SELECT COUNT(*) FROM doctors WHERE clinic_id = COALESCE(NEW.clinic_id, OLD.clinic_id))
    WHERE clinic_id = COALESCE(NEW.clinic_id, OLD.clinic_id);
    RETURN NEW;
END;
$$;


--
-- Name: sync_clinic_name_to_doctors(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_clinic_name_to_doctors() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE doctors
    SET clinic_name = NEW.clinic_name
    WHERE clinic_id = NEW.clinic_id;
    RETURN NEW;
END;
$$;


--
-- Name: sync_doctor_verification_to_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_doctor_verification_to_user() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
        UPDATE users SET is_verified = NEW.is_verified WHERE uid = NEW.uid;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: sync_treated_patients(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_treated_patients() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE doctors SET
        treated_patient_uids = (
            SELECT ARRAY_AGG(DISTINCT u.uid)
            FROM appointments a JOIN patients p ON p.pid = a.pid JOIN users u ON u.uid = p.uid
            WHERE a.did = NEW.did AND a.status != 'cancelled'
        )
    WHERE did = NEW.did;

    UPDATE patients SET
        connected_doctor_uids = (
            SELECT ARRAY_AGG(DISTINCT u.uid)
            FROM appointments a JOIN doctors d ON d.did = a.did JOIN users u ON u.uid = d.uid
            WHERE a.pid = NEW.pid AND a.status != 'cancelled'
        )
    WHERE pid = NEW.pid;
    RETURN NEW;
END;
$$;


--
-- Name: sync_user_role_tables(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_user_role_tables() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.role = 'patient' THEN
        INSERT INTO patients (uid)
        VALUES (NEW.uid)
        ON CONFLICT (uid) DO NOTHING;

        DELETE FROM doctors WHERE uid = NEW.uid;
    END IF;

    IF NEW.role = 'doctor' THEN
        INSERT INTO doctors (uid)
        VALUES (NEW.uid)
        ON CONFLICT (uid) DO NOTHING;

        DELETE FROM patients WHERE uid = NEW.uid;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: update_appointment_aggregates(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_appointment_aggregates() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE patients SET
        total_appointments_count = (SELECT COUNT(*) FROM appointments WHERE pid = NEW.pid),
        last_appointment_date    = (SELECT MAX(scheduled_date) FROM appointments WHERE pid = NEW.pid AND status = 'completed')
    WHERE pid = NEW.pid;

    UPDATE doctors SET
        total_consultations = (SELECT COUNT(*) FROM appointments WHERE did = NEW.did AND status = 'completed')
    WHERE did = NEW.did;
    RETURN NEW;
END;
$$;


--
-- Name: update_doctor_patient_relationship(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_doctor_patient_relationship() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO doctor_patient_relationships (did, pid, first_appointment_date, last_appointment_date, total_appointments)
    VALUES (
        NEW.did,
        NEW.pid,
        NEW.scheduled_date,
        NEW.scheduled_date,
        1
    )
    ON CONFLICT (did, pid) DO UPDATE
    SET
        last_appointment_date = GREATEST(doctor_patient_relationships.last_appointment_date, NEW.scheduled_date),
        total_appointments = doctor_patient_relationships.total_appointments + 1,
        updated_at = CURRENT_TIMESTAMP;

    RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: validate_user_role_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_user_role_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.role NOT IN ('patient', 'doctor', 'admin', 'clinic') THEN
        RAISE EXCEPTION 'Invalid role: %', NEW.role;
    END IF;
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: medication_adherence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.medication_adherence (
    adherence_id uuid DEFAULT gen_random_uuid() NOT NULL,
    prescription_id uuid NOT NULL,
    pid uuid NOT NULL,
    medicine_name character varying(255) NOT NULL,
    scheduled_date date NOT NULL,
    scheduled_time time without time zone NOT NULL,
    taken_at timestamp with time zone,
    is_taken boolean DEFAULT false,
    is_skipped boolean DEFAULT false,
    skip_reason text,
    synced boolean DEFAULT false,
    device_timestamp timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    skipped_at timestamp with time zone,
    status character varying(20) DEFAULT 'pending'::character varying,
    scheduled_at timestamp with time zone,
    auto_skipped boolean DEFAULT false,
    snooze_count integer DEFAULT 0,
    reminder_snoozed_until timestamp with time zone,
    doctor_id uuid,
    snooze_until timestamp with time zone
);


--
-- Name: adherence_progress; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.adherence_progress AS
 SELECT pid,
    prescription_id,
    medicine_name,
    count(*) AS total_doses,
    sum(
        CASE
            WHEN is_taken THEN 1
            ELSE 0
        END) AS taken_doses,
    sum(
        CASE
            WHEN is_skipped THEN 1
            ELSE 0
        END) AS skipped_doses,
    round((((sum(
        CASE
            WHEN is_taken THEN 1
            ELSE 0
        END))::numeric / (NULLIF(count(*), 0))::numeric) * (100)::numeric), 2) AS adherence_percentage
   FROM public.medication_adherence
  GROUP BY pid, prescription_id, medicine_name;


--
-- Name: prescriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prescriptions (
    prescription_id uuid DEFAULT gen_random_uuid() NOT NULL,
    aid uuid,
    pid uuid NOT NULL,
    did uuid NOT NULL,
    diagnosis text NOT NULL,
    symptoms text[],
    medicines jsonb NOT NULL,
    instructions text,
    diet_advice text,
    follow_up_date date,
    follow_up_notes text,
    ai_generated boolean DEFAULT false,
    ai_suggestions jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    sent_to_patient boolean DEFAULT false,
    sent_at timestamp with time zone,
    medicine_system text
);


--
-- Name: adherence_progress_summary; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.adherence_progress_summary AS
 SELECT ma.pid,
    ma.prescription_id,
    p.did,
    ma.medicine_name,
    count(*) AS total_doses,
    sum(
        CASE
            WHEN ma.is_taken THEN 1
            ELSE 0
        END) AS taken_doses,
    sum(
        CASE
            WHEN ma.is_skipped THEN 1
            ELSE 0
        END) AS skipped_doses,
    round((((sum(
        CASE
            WHEN ma.is_taken THEN 1
            ELSE 0
        END))::numeric / (NULLIF(count(*), 0))::numeric) * (100)::numeric), 2) AS adherence_percentage,
    min(ma.scheduled_date) AS start_date,
    max(ma.scheduled_date) AS end_date,
    max(ma.updated_at) AS last_updated
   FROM (public.medication_adherence ma
     JOIN public.prescriptions p ON ((ma.prescription_id = p.prescription_id)))
  WHERE (p.is_active = true)
  GROUP BY ma.pid, ma.prescription_id, p.did, ma.medicine_name
  WITH NO DATA;


--
-- Name: app_storage_buckets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_storage_buckets (
    bucket_key text NOT NULL,
    provider_name character varying(50) DEFAULT 'insfoge'::character varying NOT NULL,
    is_public boolean DEFAULT true NOT NULL,
    max_upload_file_size bigint DEFAULT 5242880 NOT NULL,
    min_upload_file_size bigint DEFAULT 1 NOT NULL,
    cache_control character varying(100) DEFAULT 'max-age=3600'::character varying NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: appointment_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointment_messages (
    message_id uuid DEFAULT gen_random_uuid() NOT NULL,
    aid uuid NOT NULL,
    sender_uid uuid NOT NULL,
    sender_role character varying(20) NOT NULL,
    content text NOT NULL,
    media_url text,
    created_at timestamp with time zone DEFAULT now(),
    read_at timestamp with time zone,
    CONSTRAINT appointment_messages_sender_role_check CHECK (((sender_role)::text = ANY ((ARRAY['patient'::character varying, 'doctor'::character varying])::text[])))
);


--
-- Name: appointments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointments (
    aid uuid DEFAULT gen_random_uuid() NOT NULL,
    pid uuid NOT NULL,
    did uuid NOT NULL,
    mode character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'scheduled'::character varying NOT NULL,
    scheduled_date date NOT NULL,
    scheduled_time time without time zone NOT NULL,
    start_time timestamp with time zone,
    end_time timestamp with time zone,
    duration_minutes integer,
    token_number integer,
    queue_position integer,
    estimated_wait_minutes integer,
    meeting_link text,
    meeting_id character varying(255),
    meeting_password character varying(100),
    chief_complaint text NOT NULL,
    symptoms text[],
    doctor_notes text,
    cancellation_reason text,
    cancelled_by uuid,
    cancelled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    call_started_at timestamp with time zone,
    call_ended_at timestamp with time zone,
    call_duration_minutes integer,
    payment_id text,
    payment_status text DEFAULT 'pending'::text,
    razorpay_order_id character varying(255),
    razorpay_payment_id character varying(255),
    clinic_id uuid,
    rescheduled_from uuid,
    cancellation_fee numeric(10,2) DEFAULT 0,
    consent_ip text,
    consent_given_at timestamp with time zone,
    completed_at timestamp with time zone,
    CONSTRAINT appointments_mode_check CHECK (((mode)::text = ANY (ARRAY[('online'::character varying)::text, ('offline'::character varying)::text, ('in_person'::character varying)::text]))),
    CONSTRAINT appointments_status_check CHECK (((status)::text = ANY (ARRAY[('scheduled'::character varying)::text, ('confirmed'::character varying)::text, ('cancelled'::character varying)::text, ('completed'::character varying)::text, ('rescheduled'::character varying)::text, ('in_progress'::character varying)::text, ('pending'::character varying)::text])))
);


--
-- Name: clinics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinics (
    clinic_id uuid DEFAULT gen_random_uuid() NOT NULL,
    uid uuid NOT NULL,
    clinic_name character varying(255) NOT NULL,
    registration_number character varying(100),
    address_line1 character varying(255),
    address_line2 character varying(255),
    city character varying(100),
    state character varying(100),
    country character varying(100) DEFAULT 'India'::character varying,
    postal_code character varying(20),
    phone character varying(20),
    email character varying(255),
    website character varying(255),
    description text,
    logo_url text,
    is_verified boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    operating_hours jsonb,
    specializations text[],
    social_links jsonb,
    total_doctors integer DEFAULT 0,
    is_active boolean DEFAULT true
);


--
-- Name: coupons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupons (
    id integer NOT NULL,
    code character varying(50) NOT NULL,
    discount_type character varying(20) NOT NULL,
    discount_value numeric(10,2) NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: coupons_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.coupons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: coupons_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.coupons_id_seq OWNED BY public.coupons.id;


--
-- Name: doctor_availability; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctor_availability (
    availability_id uuid DEFAULT gen_random_uuid() NOT NULL,
    did uuid NOT NULL,
    day_of_week integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    slot_duration_minutes integer DEFAULT 30,
    mode character varying(20) NOT NULL,
    max_patients_per_slot integer DEFAULT 1,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT doctor_availability_check CHECK ((end_time > start_time)),
    CONSTRAINT doctor_availability_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6))),
    CONSTRAINT doctor_availability_mode_check CHECK (((mode)::text = ANY (ARRAY[('online'::character varying)::text, ('offline'::character varying)::text, ('both'::character varying)::text])))
);


--
-- Name: doctor_patient_relationships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctor_patient_relationships (
    relationship_id uuid DEFAULT gen_random_uuid() NOT NULL,
    did uuid NOT NULL,
    pid uuid NOT NULL,
    is_primary boolean DEFAULT false,
    relationship_status character varying(20) DEFAULT 'active'::character varying,
    first_appointment_date date,
    last_appointment_date date,
    total_appointments integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT doctor_patient_relationships_relationship_status_check CHECK (((relationship_status)::text = ANY (ARRAY[('active'::character varying)::text, ('inactive'::character varying)::text])))
);


--
-- Name: doctors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctors (
    did uuid DEFAULT gen_random_uuid() NOT NULL,
    uid uuid NOT NULL,
    specialization text[] DEFAULT ARRAY['General Medicine'::text] NOT NULL,
    qualification text DEFAULT 'MBBS'::text NOT NULL,
    registration_number character varying(100),
    years_of_experience integer DEFAULT 0,
    consultation_fee numeric(10,2) DEFAULT 0,
    bio text,
    clinic_name character varying(255),
    address_line1 character varying(255),
    address_line2 character varying(255),
    city character varying(100),
    state character varying(100),
    country character varying(100) DEFAULT 'India'::character varying,
    postal_code character varying(20),
    languages text[],
    is_verified boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    treated_patient_uids uuid[] DEFAULT '{}'::uuid[],
    custom_specializations text,
    clinic_id uuid,
    payout_method character varying(20),
    payout_upi_id character varying(255),
    bank_account_holder_name character varying(255),
    bank_account_number character varying(100),
    bank_ifsc_code character varying(20),
    bank_name character varying(255),
    bank_account_type character varying(50),
    bank_branch_name character varying(255),
    bank_details_verified boolean DEFAULT false,
    bank_details_added_at timestamp with time zone,
    payout_fee_acknowledged boolean DEFAULT false,
    payout_fee_acknowledged_at timestamp with time zone,
    is_accepting_patients boolean DEFAULT true,
    avg_rating numeric(3,2),
    total_reviews integer DEFAULT 0,
    total_consultations integer DEFAULT 0,
    profile_completion_pct smallint DEFAULT 0,
    date_of_birth date,
    gender character varying(20),
    blood_group character varying(5),
    verification_rejected boolean DEFAULT false,
    verified_at timestamp with time zone,
    verified_by text,
    verification_notes text,
    verification_requested boolean DEFAULT false,
    verification_requested_at timestamp with time zone,
    CONSTRAINT doctors_bank_account_type_check CHECK (((bank_account_type)::text = ANY (ARRAY[('savings'::character varying)::text, ('current'::character varying)::text, ('other'::character varying)::text]))),
    CONSTRAINT doctors_payout_method_check CHECK (((payout_method)::text = ANY (ARRAY[('bank'::character varying)::text, ('upi'::character varying)::text])))
);


--
-- Name: finance_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_transactions (
    transaction_id uuid DEFAULT gen_random_uuid() NOT NULL,
    aid uuid,
    pid uuid NOT NULL,
    did uuid,
    transaction_type character varying(30) NOT NULL,
    amount numeric(10,2) NOT NULL,
    doctor_net_amount numeric(10,2),
    platform_fee_applied numeric(10,2) DEFAULT 0,
    payout_fee_amount numeric(10,2) DEFAULT 0,
    final_net_amount numeric(10,2),
    currency character varying(3) DEFAULT 'INR'::character varying,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    common_payment_id character varying(255),
    transfer_status character varying(30),
    transfer_id character varying(255),
    transfer_error text,
    razorpay_order_id character varying(255),
    razorpay_payment_id character varying(255),
    razorpay_signature character varying(500),
    payment_method character varying(30),
    razorpay_response jsonb,
    description text,
    initiated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    paid_at timestamp with time zone,
    failed_at timestamp with time zone,
    refunded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_transfer_status CHECK (((transfer_status IS NULL) OR ((transfer_status)::text = ANY (ARRAY[('pending'::character varying)::text, ('success'::character varying)::text, ('failed'::character varying)::text, ('manual_pending'::character varying)::text, ('on_hold_linked_account'::character varying)::text, ('on_hold'::character varying)::text])))),
    CONSTRAINT finance_transactions_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('paid'::character varying)::text, ('failed'::character varying)::text, ('refunded'::character varying)::text]))),
    CONSTRAINT finance_transactions_transaction_type_check CHECK (((transaction_type)::text = ANY (ARRAY[('consultation'::character varying)::text, ('refund'::character varying)::text, ('cancellation_charge'::character varying)::text, ('doctor_payout'::character varying)::text, ('platform_fee'::character varying)::text])))
);


--
-- Name: global_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.global_settings (
    key character varying(255) NOT NULL,
    value character varying(255) NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    description text
);


--
-- Name: medication_adherence_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.medication_adherence_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    adherence_id uuid NOT NULL,
    old_status character varying(20),
    new_status character varying(20) NOT NULL,
    changed_by uuid,
    changed_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    reason text
);


--
-- Name: v_doctor_earnings_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_doctor_earnings_summary AS
 SELECT did,
    count(*) AS total_consultations,
    count(
        CASE
            WHEN ((status)::text = 'paid'::text) THEN 1
            ELSE NULL::integer
        END) AS completed_consultations,
    count(
        CASE
            WHEN ((status)::text = 'pending'::text) THEN 1
            ELSE NULL::integer
        END) AS pending_consultations,
    count(
        CASE
            WHEN ((status)::text = 'failed'::text) THEN 1
            ELSE NULL::integer
        END) AS failed_consultations,
    (COALESCE(sum(
        CASE
            WHEN ((status)::text = 'paid'::text) THEN amount
            ELSE (0)::numeric
        END), (0)::numeric))::numeric(10,2) AS total_paid_amount,
    (COALESCE(sum(
        CASE
            WHEN ((status)::text = 'pending'::text) THEN amount
            ELSE (0)::numeric
        END), (0)::numeric))::numeric(10,2) AS total_pending_amount,
    (COALESCE(sum(
        CASE
            WHEN ((status)::text = 'paid'::text) THEN platform_fee_applied
            ELSE (0)::numeric
        END), (0)::numeric))::numeric(10,2) AS total_platform_fees_deducted,
    (COALESCE(sum(
        CASE
            WHEN ((status)::text = 'paid'::text) THEN COALESCE(final_net_amount, doctor_net_amount)
            ELSE (0)::numeric
        END), (0)::numeric))::numeric(10,2) AS net_earnings,
    (COALESCE(sum(
        CASE
            WHEN ((status)::text = 'paid'::text) THEN COALESCE(payout_fee_amount, (0)::numeric)
            ELSE (0)::numeric
        END), (0)::numeric))::numeric(10,2) AS total_payout_fees,
    max(paid_at) AS last_consultation_date,
    min(created_at) AS first_consultation_date,
    (COALESCE(avg(
        CASE
            WHEN ((status)::text = 'paid'::text) THEN amount
            ELSE NULL::numeric
        END), (0)::numeric))::numeric(10,2) AS avg_consultation_fee
   FROM public.finance_transactions
  WHERE ((transaction_type)::text = 'consultation'::text)
  GROUP BY did;


--
-- Name: mv_doctor_earnings_cache; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.mv_doctor_earnings_cache AS
 SELECT did,
    total_consultations,
    completed_consultations,
    pending_consultations,
    failed_consultations,
    total_paid_amount,
    total_pending_amount,
    total_platform_fees_deducted,
    net_earnings,
    total_payout_fees,
    last_consultation_date,
    first_consultation_date,
    avg_consultation_fee
   FROM public.v_doctor_earnings_summary
  WITH NO DATA;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    notification_id uuid DEFAULT gen_random_uuid() NOT NULL,
    uid uuid NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    type character varying(30) DEFAULT 'general'::character varying NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    action_url text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    read_at timestamp with time zone,
    CONSTRAINT notifications_type_check CHECK (((type)::text = ANY ((ARRAY['appointment'::character varying, 'prescription'::character varying, 'payment'::character varying, 'general'::character varying, 'reminder'::character varying, 'review'::character varying])::text[])))
);


--
-- Name: patients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patients (
    pid uuid DEFAULT gen_random_uuid() NOT NULL,
    uid uuid NOT NULL,
    date_of_birth date,
    gender character varying(20),
    blood_group character varying(5),
    allergies text[],
    current_medications text[],
    chronic_conditions text[],
    address_line1 character varying(255),
    address_line2 character varying(255),
    city character varying(100),
    state character varying(100),
    country character varying(100) DEFAULT 'India'::character varying,
    postal_code character varying(20),
    emergency_contact_name character varying(255),
    emergency_contact_relationship character varying(100),
    emergency_contact_phone character varying(20),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    connected_doctor_uids uuid[] DEFAULT '{}'::uuid[],
    preferred_language character varying(50) DEFAULT 'en'::character varying,
    profile_completion_pct smallint DEFAULT 0,
    last_appointment_date date,
    total_appointments_count integer DEFAULT 0,
    CONSTRAINT patients_gender_check CHECK (((gender)::text = ANY (ARRAY[('male'::character varying)::text, ('female'::character varying)::text, ('other'::character varying)::text, ('prefer_not_to_say'::character varying)::text])))
);


--
-- Name: receipt_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.receipt_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.receipts (
    receipt_id uuid DEFAULT gen_random_uuid() NOT NULL,
    transaction_id uuid NOT NULL,
    receipt_number character varying(50) NOT NULL,
    receipt_date date DEFAULT CURRENT_DATE NOT NULL,
    pid uuid NOT NULL,
    did uuid NOT NULL,
    patient_name character varying(255) NOT NULL,
    doctor_name character varying(255) NOT NULL,
    consultation_fee numeric(10,2) NOT NULL,
    tax_amount numeric(10,2) DEFAULT 0,
    discount_amount numeric(10,2) DEFAULT 0,
    total_amount numeric(10,2) NOT NULL,
    payment_method character varying(30),
    razorpay_payment_id character varying(255),
    generated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: refund_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refund_requests (
    refund_id uuid DEFAULT gen_random_uuid() NOT NULL,
    aid uuid,
    pid uuid NOT NULL,
    did uuid,
    razorpay_payment_id text,
    razorpay_refund_id text,
    amount numeric(10,2) NOT NULL,
    refund_type text DEFAULT 'full'::text NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    requested_at timestamp with time zone DEFAULT now(),
    reviewed_at timestamp with time zone,
    reviewed_by text,
    reviewer_role text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT refund_requests_refund_type_check CHECK ((refund_type = ANY (ARRAY['full'::text, 'partial'::text]))),
    CONSTRAINT refund_requests_reviewer_role_check CHECK ((reviewer_role = ANY (ARRAY['admin'::text, 'doctor'::text, 'system'::text]))),
    CONSTRAINT refund_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'processed'::text, 'failed'::text])))
);


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    review_id uuid DEFAULT gen_random_uuid() NOT NULL,
    aid uuid NOT NULL,
    pid uuid NOT NULL,
    did uuid NOT NULL,
    rating integer NOT NULL,
    comment text,
    is_published boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT reviews_comment_check CHECK (((comment IS NULL) OR (length(TRIM(BOTH FROM comment)) <= 500))),
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    uid uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(20),
    password_hash text,
    role character varying(20) NOT NULL,
    name character varying(255) NOT NULL,
    profile_image_url text,
    is_verified boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_login timestamp with time zone,
    auth_id text,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY (ARRAY[('patient'::character varying)::text, ('doctor'::character varying)::text, ('admin'::character varying)::text, ('clinic'::character varying)::text])))
);


--
-- Name: v_admin_platform_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_admin_platform_summary AS
 SELECT ( SELECT count(*) AS count
           FROM public.users
          WHERE ((users.role)::text = 'patient'::text)) AS total_patients,
    ( SELECT count(*) AS count
           FROM public.users
          WHERE ((users.role)::text = 'doctor'::text)) AS total_doctors,
    ( SELECT count(*) AS count
           FROM public.clinics) AS total_clinics,
    ( SELECT count(*) AS count
           FROM public.appointments) AS total_appointments,
    ( SELECT count(*) AS count
           FROM public.appointments
          WHERE ((appointments.status)::text = 'scheduled'::text)) AS pending_appointments,
    ( SELECT count(*) AS count
           FROM public.prescriptions
          WHERE (prescriptions.is_active = true)) AS active_prescriptions,
    ( SELECT COALESCE(sum(finance_transactions.amount), (0)::numeric) AS "coalesce"
           FROM public.finance_transactions
          WHERE ((finance_transactions.status)::text = 'paid'::text)) AS total_revenue,
    ( SELECT COALESCE(sum(finance_transactions.platform_fee_applied), (0)::numeric) AS "coalesce"
           FROM public.finance_transactions
          WHERE ((finance_transactions.status)::text = 'paid'::text)) AS total_platform_fees_collected,
    ( SELECT count(*) AS count
           FROM public.finance_transactions
          WHERE ((finance_transactions.status)::text = 'pending'::text)) AS pending_transactions;


--
-- Name: v_clinic_doctor_revenue; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_clinic_doctor_revenue AS
 SELECT c.clinic_id,
    d.did,
    d.uid,
    u.name AS doctor_name,
    count(ft.transaction_id) AS total_consultations,
    count(
        CASE
            WHEN ((ft.status)::text = 'paid'::text) THEN 1
            ELSE NULL::integer
        END) AS paid_consultations,
    (COALESCE(sum(
        CASE
            WHEN ((ft.status)::text = 'paid'::text) THEN ft.amount
            ELSE (0)::numeric
        END), (0)::numeric))::numeric(10,2) AS total_earnings,
    (COALESCE(sum(
        CASE
            WHEN ((ft.status)::text = 'paid'::text) THEN ft.platform_fee_applied
            ELSE (0)::numeric
        END), (0)::numeric))::numeric(10,2) AS total_platform_fees,
    (COALESCE(sum(
        CASE
            WHEN ((ft.status)::text = 'paid'::text) THEN COALESCE(ft.final_net_amount, ft.doctor_net_amount)
            ELSE (0)::numeric
        END), (0)::numeric))::numeric(10,2) AS net_earnings,
    (COALESCE(sum(
        CASE
            WHEN ((ft.status)::text = 'paid'::text) THEN COALESCE(ft.payout_fee_amount, (0)::numeric)
            ELSE (0)::numeric
        END), (0)::numeric))::numeric(10,2) AS total_payout_fees
   FROM (((public.clinics c
     LEFT JOIN public.doctors d ON ((d.clinic_id = c.clinic_id)))
     LEFT JOIN public.users u ON ((u.uid = d.uid)))
     LEFT JOIN public.finance_transactions ft ON (((ft.did = d.did) AND ((ft.transaction_type)::text = 'consultation'::text))))
  GROUP BY c.clinic_id, d.did, d.uid, u.name;


--
-- Name: v_daily_consultation_activity; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_daily_consultation_activity AS
 SELECT did,
    date(paid_at) AS activity_date,
    count(*) AS consultation_count,
    (COALESCE(sum(amount), (0)::numeric))::numeric(10,2) AS daily_earnings,
    (COALESCE(sum(platform_fee_applied), (0)::numeric))::numeric(10,2) AS daily_platform_fees,
    (COALESCE(sum(COALESCE(final_net_amount, doctor_net_amount)), (0)::numeric))::numeric(10,2) AS daily_net_earnings,
    (COALESCE(sum(COALESCE(payout_fee_amount, (0)::numeric)), (0)::numeric))::numeric(10,2) AS daily_payout_fees,
    count(
        CASE
            WHEN ((status)::text = 'paid'::text) THEN 1
            ELSE NULL::integer
        END) AS completed_count,
    count(
        CASE
            WHEN ((status)::text = 'pending'::text) THEN 1
            ELSE NULL::integer
        END) AS pending_count
   FROM public.finance_transactions
  WHERE ((transaction_type)::text = 'consultation'::text)
  GROUP BY did, (date(paid_at))
  ORDER BY (date(paid_at)) DESC;


--
-- Name: v_doctor_monthly_earnings; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_doctor_monthly_earnings AS
 SELECT did,
    (date_trunc('month'::text, paid_at))::date AS month_start,
    to_char(date_trunc('month'::text, paid_at), 'YYYY-MM'::text) AS month,
    count(*) AS consultation_count,
    count(
        CASE
            WHEN ((status)::text = 'paid'::text) THEN 1
            ELSE NULL::integer
        END) AS completed_count,
    count(
        CASE
            WHEN ((status)::text = 'pending'::text) THEN 1
            ELSE NULL::integer
        END) AS pending_count,
    count(
        CASE
            WHEN ((status)::text = 'failed'::text) THEN 1
            ELSE NULL::integer
        END) AS failed_count,
    COALESCE(sum(
        CASE
            WHEN ((status)::text = 'paid'::text) THEN amount
            ELSE (0)::numeric
        END), (0)::numeric) AS total_earned,
    COALESCE(sum(
        CASE
            WHEN ((status)::text = 'pending'::text) THEN amount
            ELSE (0)::numeric
        END), (0)::numeric) AS pending_amount,
    COALESCE(sum(
        CASE
            WHEN ((status)::text = 'paid'::text) THEN platform_fee_applied
            ELSE (0)::numeric
        END), (0)::numeric) AS total_platform_fees,
    COALESCE(sum(
        CASE
            WHEN ((status)::text = 'paid'::text) THEN COALESCE(final_net_amount, doctor_net_amount)
            ELSE (0)::numeric
        END), (0)::numeric) AS net_earned,
    COALESCE(sum(
        CASE
            WHEN ((status)::text = 'paid'::text) THEN COALESCE(payout_fee_amount, (0)::numeric)
            ELSE (0)::numeric
        END), (0)::numeric) AS total_payout_fees
   FROM public.finance_transactions
  WHERE ((transaction_type)::text = 'consultation'::text)
  GROUP BY did, (date_trunc('month'::text, paid_at))
  ORDER BY ((date_trunc('month'::text, paid_at))::date) DESC;


--
-- Name: v_doctor_transfer_status; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_doctor_transfer_status AS
 SELECT did,
    count(*) AS total_transfers,
    count(
        CASE
            WHEN ((transfer_status)::text = 'success'::text) THEN 1
            ELSE NULL::integer
        END) AS successful_transfers,
    count(
        CASE
            WHEN ((transfer_status)::text = 'pending'::text) THEN 1
            ELSE NULL::integer
        END) AS pending_transfers,
    count(
        CASE
            WHEN ((transfer_status)::text = 'failed'::text) THEN 1
            ELSE NULL::integer
        END) AS failed_transfers,
    count(
        CASE
            WHEN (transfer_status IS NULL) THEN 1
            ELSE NULL::integer
        END) AS no_transfer_initiated,
    (COALESCE(sum(
        CASE
            WHEN ((transfer_status)::text = 'success'::text) THEN COALESCE(final_net_amount, doctor_net_amount)
            ELSE (0)::numeric
        END), (0)::numeric))::numeric(10,2) AS transferred_amount,
    (COALESCE(sum(
        CASE
            WHEN ((transfer_status)::text = 'pending'::text) THEN COALESCE(final_net_amount, doctor_net_amount)
            ELSE (0)::numeric
        END), (0)::numeric))::numeric(10,2) AS pending_transfer_amount,
    (COALESCE(sum(
        CASE
            WHEN ((transfer_status)::text = 'failed'::text) THEN COALESCE(final_net_amount, doctor_net_amount)
            ELSE (0)::numeric
        END), (0)::numeric))::numeric(10,2) AS failed_transfer_amount,
    max(
        CASE
            WHEN ((transfer_status)::text = 'success'::text) THEN paid_at
            ELSE NULL::timestamp with time zone
        END) AS last_successful_transfer_date
   FROM public.finance_transactions
  WHERE (((transaction_type)::text = 'consultation'::text) AND ((status)::text = 'paid'::text))
  GROUP BY did;


--
-- Name: coupons id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons ALTER COLUMN id SET DEFAULT nextval('public.coupons_id_seq'::regclass);


--
-- Name: app_storage_buckets app_storage_buckets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_storage_buckets
    ADD CONSTRAINT app_storage_buckets_pkey PRIMARY KEY (bucket_key);


--
-- Name: appointment_messages appointment_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_messages
    ADD CONSTRAINT appointment_messages_pkey PRIMARY KEY (message_id);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (aid);


--
-- Name: clinics clinics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinics
    ADD CONSTRAINT clinics_pkey PRIMARY KEY (clinic_id);


--
-- Name: clinics clinics_registration_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinics
    ADD CONSTRAINT clinics_registration_number_key UNIQUE (registration_number);


--
-- Name: clinics clinics_uid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinics
    ADD CONSTRAINT clinics_uid_key UNIQUE (uid);


--
-- Name: coupons coupons_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_code_key UNIQUE (code);


--
-- Name: coupons coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_pkey PRIMARY KEY (id);


--
-- Name: doctor_availability doctor_availability_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_availability
    ADD CONSTRAINT doctor_availability_pkey PRIMARY KEY (availability_id);


--
-- Name: doctor_patient_relationships doctor_patient_relationships_did_pid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_patient_relationships
    ADD CONSTRAINT doctor_patient_relationships_did_pid_key UNIQUE (did, pid);


--
-- Name: doctor_patient_relationships doctor_patient_relationships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_patient_relationships
    ADD CONSTRAINT doctor_patient_relationships_pkey PRIMARY KEY (relationship_id);


--
-- Name: doctors doctors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctors
    ADD CONSTRAINT doctors_pkey PRIMARY KEY (did);


--
-- Name: doctors doctors_registration_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctors
    ADD CONSTRAINT doctors_registration_number_key UNIQUE (registration_number);


--
-- Name: doctors doctors_uid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctors
    ADD CONSTRAINT doctors_uid_key UNIQUE (uid);


--
-- Name: finance_transactions finance_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_transactions
    ADD CONSTRAINT finance_transactions_pkey PRIMARY KEY (transaction_id);


--
-- Name: finance_transactions finance_transactions_razorpay_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_transactions
    ADD CONSTRAINT finance_transactions_razorpay_order_id_key UNIQUE (razorpay_order_id);


--
-- Name: finance_transactions finance_transactions_razorpay_payment_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_transactions
    ADD CONSTRAINT finance_transactions_razorpay_payment_id_key UNIQUE (razorpay_payment_id);


--
-- Name: global_settings global_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.global_settings
    ADD CONSTRAINT global_settings_pkey PRIMARY KEY (key);


--
-- Name: medication_adherence_audit medication_adherence_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_adherence_audit
    ADD CONSTRAINT medication_adherence_audit_pkey PRIMARY KEY (id);


--
-- Name: medication_adherence medication_adherence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_adherence
    ADD CONSTRAINT medication_adherence_pkey PRIMARY KEY (adherence_id);


--
-- Name: medication_adherence medication_adherence_prescription_id_medicine_name_schedule_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_adherence
    ADD CONSTRAINT medication_adherence_prescription_id_medicine_name_schedule_key UNIQUE (prescription_id, medicine_name, scheduled_date, scheduled_time);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (notification_id);


--
-- Name: patients patients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_pkey PRIMARY KEY (pid);


--
-- Name: patients patients_uid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_uid_key UNIQUE (uid);


--
-- Name: prescriptions prescriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_pkey PRIMARY KEY (prescription_id);


--
-- Name: receipts receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_pkey PRIMARY KEY (receipt_id);


--
-- Name: receipts receipts_receipt_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_receipt_number_key UNIQUE (receipt_number);


--
-- Name: refund_requests refund_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_requests
    ADD CONSTRAINT refund_requests_pkey PRIMARY KEY (refund_id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (review_id);


--
-- Name: users users_auth_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_auth_id_key UNIQUE (auth_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (uid);


--
-- Name: idx_adherence_audit_adherence_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_adherence_audit_adherence_id ON public.medication_adherence_audit USING btree (adherence_id);


--
-- Name: idx_adherence_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_adherence_date ON public.medication_adherence USING btree (scheduled_date);


--
-- Name: idx_adherence_pid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_adherence_pid ON public.medication_adherence USING btree (pid);


--
-- Name: idx_adherence_pid_date_taken; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_adherence_pid_date_taken ON public.medication_adherence USING btree (pid, scheduled_date, is_taken);


--
-- Name: idx_adherence_pid_date_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_adherence_pid_date_time ON public.medication_adherence USING btree (pid, scheduled_date, scheduled_time) WHERE (is_taken = false);


--
-- Name: idx_adherence_prescription; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_adherence_prescription ON public.medication_adherence USING btree (prescription_id);


--
-- Name: idx_adherence_summary_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_adherence_summary_unique ON public.adherence_progress_summary USING btree (pid, prescription_id, did, medicine_name);


--
-- Name: idx_adherence_synced; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_adherence_synced ON public.medication_adherence USING btree (synced);


--
-- Name: idx_appointment_messages_aid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointment_messages_aid ON public.appointment_messages USING btree (aid, created_at);


--
-- Name: idx_appointments_clinic_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_clinic_id ON public.appointments USING btree (clinic_id) WHERE (clinic_id IS NOT NULL);


--
-- Name: idx_appointments_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_date ON public.appointments USING btree (scheduled_date);


--
-- Name: idx_appointments_did; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_did ON public.appointments USING btree (did);


--
-- Name: idx_appointments_did_date_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_did_date_status ON public.appointments USING btree (did, scheduled_date, status);


--
-- Name: idx_appointments_mode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_mode ON public.appointments USING btree (mode);


--
-- Name: idx_appointments_payment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_payment_id ON public.appointments USING btree (payment_id);


--
-- Name: idx_appointments_payment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_payment_status ON public.appointments USING btree (payment_status);


--
-- Name: idx_appointments_pid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_pid ON public.appointments USING btree (pid);


--
-- Name: idx_appointments_pid_date_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_pid_date_status ON public.appointments USING btree (pid, scheduled_date, status);


--
-- Name: idx_appointments_razorpay_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_razorpay_order ON public.appointments USING btree (razorpay_order_id) WHERE (razorpay_order_id IS NOT NULL);


--
-- Name: idx_appointments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_status ON public.appointments USING btree (status);


--
-- Name: idx_availability_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_availability_active ON public.doctor_availability USING btree (is_active);


--
-- Name: idx_availability_day; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_availability_day ON public.doctor_availability USING btree (day_of_week);


--
-- Name: idx_availability_did; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_availability_did ON public.doctor_availability USING btree (did);


--
-- Name: idx_availability_did_day_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_availability_did_day_active ON public.doctor_availability USING btree (did, day_of_week, is_active) WHERE (is_active = true);


--
-- Name: idx_clinics_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinics_is_active ON public.clinics USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_clinics_uid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinics_uid ON public.clinics USING btree (uid);


--
-- Name: idx_coupons_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coupons_active ON public.coupons USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_coupons_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coupons_code ON public.coupons USING btree (upper((code)::text));


--
-- Name: idx_doctors_accepting; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doctors_accepting ON public.doctors USING btree (is_accepting_patients) WHERE (is_accepting_patients = true);


--
-- Name: idx_doctors_bank_details_verified; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doctors_bank_details_verified ON public.doctors USING btree (bank_details_verified) WHERE (bank_details_verified = true);


--
-- Name: idx_doctors_clinic_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doctors_clinic_id ON public.doctors USING btree (clinic_id);


--
-- Name: idx_doctors_custom_specializations; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doctors_custom_specializations ON public.doctors USING gin (to_tsvector('english'::regconfig, custom_specializations));


--
-- Name: idx_doctors_is_verified; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doctors_is_verified ON public.doctors USING btree (is_verified) WHERE (is_verified = true);


--
-- Name: idx_doctors_specialization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doctors_specialization ON public.doctors USING gin (specialization);


--
-- Name: idx_doctors_treated_patients; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doctors_treated_patients ON public.doctors USING gin (treated_patient_uids);


--
-- Name: idx_doctors_uid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doctors_uid ON public.doctors USING btree (uid);


--
-- Name: idx_finance_did_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_finance_did_created ON public.finance_transactions USING btree (did, created_at DESC);


--
-- Name: idx_finance_transactions_common_payment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_finance_transactions_common_payment_id ON public.finance_transactions USING btree (common_payment_id) WHERE (common_payment_id IS NOT NULL);


--
-- Name: idx_finance_transactions_doctor_paid_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_finance_transactions_doctor_paid_at ON public.finance_transactions USING btree (did, paid_at, status) WHERE ((transaction_type)::text = 'consultation'::text);


--
-- Name: idx_finance_transactions_doctor_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_finance_transactions_doctor_status ON public.finance_transactions USING btree (did, status) WHERE ((transaction_type)::text = 'consultation'::text);


--
-- Name: idx_finance_transactions_doctor_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_finance_transactions_doctor_type ON public.finance_transactions USING btree (did, transaction_type);


--
-- Name: idx_finance_transactions_paid_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_finance_transactions_paid_at ON public.finance_transactions USING btree (paid_at) WHERE ((status)::text = 'paid'::text);


--
-- Name: idx_finance_transactions_transfer_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_finance_transactions_transfer_status ON public.finance_transactions USING btree (transfer_status) WHERE (transfer_status IS NOT NULL);


--
-- Name: idx_global_settings_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_global_settings_key ON public.global_settings USING btree (key);


--
-- Name: idx_mv_doctor_earnings_cache_did; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_mv_doctor_earnings_cache_did ON public.mv_doctor_earnings_cache USING btree (did);


--
-- Name: idx_notifications_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_created ON public.notifications USING btree (created_at DESC);


--
-- Name: idx_notifications_uid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_uid ON public.notifications USING btree (uid);


--
-- Name: idx_notifications_uid_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_uid_unread ON public.notifications USING btree (uid, is_read) WHERE (is_read = false);


--
-- Name: idx_patients_connected_doctors; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patients_connected_doctors ON public.patients USING gin (connected_doctor_uids);


--
-- Name: idx_patients_uid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patients_uid ON public.patients USING btree (uid);


--
-- Name: idx_prescriptions_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prescriptions_active ON public.prescriptions USING btree (is_active);


--
-- Name: idx_prescriptions_aid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prescriptions_aid ON public.prescriptions USING btree (aid);


--
-- Name: idx_prescriptions_did; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prescriptions_did ON public.prescriptions USING btree (did);


--
-- Name: idx_prescriptions_pid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prescriptions_pid ON public.prescriptions USING btree (pid);


--
-- Name: idx_prescriptions_pid_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prescriptions_pid_active ON public.prescriptions USING btree (pid, is_active);


--
-- Name: idx_prescriptions_sent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prescriptions_sent ON public.prescriptions USING btree (sent_to_patient, sent_at);


--
-- Name: idx_refund_aid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refund_aid ON public.refund_requests USING btree (aid);


--
-- Name: idx_refund_did; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refund_did ON public.refund_requests USING btree (did);


--
-- Name: idx_refund_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refund_patient ON public.refund_requests USING btree (pid);


--
-- Name: idx_refund_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refund_status ON public.refund_requests USING btree (status);


--
-- Name: idx_relationships_did; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_relationships_did ON public.doctor_patient_relationships USING btree (did);


--
-- Name: idx_relationships_pid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_relationships_pid ON public.doctor_patient_relationships USING btree (pid);


--
-- Name: idx_relationships_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_relationships_status ON public.doctor_patient_relationships USING btree (relationship_status);


--
-- Name: idx_transactions_aid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_aid ON public.finance_transactions USING btree (aid);


--
-- Name: idx_transactions_common_payment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_common_payment_id ON public.finance_transactions USING btree (common_payment_id);


--
-- Name: idx_transactions_did_type_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_did_type_status ON public.finance_transactions USING btree (did, transaction_type, status);


--
-- Name: idx_transactions_pid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_pid ON public.finance_transactions USING btree (pid);


--
-- Name: idx_transactions_razorpay_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_razorpay_order ON public.finance_transactions USING btree (razorpay_order_id);


--
-- Name: idx_transactions_razorpay_payment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_razorpay_payment ON public.finance_transactions USING btree (razorpay_payment_id);


--
-- Name: idx_transactions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_status ON public.finance_transactions USING btree (status);


--
-- Name: idx_users_auth_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_auth_id ON public.users USING btree (auth_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_phone ON public.users USING btree (phone);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: reviews_aid_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX reviews_aid_unique ON public.reviews USING btree (aid);


--
-- Name: reviews_did_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reviews_did_created ON public.reviews USING btree (did, created_at DESC);


--
-- Name: reviews_pid_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reviews_pid_created ON public.reviews USING btree (pid, created_at DESC);


--
-- Name: receipts generate_receipt_number_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER generate_receipt_number_trigger BEFORE INSERT ON public.receipts FOR EACH ROW EXECUTE FUNCTION public.generate_receipt_number();


--
-- Name: appointments generate_token_number_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER generate_token_number_trigger BEFORE INSERT ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.generate_token_number();


--
-- Name: medication_adherence trg_audit_adherence_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_adherence_status AFTER UPDATE OF status ON public.medication_adherence FOR EACH ROW EXECUTE FUNCTION public.audit_adherence_status_change();


--
-- Name: finance_transactions trg_auto_generate_receipt; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auto_generate_receipt AFTER INSERT OR UPDATE OF status ON public.finance_transactions FOR EACH ROW WHEN ((((new.status)::text = 'paid'::text) AND ((new.transaction_type)::text = 'consultation'::text))) EXECUTE FUNCTION public.auto_generate_receipt();


--
-- Name: reviews trg_refresh_doctor_rating; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_refresh_doctor_rating AFTER INSERT OR DELETE OR UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.refresh_doctor_rating();


--
-- Name: appointments trg_set_completed_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_completed_at BEFORE UPDATE OF status ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.set_appointment_completed_at();


--
-- Name: finance_transactions trg_sync_appointment_payment; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_appointment_payment AFTER INSERT OR UPDATE OF status ON public.finance_transactions FOR EACH ROW WHEN ((((new.status)::text = 'paid'::text) AND (new.aid IS NOT NULL))) EXECUTE FUNCTION public.sync_appointment_payment_status();


--
-- Name: doctors trg_sync_clinic_doctor_count; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_clinic_doctor_count AFTER INSERT OR DELETE OR UPDATE OF clinic_id ON public.doctors FOR EACH ROW EXECUTE FUNCTION public.sync_clinic_doctor_count();


--
-- Name: doctors trg_sync_doctor_verified; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_doctor_verified AFTER UPDATE OF is_verified ON public.doctors FOR EACH ROW EXECUTE FUNCTION public.sync_doctor_verification_to_user();


--
-- Name: appointments trg_sync_treated_patients; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_treated_patients AFTER INSERT OR UPDATE OF status ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.sync_treated_patients();


--
-- Name: appointments trg_update_appointment_aggregates; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_appointment_aggregates AFTER INSERT OR UPDATE OF status ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_appointment_aggregates();


--
-- Name: prescriptions trigger_auto_create_adherence; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_auto_create_adherence AFTER UPDATE OF sent_to_patient ON public.prescriptions FOR EACH ROW WHEN (((old.sent_to_patient IS DISTINCT FROM new.sent_to_patient) AND (new.sent_to_patient = true))) EXECUTE FUNCTION public.auto_create_adherence_records();


--
-- Name: users trigger_auto_manage_user_roles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_auto_manage_user_roles AFTER INSERT OR UPDATE OF role ON public.users FOR EACH ROW EXECUTE FUNCTION public.auto_manage_user_roles();


--
-- Name: doctors trigger_enforce_doctor_role; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_enforce_doctor_role BEFORE INSERT OR UPDATE ON public.doctors FOR EACH ROW EXECUTE FUNCTION public.enforce_doctor_role();


--
-- Name: patients trigger_enforce_patient_role; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_enforce_patient_role BEFORE INSERT OR UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.enforce_patient_role();


--
-- Name: medication_adherence trigger_refresh_adherence_summary; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_refresh_adherence_summary AFTER INSERT OR DELETE OR UPDATE ON public.medication_adherence FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_adherence_summary();


--
-- Name: clinics trigger_sync_clinic_details; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_clinic_details AFTER UPDATE OF clinic_name ON public.clinics FOR EACH ROW EXECUTE FUNCTION public.sync_clinic_name_to_doctors();


--
-- Name: appointments trigger_update_relationship; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_relationship AFTER INSERT OR UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_doctor_patient_relationship();


--
-- Name: users trigger_validate_user_role_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_validate_user_role_change BEFORE UPDATE OF role ON public.users FOR EACH ROW EXECUTE FUNCTION public.validate_user_role_change();


--
-- Name: app_storage_buckets update_app_storage_buckets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_app_storage_buckets_updated_at BEFORE UPDATE ON public.app_storage_buckets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: appointments update_appointments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: doctor_availability update_availability_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_availability_updated_at BEFORE UPDATE ON public.doctor_availability FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: clinics update_clinics_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_clinics_updated_at BEFORE UPDATE ON public.clinics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: coupons update_coupons_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_coupons_updated_at BEFORE UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: doctors update_doctors_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_doctors_updated_at BEFORE UPDATE ON public.doctors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: global_settings update_global_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_global_settings_updated_at BEFORE UPDATE ON public.global_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: patients update_patients_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: prescriptions update_prescriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_prescriptions_updated_at BEFORE UPDATE ON public.prescriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: refund_requests update_refund_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_refund_requests_updated_at BEFORE UPDATE ON public.refund_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: doctor_patient_relationships update_relationships_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_relationships_updated_at BEFORE UPDATE ON public.doctor_patient_relationships FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: reviews update_reviews_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: appointment_messages appointment_messages_aid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_messages
    ADD CONSTRAINT appointment_messages_aid_fkey FOREIGN KEY (aid) REFERENCES public.appointments(aid) ON DELETE CASCADE;


--
-- Name: appointment_messages appointment_messages_sender_uid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_messages
    ADD CONSTRAINT appointment_messages_sender_uid_fkey FOREIGN KEY (sender_uid) REFERENCES public.users(uid);


--
-- Name: appointments appointments_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(clinic_id) ON DELETE SET NULL;


--
-- Name: appointments appointments_rescheduled_from_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_rescheduled_from_fkey FOREIGN KEY (rescheduled_from) REFERENCES public.appointments(aid) ON DELETE SET NULL;


--
-- Name: clinics clinics_uid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinics
    ADD CONSTRAINT clinics_uid_fkey FOREIGN KEY (uid) REFERENCES public.users(uid) ON DELETE CASCADE;


--
-- Name: doctor_availability doctor_availability_did_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_availability
    ADD CONSTRAINT doctor_availability_did_fkey FOREIGN KEY (did) REFERENCES public.doctors(did) ON DELETE CASCADE;


--
-- Name: doctor_patient_relationships doctor_patient_relationships_did_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_patient_relationships
    ADD CONSTRAINT doctor_patient_relationships_did_fkey FOREIGN KEY (did) REFERENCES public.doctors(did) ON DELETE CASCADE;


--
-- Name: doctor_patient_relationships doctor_patient_relationships_pid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_patient_relationships
    ADD CONSTRAINT doctor_patient_relationships_pid_fkey FOREIGN KEY (pid) REFERENCES public.patients(pid) ON DELETE CASCADE;


--
-- Name: doctors doctors_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctors
    ADD CONSTRAINT doctors_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(clinic_id) ON DELETE SET NULL;


--
-- Name: doctors doctors_uid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctors
    ADD CONSTRAINT doctors_uid_fkey FOREIGN KEY (uid) REFERENCES public.users(uid) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- Name: patients fk_patients_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT fk_patients_user FOREIGN KEY (uid) REFERENCES public.users(uid) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;


--
-- Name: medication_adherence_audit medication_adherence_audit_adherence_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_adherence_audit
    ADD CONSTRAINT medication_adherence_audit_adherence_id_fkey FOREIGN KEY (adherence_id) REFERENCES public.medication_adherence(adherence_id) ON DELETE CASCADE;


--
-- Name: medication_adherence medication_adherence_prescription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_adherence
    ADD CONSTRAINT medication_adherence_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(prescription_id) ON DELETE CASCADE;


--
-- Name: notifications notifications_uid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_uid_fkey FOREIGN KEY (uid) REFERENCES public.users(uid) ON DELETE CASCADE;


--
-- Name: prescriptions prescriptions_aid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_aid_fkey FOREIGN KEY (aid) REFERENCES public.appointments(aid) ON DELETE CASCADE;


--
-- Name: prescriptions prescriptions_pid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_pid_fkey FOREIGN KEY (pid) REFERENCES public.patients(pid) ON DELETE CASCADE;


--
-- Name: receipts receipts_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.finance_transactions(transaction_id) ON DELETE CASCADE;


--
-- Name: refund_requests refund_requests_aid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_requests
    ADD CONSTRAINT refund_requests_aid_fkey FOREIGN KEY (aid) REFERENCES public.appointments(aid) ON DELETE CASCADE;


--
-- Name: reviews reviews_aid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_aid_fkey FOREIGN KEY (aid) REFERENCES public.appointments(aid) ON DELETE CASCADE;


--
-- Name: reviews reviews_did_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_did_fkey FOREIGN KEY (did) REFERENCES public.doctors(did) ON DELETE CASCADE;


--
-- Name: reviews reviews_pid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pid_fkey FOREIGN KEY (pid) REFERENCES public.patients(pid) ON DELETE CASCADE;


--
-- Name: users public_users_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_users_insert_own ON public.users FOR INSERT TO authenticated WITH CHECK ((uid = auth.uid()));


--
-- Name: users public_users_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_users_read ON public.users FOR SELECT TO authenticated, anon USING (true);


--
-- Name: users public_users_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_users_update_own ON public.users FOR UPDATE TO authenticated USING ((uid = auth.uid())) WITH CHECK ((uid = auth.uid()));


--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--



