-- Create barber-portfolios storage bucket (used for profile + portfolio photos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('barber-portfolios', 'barber-portfolios', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read for portfolio images
DROP POLICY IF EXISTS "Public read barber portfolios" ON storage.objects;
CREATE POLICY "Public read barber portfolios" ON storage.objects
  FOR SELECT USING (bucket_id = 'barber-portfolios');

-- Authenticated users can upload (barbers + admins via API service role bypasses RLS)
DROP POLICY IF EXISTS "Authenticated upload barber portfolios" ON storage.objects;
CREATE POLICY "Authenticated upload barber portfolios" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'barber-portfolios');

DROP POLICY IF EXISTS "Authenticated update barber portfolios" ON storage.objects;
CREATE POLICY "Authenticated update barber portfolios" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'barber-portfolios')
  WITH CHECK (bucket_id = 'barber-portfolios');

-- Realtime: live price updates on booking pages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'barber_service'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.barber_service;
  END IF;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;
