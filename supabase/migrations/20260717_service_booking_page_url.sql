-- Public Google Appointment Schedule link (display / staff reference).
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS google_booking_page_url text;
