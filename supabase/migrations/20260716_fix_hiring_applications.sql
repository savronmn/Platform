-- Fix hiring application flow: storage bucket + duplicate email prevention.
-- Safe to re-run.

-- 1. Ensure applicant-videos storage bucket exists (public read for admin playback)
INSERT INTO storage.buckets (id, name, public)
VALUES ('applicant-videos', 'applicant-videos', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- 2. Service role uploads via API; allow public read of individual objects by URL
DROP POLICY IF EXISTS "Public can view applicant videos" ON storage.objects;
CREATE POLICY "Public can view applicant videos" ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'applicant-videos');

-- 3. Prevent duplicate applications by email (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS applicants_email_unique
  ON public.applicants (lower(btrim(email)));
