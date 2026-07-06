-- ============================================================
-- SAVRON — Fix cancel flow, RLS, ePass, and realtime
-- Run this ENTIRE file in Supabase SQL Editor (safe to re-run)
-- ============================================================

-- ── 1. Columns the app expects (no-op if already present) ──
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS google_event_id text,
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS client_photo_url text;

ALTER TABLE public.barbers
  ADD COLUMN IF NOT EXISTS google_calendar_id text,
  ADD COLUMN IF NOT EXISTS google_calendar_tokens jsonb,
  ADD COLUMN IF NOT EXISTS google_sync_token text,
  ADD COLUMN IF NOT EXISTS google_channel_id text,
  ADD COLUMN IF NOT EXISTS google_resource_id text,
  ADD COLUMN IF NOT EXISTS license_number text,
  ADD COLUMN IF NOT EXISTS services_offered text[],
  ADD COLUMN IF NOT EXISTS portfolio_images text[] DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS booking_links text[] DEFAULT '{}'::text[];

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS last_booking_date date;

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS color text DEFAULT 'emerald',
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS sort_order integer;

ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS experience_summary text;

ALTER TABLE public.email_subscribers
  ADD COLUMN IF NOT EXISTS phone text;

-- ePass OTP table (custom login — not Supabase Auth magic link)
CREATE TABLE IF NOT EXISTS public.epass_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS epass_otps_email_idx ON public.epass_otps (email);

CREATE TABLE IF NOT EXISTS public.barber_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id uuid NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('schedule', 'price', 'service', 'profile')),
  payload jsonb NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_change_requests_status ON public.barber_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_change_requests_barber ON public.barber_change_requests(barber_id);

-- ── 2. Enable RLS on all app tables ──
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barber_service ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barber_change_requests ENABLE ROW LEVEL SECURITY;

-- ── 3. Drop broken / duplicate policies (safe to re-run) ──
DROP POLICY IF EXISTS "Admin full access on user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin full on user_roles" ON public.user_roles;

-- user_roles — NO recursive admin policy (causes infinite recursion)
DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;
CREATE POLICY "Users can read own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = auth_id);

-- barbers
DROP POLICY IF EXISTS "Public can read barbers" ON public.barbers;
DROP POLICY IF EXISTS "Admin full access on barbers" ON public.barbers;
DROP POLICY IF EXISTS "Barbers can read own record" ON public.barbers;
DROP POLICY IF EXISTS "Barbers can update own record" ON public.barbers;
CREATE POLICY "Public can read barbers" ON public.barbers FOR SELECT USING (true);
CREATE POLICY "Admin full access on barbers" ON public.barbers
  FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE auth_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Barbers can read own record" ON public.barbers
  FOR SELECT USING (auth.uid() = auth_id);
CREATE POLICY "Barbers can update own record" ON public.barbers
  FOR UPDATE USING (auth.uid() = auth_id);

-- services + barber_service
DROP POLICY IF EXISTS "Public can read services" ON public.services;
DROP POLICY IF EXISTS "Admin full access on services" ON public.services;
CREATE POLICY "Public can read services" ON public.services FOR SELECT USING (true);
CREATE POLICY "Admin full access on services" ON public.services
  FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE auth_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Public can read barber_service" ON public.barber_service;
DROP POLICY IF EXISTS "Admin full access on barber_service" ON public.barber_service;
CREATE POLICY "Public can read barber_service" ON public.barber_service FOR SELECT USING (true);
CREATE POLICY "Admin full access on barber_service" ON public.barber_service
  FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE auth_id = auth.uid() AND role = 'admin'));

-- applicants
DROP POLICY IF EXISTS "Public can apply" ON public.applicants;
DROP POLICY IF EXISTS "Admin full access on applicants" ON public.applicants;
CREATE POLICY "Public can apply" ON public.applicants FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin full access on applicants" ON public.applicants
  FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE auth_id = auth.uid() AND role = 'admin'));

-- clients
DROP POLICY IF EXISTS "Public can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Admin full access on clients" ON public.clients;
DROP POLICY IF EXISTS "Clients can read own record" ON public.clients;
DROP POLICY IF EXISTS "Clients can update own record" ON public.clients;
CREATE POLICY "Public can insert clients" ON public.clients FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin full access on clients" ON public.clients
  FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE auth_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Clients can read own record" ON public.clients
  FOR SELECT USING (auth.uid() = auth_id);
CREATE POLICY "Clients can update own record" ON public.clients
  FOR UPDATE USING (auth.uid() = auth_id);

-- bookings — CRITICAL for cancel + booking flow
DROP POLICY IF EXISTS "Public can book" ON public.bookings;
DROP POLICY IF EXISTS "Admin full access on bookings" ON public.bookings;
DROP POLICY IF EXISTS "Barbers can read own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Barbers can update own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Clients can read own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Public can read own booking by email" ON public.bookings;
DROP POLICY IF EXISTS "Public can read bookings" ON public.bookings;
DROP POLICY IF EXISTS "Clients can read own bookings by email" ON public.bookings;

CREATE POLICY "Public can book" ON public.bookings
  FOR INSERT WITH CHECK (true);

-- Needed so .insert().select('id') returns the new booking id
CREATE POLICY "Public can read bookings" ON public.bookings
  FOR SELECT USING (true);

CREATE POLICY "Admin full access on bookings" ON public.bookings
  FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE auth_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Barbers can read own bookings" ON public.bookings
  FOR SELECT USING (barber_id IN (SELECT id FROM public.barbers WHERE auth_id = auth.uid()));

CREATE POLICY "Barbers can update own bookings" ON public.bookings
  FOR UPDATE USING (barber_id IN (SELECT id FROM public.barbers WHERE auth_id = auth.uid()));

CREATE POLICY "Clients can read own bookings" ON public.bookings
  FOR SELECT USING (client_id IN (SELECT id FROM public.clients WHERE auth_id = auth.uid()));

-- Membership portal: match by login email when client_id is null (walk-ins)
CREATE POLICY "Clients can read own bookings by email" ON public.bookings
  FOR SELECT USING (
    lower(client_email) = lower((auth.jwt() ->> 'email'))
  );

-- email_subscribers (admin CRM + ePass)
DROP POLICY IF EXISTS "Admin full access on email_subscribers" ON public.email_subscribers;
CREATE POLICY "Admin full access on email_subscribers" ON public.email_subscribers
  FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE auth_id = auth.uid() AND role = 'admin'));

-- barber_change_requests
DROP POLICY IF EXISTS "Admin full access on barber_change_requests" ON public.barber_change_requests;
DROP POLICY IF EXISTS "Barbers can read own change requests" ON public.barber_change_requests;
DROP POLICY IF EXISTS "Barbers can insert own change requests" ON public.barber_change_requests;
CREATE POLICY "Admin full access on barber_change_requests" ON public.barber_change_requests
  FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE auth_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Barbers can read own change requests" ON public.barber_change_requests
  FOR SELECT USING (barber_id IN (SELECT id FROM public.barbers WHERE auth_id = auth.uid()));
CREATE POLICY "Barbers can insert own change requests" ON public.barber_change_requests
  FOR INSERT WITH CHECK (barber_id IN (SELECT id FROM public.barbers WHERE auth_id = auth.uid()));

-- ── 4. Realtime (host dashboard live updates after cancel) ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'bookings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
  END IF;
END $$;

-- ── 5. LINK YOUR ADMIN USER (REQUIRED for cancel from host/admin) ──
-- Cancel API only works for staff: user_roles.role = 'admin' OR barbers.auth_id match.
--
-- Step A: Supabase Dashboard → Authentication → Users → copy your admin UUID
-- Step B: Uncomment and run ONE of these (replace the UUID):

-- INSERT INTO public.user_roles (auth_id, role)
-- VALUES ('YOUR-ADMIN-AUTH-UUID-HERE', 'admin')
-- ON CONFLICT (auth_id) DO UPDATE SET role = 'admin';

-- Or if you log in as a barber on host:
-- UPDATE public.barbers SET auth_id = 'YOUR-BARBER-AUTH-UUID-HERE' WHERE slug = 'albi-a';

-- ── 6. Diagnostics ──
-- Run after linking admin:
--
-- SELECT u.email, ur.role
-- FROM auth.users u
-- LEFT JOIN public.user_roles ur ON ur.auth_id = u.id
-- ORDER BY u.created_at DESC;
--
-- SELECT id, client_name, date, time, status, barber_id
-- FROM public.bookings
-- WHERE status = 'confirmed'
-- ORDER BY date, time;
--
-- Duplicate slots (GCal sync twins — cancel only hits one row):
-- SELECT barber_id, date, time, count(*) AS cnt
-- FROM public.bookings
-- WHERE status = 'confirmed'
-- GROUP BY barber_id, date, time
-- HAVING count(*) > 1;

-- ── 7. Optional: cancel duplicate confirmed twins at same slot ──
-- Keeps the oldest row, cancels the rest.
--
-- UPDATE public.bookings b
-- SET status = 'cancelled'
-- WHERE b.status = 'confirmed'
--   AND b.id NOT IN (
--     SELECT DISTINCT ON (barber_id, date, time) id
--     FROM public.bookings
--     WHERE status = 'confirmed'
--     ORDER BY barber_id, date, time, created_at ASC
--   );
