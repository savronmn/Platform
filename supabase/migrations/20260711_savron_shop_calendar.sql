-- Store Savron shop Google Calendar OAuth tokens (savronmn@gmail.com)

CREATE TABLE IF NOT EXISTS public.system_config (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
-- Service role only — no public policies.
