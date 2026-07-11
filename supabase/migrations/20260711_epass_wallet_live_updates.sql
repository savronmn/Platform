-- ePass live updates: Apple Wallet web service + realtime broadcast support

ALTER TABLE public.email_subscribers
  ADD COLUMN IF NOT EXISTS wallet_auth_token text,
  ADD COLUMN IF NOT EXISTS pass_updated_at timestamptz DEFAULT now();

CREATE TABLE IF NOT EXISTS public.wallet_pass_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid REFERENCES public.email_subscribers(id) ON DELETE CASCADE,
  device_library_identifier text NOT NULL,
  push_token text NOT NULL,
  pass_type_identifier text NOT NULL,
  serial_number text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_library_identifier, pass_type_identifier, serial_number)
);

CREATE INDEX IF NOT EXISTS wallet_pass_registrations_serial_idx
  ON public.wallet_pass_registrations (serial_number);

ALTER TABLE public.wallet_pass_registrations ENABLE ROW LEVEL SECURITY;

-- Only service-role API routes touch registrations; no public policies needed.

-- Backfill auth tokens for existing passes so Apple Wallet can register for updates
UPDATE public.email_subscribers
SET wallet_auth_token = encode(gen_random_bytes(32), 'hex')
WHERE wallet_auth_token IS NULL;

UPDATE public.email_subscribers
SET pass_updated_at = COALESCE(pass_updated_at, now())
WHERE pass_updated_at IS NULL;

-- Realtime publication for email_subscribers (fallback alongside broadcast)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'email_subscribers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.email_subscribers;
  END IF;
END $$;
