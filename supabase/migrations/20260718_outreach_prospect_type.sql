-- Classify outreach leads as individual barbers vs barbershop businesses.

ALTER TABLE public.outreach_prospects
    ADD COLUMN IF NOT EXISTS prospect_type text NOT NULL DEFAULT 'shop'
        CHECK (prospect_type IN ('individual', 'shop'));

CREATE INDEX IF NOT EXISTS idx_outreach_prospects_type ON public.outreach_prospects(prospect_type);

-- Reclassify SAVRON barbers as individuals.
UPDATE public.outreach_prospects
SET prospect_type = 'individual'
WHERE is_savron_barber = true OR source = 'savron';
