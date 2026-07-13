-- Prevent overlapping appointments for the same barber on the same day.
-- Does not delete or modify existing rows — only blocks new overlaps going forward.

CREATE OR REPLACE FUNCTION public.booking_time_to_mins(time_text text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  time_part text;
  meridiem text;
  hours integer;
  minutes integer;
BEGIN
  IF time_text IS NULL OR btrim(time_text) = '' THEN
    RETURN 0;
  END IF;

  time_part := split_part(btrim(time_text), ' ', 1);
  meridiem := upper(split_part(btrim(time_text), ' ', 2));
  hours := split_part(time_part, ':', 1)::integer;
  minutes := split_part(time_part, ':', 2)::integer;

  IF meridiem = 'PM' AND hours <> 12 THEN
    hours := hours + 12;
  ELSIF meridiem = 'AM' AND hours = 12 THEN
    hours := 0;
  END IF;

  RETURN hours * 60 + minutes;
END;
$$;

CREATE OR REPLACE FUNCTION public.booking_duration_to_mins(duration_text text, fallback_mins integer DEFAULT 45)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  matched text;
BEGIN
  IF duration_text IS NULL OR btrim(duration_text) = '' THEN
    RETURN fallback_mins;
  END IF;

  matched := substring(duration_text from '(\d+)');
  IF matched IS NULL THEN
    RETURN fallback_mins;
  END IF;

  RETURN matched::integer;
END;
$$;

CREATE OR REPLACE FUNCTION public.booking_ranges_overlap(
  start_time_a text,
  duration_a text,
  start_time_b text,
  duration_b text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  start_a integer;
  end_a integer;
  start_b integer;
  end_b integer;
BEGIN
  start_a := public.booking_time_to_mins(start_time_a);
  end_a := start_a + public.booking_duration_to_mins(duration_a);
  start_b := public.booking_time_to_mins(start_time_b);
  end_b := start_b + public.booking_duration_to_mins(duration_b);

  -- Half-open overlap: back-to-back appointments are allowed.
  RETURN start_a < end_b AND end_a > start_b;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_booking_slot_availability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  conflicting_id uuid;
BEGIN
  IF NEW.barber_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('confirmed', 'completed') THEN
    RETURN NEW;
  END IF;

  SELECT b.id
  INTO conflicting_id
  FROM public.bookings AS b
  WHERE b.barber_id = NEW.barber_id
    AND b.date = NEW.date
    AND b.id IS DISTINCT FROM NEW.id
    AND b.status IN ('confirmed', 'completed', 'no_show')
    AND public.booking_ranges_overlap(NEW.time, NEW.duration, b.time, b.duration)
  LIMIT 1;

  IF conflicting_id IS NOT NULL THEN
    RAISE EXCEPTION 'booking_slot_unavailable'
      USING ERRCODE = '23505',
            HINT = 'This time slot overlaps an existing appointment.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_enforce_slot_availability ON public.bookings;

CREATE TRIGGER bookings_enforce_slot_availability
  BEFORE INSERT OR UPDATE OF barber_id, date, time, duration, status
  ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_booking_slot_availability();
