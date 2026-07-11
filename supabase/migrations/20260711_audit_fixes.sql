-- Audit fixes: atomic visit increments + shop invite event id for RSVP tracking

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS shop_google_event_id text;

CREATE OR REPLACE FUNCTION public.increment_subscriber_visit(
  p_subscriber_id uuid,
  p_force boolean DEFAULT false
)
RETURNS public.email_subscribers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_row public.email_subscribers;
BEGIN
  -- Atomic increment. Debounce double-scans unless force=true (manual admin adjust).
  UPDATE public.email_subscribers
  SET
    visit_count = COALESCE(visit_count, 0) + 1,
    last_visit_at = now()
  WHERE id = p_subscriber_id
    AND active = true
    AND (
      p_force
      OR last_visit_at IS NULL
      OR last_visit_at < now() - interval '30 seconds'
    )
  RETURNING * INTO updated_row;

  IF updated_row.id IS NULL THEN
    SELECT * INTO updated_row
    FROM public.email_subscribers
    WHERE id = p_subscriber_id AND active = true;

    IF updated_row.id IS NULL THEN
      RAISE EXCEPTION 'subscriber_not_found';
    END IF;

    -- Debounced no-op: mark with a sentinel via RAISE so callers can detect.
    IF NOT p_force THEN
      RAISE EXCEPTION 'visit_debounced';
    END IF;
  END IF;

  RETURN updated_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_subscriber_visit(p_subscriber_id uuid)
RETURNS public.email_subscribers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_row public.email_subscribers;
BEGIN
  UPDATE public.email_subscribers
  SET visit_count = GREATEST(COALESCE(visit_count, 0) - 1, 0)
  WHERE id = p_subscriber_id
    AND active = true
  RETURNING * INTO updated_row;

  IF updated_row.id IS NULL THEN
    RAISE EXCEPTION 'subscriber_not_found';
  END IF;

  RETURN updated_row;
END;
$$;

-- Signature must match the created function: (uuid, boolean), not (uuid).
-- DEFAULT false lets callers omit p_force, but GRANT/REVOKE use the full arg list.
REVOKE ALL ON FUNCTION public.increment_subscriber_visit(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decrement_subscriber_visit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_subscriber_visit(uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrement_subscriber_visit(uuid) TO service_role;
