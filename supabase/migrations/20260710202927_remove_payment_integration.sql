-- This application schedules appointments only; payments happen outside the app.
ALTER TABLE public.bookings
  DROP COLUMN IF EXISTS payment_status,
  DROP COLUMN IF EXISTS stripe_session_id;
