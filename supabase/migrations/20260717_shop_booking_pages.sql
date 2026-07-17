-- Per-service Google Calendar booking pages on savronmn@gmail.com (shop account).
-- shop_calendar_id: secondary calendar for this service's appointment invites.
-- booking_page_slug: URL-safe identifier used in extendedProperties + admin UI.

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS shop_calendar_id text,
  ADD COLUMN IF NOT EXISTS booking_page_slug text;

CREATE UNIQUE INDEX IF NOT EXISTS services_booking_page_slug_unique
  ON public.services (booking_page_slug)
  WHERE booking_page_slug IS NOT NULL;
