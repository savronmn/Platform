-- Track where each prospect email was discovered (maps, website, instagram, etc.)

ALTER TABLE public.outreach_prospects
    ADD COLUMN IF NOT EXISTS email_source text;

ALTER TABLE public.outreach_prospects DROP CONSTRAINT IF EXISTS outreach_prospects_email_source_check;
ALTER TABLE public.outreach_prospects
    ADD CONSTRAINT outreach_prospects_email_source_check
    CHECK (email_source IS NULL OR email_source IN ('maps', 'website', 'instagram', 'reviews', 'manual', 'savron'));

CREATE INDEX IF NOT EXISTS idx_outreach_prospects_email_source ON public.outreach_prospects(email_source);
