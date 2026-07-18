-- Enrichment fields for outreach barber prospecting (Apify scan pipeline).

ALTER TABLE public.outreach_prospects
    ADD COLUMN IF NOT EXISTS barber_id uuid REFERENCES public.barbers(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS website text,
    ADD COLUMN IF NOT EXISTS google_maps_url text,
    ADD COLUMN IF NOT EXISTS years_experience integer,
    ADD COLUMN IF NOT EXISTS price_min_cents integer,
    ADD COLUMN IF NOT EXISTS price_max_cents integer,
    ADD COLUMN IF NOT EXISTS rating numeric(3,2),
    ADD COLUMN IF NOT EXISTS review_count integer,
    ADD COLUMN IF NOT EXISTS reputation_score numeric(5,2),
    ADD COLUMN IF NOT EXISTS enrichment_data jsonb,
    ADD COLUMN IF NOT EXISTS enriched_at timestamptz,
    ADD COLUMN IF NOT EXISTS is_savron_barber boolean NOT NULL DEFAULT false;

ALTER TABLE public.outreach_prospects DROP CONSTRAINT IF EXISTS outreach_prospects_source_check;
ALTER TABLE public.outreach_prospects
    ADD CONSTRAINT outreach_prospects_source_check
    CHECK (source IN ('seed', 'apify', 'apollo', 'savron'));

CREATE INDEX IF NOT EXISTS idx_outreach_prospects_barber_id ON public.outreach_prospects(barber_id);
CREATE INDEX IF NOT EXISTS idx_outreach_prospects_rating ON public.outreach_prospects(rating DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_outreach_prospects_reputation ON public.outreach_prospects(reputation_score DESC NULLS LAST);
