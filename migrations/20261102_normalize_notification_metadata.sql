-- Older notification writers passed JSON.stringify(...) through a jsonb cast,
-- which stored the metadata as a JSON *string* instead of an object. That hides
-- every metadata key from `metadata->>'key'`, so the event-key unique index and
-- image/doctor enrichment could not see it. Convert only values that are valid
-- JSON objects; leave anything unexpected untouched.

BEGIN;

DO $$
DECLARE
    row_record record;
    parsed jsonb;
BEGIN
    FOR row_record IN
        SELECT notification_id, metadata #>> '{}' AS raw_metadata
        FROM public.notifications
        WHERE metadata IS NOT NULL
          AND jsonb_typeof(metadata) = 'string'
    LOOP
        BEGIN
            parsed := row_record.raw_metadata::jsonb;
            IF jsonb_typeof(parsed) = 'object' THEN
                UPDATE public.notifications
                SET metadata = parsed
                WHERE notification_id = row_record.notification_id;
            END IF;
        EXCEPTION WHEN others THEN
            -- Not parseable as JSON (or not a JSON object): keep the original.
            NULL;
        END;
    END LOOP;
END $$;

COMMIT;
