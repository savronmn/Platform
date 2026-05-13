-- ============================================================
-- Admin Hierarchy + Barber Portfolio Migration
-- Run this in the Supabase SQL editor.
-- ============================================================

-- 1) Portfolio images on barbers (array of public URLs from `barber-portfolios` Storage bucket)
ALTER TABLE public.barbers
  ADD COLUMN IF NOT EXISTS portfolio_images text[] DEFAULT ARRAY[]::text[];

-- 2) Change-request table — barbers submit; admins approve
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

-- 3) Storage bucket for portfolio images (run in Storage UI or via this if pgs allows)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('barber-portfolios', 'barber-portfolios', true)
-- ON CONFLICT DO NOTHING;

-- 4) RLS — locks down barbers from editing protected columns directly.
-- The booking flow uses anon key to READ. Writes happen via SECURITY DEFINER server routes
-- or via the admin service key, so client-side updates are not the threat surface today.
-- Enable when you wire barber-side Supabase auth:
--
-- ALTER TABLE public.barbers ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY barber_self_read ON public.barbers FOR SELECT USING (true);
-- CREATE POLICY barber_self_update_profile ON public.barbers FOR UPDATE
--   USING (auth_id = auth.uid())
--   WITH CHECK (
--     auth_id = auth.uid()
--     -- Barbers can only touch these columns; admin uses service key to bypass RLS
--     -- (NB: column-level locks need a trigger; see comment below)
--   );
--
-- ALTER TABLE public.barber_change_requests ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY barber_read_own_requests ON public.barber_change_requests FOR SELECT
--   USING (barber_id IN (SELECT id FROM public.barbers WHERE auth_id = auth.uid()));
-- CREATE POLICY barber_create_own_requests ON public.barber_change_requests FOR INSERT
--   WITH CHECK (barber_id IN (SELECT id FROM public.barbers WHERE auth_id = auth.uid()));

-- 5) Clean test data for launch (UNCOMMENT after backing up):
-- DELETE FROM public.bookings WHERE created_at < now();
-- DELETE FROM public.barbers WHERE name NOT ILIKE 'Albe%';
