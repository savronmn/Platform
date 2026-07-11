-- Audit fixes: atomic visit increments + shop invite event id for RSVP tracking

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS shop_google_event_id text;

CREATE OR REPLACE FUNCTION public.increment_subscriber_visit(p_subscriber_id uuid)
RETURNS public.email_subscribers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_row public.email_subscribers;
BEGIN
  -- Atomic increment with 30s debounce inside the DB to avoid concurrent double-scans.
  UPDATE public.email_subscribers
  SET
    visit_count = COALESCE(visit_count, 0) + 1,
    last_visit_at = now()
  WHERE id = p_subscriber_id
    AND active = true
    AND (
      last_visit_at IS NULL
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

REVOKE ALL ON FUNCTION public.increment_subscriber_visit(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decrement_subscriber_visit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_subscriber_visit(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrement_subscriber_visit(uuid) TO service_role;
