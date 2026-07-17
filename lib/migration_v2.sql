-- SAVRON v2 Migration — Run in Supabase SQL Editor
-- ADDITIVE: does NOT drop existing tables
-- =========================================

-- =========================================
-- 1. UPDATE BARBERS TABLE (new columns)
-- =========================================
ALTER TABLE barbers
    ADD COLUMN IF NOT EXISTS instagram_url TEXT,
    ADD COLUMN IF NOT EXISTS google_calendar_id TEXT,
    ADD COLUMN IF NOT EXISTS working_hours JSONB DEFAULT '{"mon":["10:00","17:00"],"tue":["10:00","17:00"],"wed":["10:00","17:00"],"thu":["10:00","17:00"],"fri":["10:00","17:00"],"sat":["10:00","17:00"],"sun":null}'::jsonb;

-- =========================================
-- 2. SERVICES TABLE
-- =========================================
CREATE TABLE IF NOT EXISTS services (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    price_cents INTEGER NOT NULL,
    color_code TEXT DEFAULT '#1B4332',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================
-- 3. BARBER_SERVICE JOIN TABLE
-- =========================================
CREATE TABLE IF NOT EXISTS barber_service (
    barber_id UUID REFERENCES barbers(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE CASCADE,
    PRIMARY KEY (barber_id, service_id)
);

-- =========================================
-- 4. UPDATE BOOKINGS TABLE
-- =========================================
ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;

-- =========================================
-- 5. RLS FOR NEW TABLES
-- =========================================
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE barber_service ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'services' AND policyname = 'Public can read services') THEN
        CREATE POLICY "Public can read services" ON services FOR SELECT USING (TRUE);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'services' AND policyname = 'Admin full access on services') THEN
        CREATE POLICY "Admin full access on services" ON services FOR ALL USING (
            EXISTS (SELECT 1 FROM user_roles WHERE auth_id = auth.uid() AND role = 'admin')
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'barber_service' AND policyname = 'Public can read barber_service') THEN
        CREATE POLICY "Public can read barber_service" ON barber_service FOR SELECT USING (TRUE);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'barber_service' AND policyname = 'Admin full access on barber_service') THEN
        CREATE POLICY "Admin full access on barber_service" ON barber_service FOR ALL USING (
            EXISTS (SELECT 1 FROM user_roles WHERE auth_id = auth.uid() AND role = 'admin')
        );
    END IF;
END $$;

-- =========================================
-- 6. SEED SERVICES
-- =========================================
INSERT INTO services (name, duration_minutes, price_cents, color_code) VALUES
    ('The Signature Cut', 45, 5500, '#10b981'),
    ('The Executive',     60, 9000, '#3b82f6'),
    ('Haircut + Beard + Hot Towel Shave', 60, 8000, '#f59e0b'),
    ('Kids Cut',          30, 3500, '#14b8a6')
ON CONFLICT DO NOTHING;

-- =========================================
-- 7. SEED BARBER_SERVICE MAPPINGS
-- =========================================
-- Marcus V.: Signature Cut, Executive, Hot Towel Shave, Beard Sculpting
INSERT INTO barber_service (barber_id, service_id)
SELECT b.id, s.id FROM barbers b, services s
WHERE b.slug = 'marcus-v'
  AND s.name IN ('The Signature Cut', 'The Executive', 'Haircut + Beard + Hot Towel Shave')
ON CONFLICT DO NOTHING;

-- James D.: Signature Cut, Executive, Beard Sculpting
INSERT INTO barber_service (barber_id, service_id)
SELECT b.id, s.id FROM barbers b, services s
WHERE b.slug = 'james-d'
  AND s.name IN ('The Signature Cut', 'The Executive', 'Haircut + Beard + Hot Towel Shave')
ON CONFLICT DO NOTHING;

-- Leo R.: Signature Cut, Beard Sculpting, Kids Cut, Hot Towel Shave
INSERT INTO barber_service (barber_id, service_id)
SELECT b.id, s.id FROM barbers b, services s
WHERE b.slug = 'leo-r'
  AND s.name IN ('The Signature Cut', 'Haircut + Beard + Hot Towel Shave', 'Kids Cut')
ON CONFLICT DO NOTHING;

-- =========================================
-- 8. UPDATE SAMPLE IG HANDLES
-- =========================================
UPDATE barbers SET instagram_url = 'https://instagram.com/marcusv.cuts' WHERE slug = 'marcus-v';
UPDATE barbers SET instagram_url = 'https://instagram.com/jamesd.style' WHERE slug = 'james-d';
UPDATE barbers SET instagram_url = 'https://instagram.com/leor.barber' WHERE slug = 'leo-r';
