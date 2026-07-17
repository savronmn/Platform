-- Outreach prospecting tables for admin cold-email campaigns.
-- Prospects can come from seed data or Apify Google Maps imports.

CREATE TABLE IF NOT EXISTS public.outreach_prospects (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id   text NOT NULL UNIQUE,
    name          text NOT NULL,
    email         text,
    business_name text NOT NULL,
    area          text NOT NULL,
    phone         text,
    instagram     text,
    source        text NOT NULL DEFAULT 'seed' CHECK (source IN ('seed', 'apify', 'apollo')),
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_prospects_area ON public.outreach_prospects(area);
CREATE INDEX IF NOT EXISTS idx_outreach_prospects_source ON public.outreach_prospects(source);
CREATE INDEX IF NOT EXISTS idx_outreach_prospects_email ON public.outreach_prospects(email);

CREATE TABLE IF NOT EXISTS public.outreach_sends (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sent_by        uuid,
    sent_by_email  text,
    template       text NOT NULL,
    subject        text,
    prospect_count integer NOT NULL DEFAULT 0,
    sent_count     integer NOT NULL DEFAULT 0,
    failed_count   integer NOT NULL DEFAULT 0,
    prospect_ids   text[] NOT NULL DEFAULT ARRAY[]::text[],
    errors         jsonb,
    created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_sends_created_at ON public.outreach_sends(created_at DESC);

ALTER TABLE public.outreach_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_sends ENABLE ROW LEVEL SECURITY;

-- No public policies: accessed only via service role in API routes.
