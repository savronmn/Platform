-- Store campaign content snapshots for outreach email history & preview replay.

ALTER TABLE public.outreach_sends
    ADD COLUMN IF NOT EXISTS campaign_name text,
    ADD COLUMN IF NOT EXISTS email_content jsonb,
    ADD COLUMN IF NOT EXISTS html_snapshot text;

CREATE INDEX IF NOT EXISTS idx_outreach_sends_campaign_name ON public.outreach_sends(campaign_name);
