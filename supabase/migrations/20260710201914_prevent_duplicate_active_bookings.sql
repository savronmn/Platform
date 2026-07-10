-- Keep one active appointment per barber and start time.
-- Existing twins are cancelled before adding the constraint so deployment is safe.
WITH ranked_confirmed AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY barber_id, date, time
      ORDER BY created_at ASC, id ASC
    ) AS duplicate_number
  FROM public.bookings
  WHERE status = 'confirmed'
    AND barber_id IS NOT NULL
)
UPDATE public.bookings AS booking
SET status = 'cancelled'
FROM ranked_confirmed
WHERE booking.id = ranked_confirmed.id
  AND ranked_confirmed.duplicate_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_one_confirmed_barber_slot
  ON public.bookings (barber_id, date, time)
  WHERE status = 'confirmed' AND barber_id IS NOT NULL;
