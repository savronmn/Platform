-- ============================================================
-- SAVRON — Full DB setup for launch
-- Run this in Supabase SQL editor.
-- ============================================================

-- 1) Portfolio images on barbers
ALTER TABLE public.barbers
  ADD COLUMN IF NOT EXISTS portfolio_images text[] DEFAULT ARRAY[]::text[];

-- 2) Change-request table
CREATE TABLE IF NOT EXISTS public.barber_change_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id   uuid NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('schedule', 'price', 'service', 'profile')),
  payload     jsonb NOT NULL,
  reason      text,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_change_requests_status ON public.barber_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_change_requests_barber ON public.barber_change_requests(barber_id);

-- 3) Add missing columns to services table if not present
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS color       text DEFAULT 'emerald';
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS sort_order  integer;

-- ============================================================
-- 4) REPLACE ALL SERVICES with the correct menu
--    Run this EVERY TIME you need to reset to canonical state.
-- ============================================================
DELETE FROM public.services;

INSERT INTO public.services (name, duration_minutes, price_cents, color, description, active) VALUES
  ('The Executive',                     75, 9000, 'blue',    'The full SAVRON experience — signature cut paired with hot towel shave.',   true),
  ('Signature Cut',                     45, 5000, 'emerald', 'Tailored fade or scissor cut, finished with a clean neckline.',             true),
  ('Long Styles Haircut',               60, 6000, 'indigo',  'Sculpted cut for longer hair — texture, shape, and movement.',             true),
  ('Kids Cut',                          30, 5000, 'teal',    'Classic precision cut for the next generation.',                             true),
  ('Beard Sculpting + Hot Towel Shave', 45, 5000, 'amber',   'Straight-razor line up, hot towel ritual, conditioning finish.',           true);

-- 5) Storage bucket for portfolio images
-- Create manually in Supabase Storage UI: bucket name = "barber-portfolios", public = true
-- Or uncomment if your project has storage admin access:
-- INSERT INTO storage.buckets (id, name, public)
--   VALUES ('barber-portfolios', 'barber-portfolios', true)
--   ON CONFLICT DO NOTHING;

-- 6) Clean test data for launch (UNCOMMENT after backing up)
-- DELETE FROM public.bookings;
-- DELETE FROM public.barbers WHERE name NOT ILIKE 'Albe%';

-- ============================================================
-- DONE. Verify with:
--   SELECT name, price_cents, color FROM services ORDER BY created_at;
-- ============================================================
