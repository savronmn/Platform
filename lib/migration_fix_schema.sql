-- ============================================================
-- SAVRON — Fix Missing Columns & Tables
-- Run this ENTIRE file in Supabase SQL Editor
-- ============================================================

-- 1) ADD MISSING COLUMNS TO BOOKINGS
ALTER TABLE IF EXISTS bookings ADD COLUMN IF NOT EXISTS client_photo_url TEXT;

-- 2) ADD MISSING COLUMNS TO BARBERS
ALTER TABLE IF EXISTS barbers ADD COLUMN IF NOT EXISTS license_number TEXT;
ALTER TABLE IF EXISTS barbers ADD COLUMN IF NOT EXISTS services_offered TEXT[];
ALTER TABLE IF EXISTS barbers ADD COLUMN IF NOT EXISTS portfolio_images TEXT[] DEFAULT ARRAY[]::text[];

-- 3) ADD MISSING COLUMNS TO SERVICES
ALTER TABLE IF EXISTS services ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'emerald';
ALTER TABLE IF EXISTS services ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE IF EXISTS services ADD COLUMN IF NOT EXISTS sort_order INTEGER;

-- 4) CREATE EMAIL_SUBSCRIBERS TABLE (missing entirely)
CREATE TABLE IF NOT EXISTS public.email_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    pass_serial_number TEXT UNIQUE,
    google_pass_object_id TEXT,
    visit_count INTEGER DEFAULT 0,
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    last_visit_at TIMESTAMPTZ,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_subscribers_email ON public.email_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_email_subscribers_active ON public.email_subscribers(active);

-- 5) CREATE BARBER_CHANGE_REQUESTS TABLE (missing entirely)
CREATE TABLE IF NOT EXISTS public.barber_change_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('schedule', 'price', 'service', 'profile')),
    payload JSONB NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_change_requests_status ON public.barber_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_change_requests_barber ON public.barber_change_requests(barber_id);

-- ============================================================
-- VERIFY
-- ============================================================
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'bookings';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'email_subscribers';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'barber_change_requests';
