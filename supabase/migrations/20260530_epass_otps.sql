-- ePass OTP codes table (custom auth, bypasses Supabase magic link)
CREATE TABLE IF NOT EXISTS epass_otps (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    email text NOT NULL,
    code text NOT NULL,
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
    created_at timestamptz DEFAULT now()
);

-- Index for fast lookup on verify
CREATE INDEX IF NOT EXISTS epass_otps_email_idx ON epass_otps (email);

-- Auto-cleanup expired codes (optional, keeps table tidy)
CREATE OR REPLACE FUNCTION cleanup_expired_epass_otps()
RETURNS void AS $$
BEGIN
    DELETE FROM epass_otps WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;
