-- Security linter fixes: tighten RLS, storage listing, and RPC execute grants.
-- Safe to re-run.

-- ── 1. Drop overly permissive / duplicate policies flagged by Supabase linter ──

-- applicants
DROP POLICY IF EXISTS "Authenticated manage applicants" ON public.applicants;
DROP POLICY IF EXISTS "Public can apply" ON public.applicants;
DROP POLICY IF EXISTS "Public insert applicants" ON public.applicants;

-- barbers
DROP POLICY IF EXISTS "Authenticated manage barbers" ON public.barbers;

-- bookings
DROP POLICY IF EXISTS "Authenticated manage bookings" ON public.bookings;
DROP POLICY IF EXISTS "Public can book" ON public.bookings;
DROP POLICY IF EXISTS "Public insert bookings" ON public.bookings;

-- clients
DROP POLICY IF EXISTS "Authenticated manage clients" ON public.clients;
DROP POLICY IF EXISTS "Public can insert clients" ON public.clients;

-- email_subscribers
DROP POLICY IF EXISTS "Public can insert subscribers" ON public.email_subscribers;
DROP POLICY IF EXISTS "Service role full access on email_subscribers" ON public.email_subscribers;
DROP POLICY IF EXISTS "Authenticated read email_subscribers" ON public.email_subscribers;

-- barbers: duplicate public SELECT policy (keep "Public can read barbers")
DROP POLICY IF EXISTS "Public read barbers" ON public.barbers;

-- ── 2. Recreate INSERT policies with field validation (not WITH CHECK true) ──

CREATE POLICY "Public can apply" ON public.applicants
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'pending'
    AND name IS NOT NULL AND btrim(name) <> ''
    AND email IS NOT NULL AND email ~* '^[^@]+@[^@]+\.[^@]+$'
    AND phone IS NOT NULL AND btrim(phone) <> ''
    AND experience IS NOT NULL AND btrim(experience) <> ''
    AND license_status IS NOT NULL AND btrim(license_status) <> ''
  );

CREATE POLICY "Public can book" ON public.bookings
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'confirmed'
    AND service IS NOT NULL AND btrim(service) <> ''
    AND date IS NOT NULL
    AND time IS NOT NULL AND btrim(time) <> ''
    AND barber_id IS NOT NULL
    AND (
      (client_name IS NOT NULL AND btrim(client_name) <> '')
      OR (client_email IS NOT NULL AND client_email ~* '^[^@]+@[^@]+\.[^@]+$')
    )
  );

CREATE POLICY "Barbers can insert own bookings" ON public.bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    barber_id IN (SELECT id FROM public.barbers WHERE auth_id = auth.uid())
    AND status IN ('confirmed', 'completed', 'cancelled', 'no_show')
    AND service IS NOT NULL AND btrim(service) <> ''
    AND date IS NOT NULL
    AND time IS NOT NULL AND btrim(time) <> ''
  );

CREATE POLICY "Public can insert clients" ON public.clients
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    name IS NOT NULL AND btrim(name) <> ''
    AND email IS NOT NULL AND email ~* '^[^@]+@[^@]+\.[^@]+$'
    AND COALESCE(membership_status, 'standard') = 'standard'
    AND COALESCE(visit_count, 0) = 0
    AND (auth_id IS NULL OR auth_id = auth.uid())
  );

-- ── 3. Ensure admin policies use explicit WITH CHECK (not always-true ALL) ──

DROP POLICY IF EXISTS "Admin full access on applicants" ON public.applicants;
CREATE POLICY "Admin full access on applicants" ON public.applicants
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE auth_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE auth_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admin full access on barbers" ON public.barbers;
CREATE POLICY "Admin full access on barbers" ON public.barbers
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE auth_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE auth_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admin full access on bookings" ON public.bookings;
CREATE POLICY "Admin full access on bookings" ON public.bookings
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE auth_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE auth_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admin full access on clients" ON public.clients;
CREATE POLICY "Admin full access on clients" ON public.clients
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE auth_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE auth_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admin full access on email_subscribers" ON public.email_subscribers;
CREATE POLICY "Admin full access on email_subscribers" ON public.email_subscribers
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE auth_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE auth_id = auth.uid() AND role = 'admin'));

-- Membership signup creates its own client role row.
DROP POLICY IF EXISTS "Users can insert own client role" ON public.user_roles;
CREATE POLICY "Users can insert own client role" ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth_id = auth.uid() AND role = 'client');

-- ── 4. Storage: public buckets do not need broad SELECT (listing) policies ──
DROP POLICY IF EXISTS "Public can view barber photos" ON storage.objects;

-- ── 5. Restrict visit-counter RPCs to service_role only ──
REVOKE ALL ON FUNCTION public.increment_subscriber_visit(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decrement_subscriber_visit(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_subscriber_visit(uuid, boolean) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.decrement_subscriber_visit(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_subscriber_visit(uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrement_subscriber_visit(uuid) TO service_role;
