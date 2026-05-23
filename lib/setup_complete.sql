-- =====================================================
-- SAVRON — COMPLETE SETUP (schema + seed in one file)
-- Run ONLY this file in Supabase SQL Editor.
-- WARNING: drops and rebuilds everything.
-- =====================================================

-- =====================================================
-- 1. DROP EVERYTHING (clean slate)
-- =====================================================
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS barber_service CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS applicants CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS barbers CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;

-- =====================================================
-- 2. USER ROLES
-- =====================================================
CREATE TABLE user_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    auth_id UUID NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'barber', 'client')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. BARBERS
-- =====================================================
CREATE TABLE barbers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    auth_id UUID UNIQUE,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'Barber',
    bio TEXT,
    specialties TEXT[],
    image_url TEXT,
    phone TEXT,
    email TEXT,
    instagram_url TEXT,
    google_calendar_id TEXT,
    google_calendar_tokens JSONB,
    working_hours JSONB DEFAULT '{"mon":["10:00","17:00"],"tue":["10:00","17:00"],"wed":["10:00","17:00"],"thu":["10:00","17:00"],"fri":["10:00","17:00"],"sat":["10:00","17:00"],"sun":null}'::jsonb,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. SERVICES
-- =====================================================
CREATE TABLE services (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    price_cents INTEGER NOT NULL,
    color_code TEXT DEFAULT '#1B4332',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 5. BARBER_SERVICE (join)
-- =====================================================
CREATE TABLE barber_service (
    barber_id UUID REFERENCES barbers(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE CASCADE,
    PRIMARY KEY (barber_id, service_id)
);

-- =====================================================
-- 6. CLIENTS
-- =====================================================
CREATE TABLE clients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    auth_id UUID UNIQUE,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    notes TEXT,
    preferences TEXT,
    membership_status TEXT DEFAULT 'standard' CHECK (membership_status IN ('standard', 'inner_circle', 'vip')),
    visit_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 7. APPLICANTS
-- =====================================================
CREATE TABLE applicants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    ig_handle TEXT,
    experience TEXT NOT NULL,
    license_status TEXT NOT NULL,
    video_url TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'interview')),
    experience_summary TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 8. BOOKINGS
-- =====================================================
CREATE TABLE bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    client_name TEXT,
    client_email TEXT,
    client_phone TEXT,
    service TEXT NOT NULL,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    barber_id UUID REFERENCES barbers(id) ON DELETE SET NULL,
    barber_name TEXT,
    date DATE NOT NULL,
    time TEXT NOT NULL,
    duration TEXT DEFAULT '45 min',
    price TEXT,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    google_event_id TEXT,
    status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'completed', 'cancelled', 'no_show')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 9. ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE user_roles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE barbers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE services     ENABLE ROW LEVEL SECURITY;
ALTER TABLE barber_service ENABLE ROW LEVEL SECURITY;
ALTER TABLE applicants   ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients      ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings     ENABLE ROW LEVEL SECURITY;

-- user_roles
CREATE POLICY "Users read own role"       ON user_roles FOR SELECT USING (auth.uid() = auth_id);
CREATE POLICY "Admin full on user_roles"  ON user_roles FOR ALL    USING (EXISTS (SELECT 1 FROM user_roles WHERE auth_id = auth.uid() AND role = 'admin'));

-- barbers
CREATE POLICY "Public read barbers"       ON barbers FOR SELECT USING (TRUE);
CREATE POLICY "Admin full on barbers"     ON barbers FOR ALL    USING (EXISTS (SELECT 1 FROM user_roles WHERE auth_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Barber read own"           ON barbers FOR SELECT USING (auth.uid() = auth_id);
CREATE POLICY "Barber update own"         ON barbers FOR UPDATE USING (auth.uid() = auth_id);

-- services
CREATE POLICY "Public read services"      ON services FOR SELECT USING (TRUE);
CREATE POLICY "Admin full on services"    ON services FOR ALL    USING (EXISTS (SELECT 1 FROM user_roles WHERE auth_id = auth.uid() AND role = 'admin'));

-- barber_service
CREATE POLICY "Public read barber_service"   ON barber_service FOR SELECT USING (TRUE);
CREATE POLICY "Admin full on barber_service" ON barber_service FOR ALL    USING (EXISTS (SELECT 1 FROM user_roles WHERE auth_id = auth.uid() AND role = 'admin'));

-- applicants
CREATE POLICY "Public apply"              ON applicants FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Admin full on applicants"  ON applicants FOR ALL    USING (EXISTS (SELECT 1 FROM user_roles WHERE auth_id = auth.uid() AND role = 'admin'));

-- clients
CREATE POLICY "Public insert clients"     ON clients FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Admin full on clients"     ON clients FOR ALL    USING (EXISTS (SELECT 1 FROM user_roles WHERE auth_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Client read own"           ON clients FOR SELECT USING (auth.uid() = auth_id);
CREATE POLICY "Client update own"         ON clients FOR UPDATE USING (auth.uid() = auth_id);

-- bookings
CREATE POLICY "Public book"               ON bookings FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Admin full on bookings"    ON bookings FOR ALL    USING (EXISTS (SELECT 1 FROM user_roles WHERE auth_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Barber read own bookings"  ON bookings FOR SELECT USING (barber_id IN (SELECT id FROM barbers WHERE auth_id = auth.uid()));
CREATE POLICY "Barber update own bookings" ON bookings FOR UPDATE USING (barber_id IN (SELECT id FROM barbers WHERE auth_id = auth.uid()));
CREATE POLICY "Client read own bookings"  ON bookings FOR SELECT USING (client_id IN (SELECT id FROM clients WHERE auth_id = auth.uid()));

-- =====================================================
-- 10. BARBERS DATA
-- =====================================================
INSERT INTO barbers (name, slug, role, bio, specialties, image_url, phone, email, instagram_url, active) VALUES
    ('Albi A.', 'albi-a', 'Master Barber & Owner',
     'The founder of Sabrón. Albeiro has 15+ years behind the chair and built this shop from the ground up. Known for his legendary skin fades and his ability to read exactly what a client wants.',
     ARRAY['Skin Fades', 'Beard Design', 'Hair Art'],
     'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=2000&auto=format&fit=crop',
     '(612) 555-0100', 'albi@savronmpls.com', 'https://instagram.com/albi.savron', TRUE),

    ('Marcus V.', 'marcus-v', 'Master Barber',
     'A decade of precision cuts and signature fades. Marcus trained under three master barbers in Chicago before bringing his craft to Minneapolis.',
     ARRAY['Signature Fades', 'Hot Towel Shaves', 'Beard Sculpting'],
     'https://images.unsplash.com/photo-1534308143481-c55f00be8bd7?q=80&w=2000&auto=format&fit=crop',
     '(612) 555-0101', 'marcus@savronmpls.com', 'https://instagram.com/marcusv.cuts', TRUE),

    ('James D.', 'james-d', 'Senior Stylist',
     'Fashion-forward cuts with architectural precision. James brings a modern edge to classic barbering with 7 years of experience across Minneapolis and New York.',
     ARRAY['Modern Cuts', 'Textured Styles', 'Color Work'],
     'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=2000&auto=format&fit=crop',
     '(612) 555-0102', 'james@savronmpls.com', 'https://instagram.com/jamesd.style', TRUE),

    ('Leo R.', 'leo-r', 'Barber',
     'Clean lines and sharp details. Leo specializes in classic cuts with a contemporary twist. 4 years behind the chair and a favorite for kids and family cuts.',
     ARRAY['Classic Cuts', 'Line-ups', 'Kids Cuts'],
     'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=2000&auto=format&fit=crop',
     '(612) 555-0103', 'leo@savronmpls.com', 'https://instagram.com/leor.barber', TRUE);

-- =====================================================
-- 11. SERVICES DATA
-- =====================================================
INSERT INTO services (name, duration_minutes, price_cents, color_code, active) VALUES
    ('The Signature Cut', 45, 5500, '#10b981', TRUE),
    ('The Executive',     60, 9000, '#3b82f6', TRUE),
    ('Beard Sculpting',   30, 4000, '#f59e0b', TRUE),
    ('Hot Towel Shave',   45, 5000, '#a855f7', TRUE),
    ('Kids Cut',          30, 3500, '#14b8a6', TRUE);

-- =====================================================
-- 12. BARBER → SERVICE MAPPINGS
-- =====================================================
INSERT INTO barber_service (barber_id, service_id)
SELECT b.id, s.id FROM barbers b, services s WHERE b.slug = 'albi-a';

INSERT INTO barber_service (barber_id, service_id)
SELECT b.id, s.id FROM barbers b, services s
WHERE b.slug = 'marcus-v' AND s.name IN ('The Signature Cut','The Executive','Hot Towel Shave','Beard Sculpting');

INSERT INTO barber_service (barber_id, service_id)
SELECT b.id, s.id FROM barbers b, services s
WHERE b.slug = 'james-d' AND s.name IN ('The Signature Cut','The Executive','Beard Sculpting');

INSERT INTO barber_service (barber_id, service_id)
SELECT b.id, s.id FROM barbers b, services s
WHERE b.slug = 'leo-r' AND s.name IN ('The Signature Cut','Beard Sculpting','Kids Cut','Hot Towel Shave');

-- =====================================================
-- 13. CLIENTS
-- =====================================================
INSERT INTO clients (name, email, phone, membership_status, visit_count, notes, preferences) VALUES
    ('Adrian Reyes',    'adrian.reyes@email.com',  '(612) 555-1001', 'vip',          24, 'Prefers Marcus. Always books first slot.',  'Low fade, beard trim. No product on top.'),
    ('David Chen',      'david.chen@email.com',    '(612) 555-1002', 'inner_circle', 15, 'Consistent regular. Tips well.',            'Textured crop, clean neckline.'),
    ('Marcus Taylor',   'marcus.t@email.com',      '(612) 555-1003', 'standard',      3, 'New client, referred by Adrian.',           'Still deciding on a regular style.'),
    ('Jamal Williams',  'jamal.w@email.com',       '(612) 555-1004', 'inner_circle', 18, 'Works downtown, books lunch slots.',        'Temp fade, always wants lineup.'),
    ('Erik Johansson',  'erik.j@email.com',        '(612) 555-1005', 'vip',          30, 'Founding member. Brings friends.',          'Executive cut, hot towel shave.'),
    ('Carlos Mendoza',  'carlos.m@email.com',      '(612) 555-1006', 'standard',      5, 'College student, comes once a month.',      'Buzz cut, quick and clean.'),
    ('Tyler Brooks',    'tyler.b@email.com',       '(612) 555-1007', 'standard',      1, 'Walk-in that converted.',                   'Exploring styles.'),
    ('Darnell Jackson', 'darnell.j@email.com',     '(612) 555-1008', 'inner_circle', 12, 'Brings his son too.',                       'Skin fade, beard shape-up.'),
    ('Marco Diaz',      'marco.d@email.com',       '(612) 555-1009', 'vip',          40, 'Longest standing client. Never misses.',    'Old school taper, hard part.'),
    ('Kevin Park',      'kevin.p@email.com',       '(612) 555-1010', 'standard',      2, 'Referred by Marco.',                        'Drop fade, natural top.');

-- =====================================================
-- 14. BOOKINGS — TODAY (full schedule for host dashboard)
-- =====================================================
INSERT INTO bookings (client_name, client_email, client_phone, service, barber_id, barber_name, date, time, duration, price, status) VALUES
    -- 10:00 AM
    ('Adrian Reyes',   'adrian.reyes@email.com', '(612) 555-1001', 'The Signature Cut', (SELECT id FROM barbers WHERE slug='albi-a'),   'Albi A.',   CURRENT_DATE, '10:00 AM', '45 min', '$55', 'confirmed'),
    ('David Chen',     'david.chen@email.com',   '(612) 555-1002', 'The Executive',     (SELECT id FROM barbers WHERE slug='marcus-v'), 'Marcus V.', CURRENT_DATE, '10:00 AM', '60 min', '$90', 'confirmed'),
    ('Erik Johansson', 'erik.j@email.com',       '(612) 555-1005', 'Hot Towel Shave',   (SELECT id FROM barbers WHERE slug='james-d'),  'James D.',  CURRENT_DATE, '10:00 AM', '45 min', '$50', 'confirmed'),
    ('Carlos Mendoza', 'carlos.m@email.com',     '(612) 555-1006', 'Kids Cut',          (SELECT id FROM barbers WHERE slug='leo-r'),    'Leo R.',    CURRENT_DATE, '10:00 AM', '30 min', '$35', 'confirmed'),
    -- 10:45 AM
    ('Jamal Williams', 'jamal.w@email.com',      '(612) 555-1004', 'Beard Sculpting',   (SELECT id FROM barbers WHERE slug='albi-a'),   'Albi A.',   CURRENT_DATE, '10:45 AM', '30 min', '$40', 'confirmed'),
    ('Marco Diaz',     'marco.d@email.com',      '(612) 555-1009', 'The Signature Cut', (SELECT id FROM barbers WHERE slug='marcus-v'), 'Marcus V.', CURRENT_DATE, '10:45 AM', '45 min', '$55', 'confirmed'),
    ('Kevin Park',     'kevin.p@email.com',      '(612) 555-1010', 'The Signature Cut', (SELECT id FROM barbers WHERE slug='leo-r'),    'Leo R.',    CURRENT_DATE, '10:45 AM', '45 min', '$55', 'confirmed'),
    -- 11:30 AM
    ('Tyler Brooks',   'tyler.b@email.com',      '(612) 555-1007', 'The Executive',     (SELECT id FROM barbers WHERE slug='albi-a'),   'Albi A.',   CURRENT_DATE, '11:30 AM', '60 min', '$90', 'confirmed'),
    ('Darnell Jackson','darnell.j@email.com',    '(612) 555-1008', 'The Signature Cut', (SELECT id FROM barbers WHERE slug='james-d'),  'James D.',  CURRENT_DATE, '11:30 AM', '45 min', '$55', 'confirmed'),
    -- 1:00 PM
    ('Adrian Reyes',   'adrian.reyes@email.com', '(612) 555-1001', 'Hot Towel Shave',   (SELECT id FROM barbers WHERE slug='marcus-v'), 'Marcus V.', CURRENT_DATE, '1:00 PM',  '45 min', '$50', 'confirmed'),
    ('Marcus Taylor',  'marcus.t@email.com',     '(612) 555-1003', 'Kids Cut',          (SELECT id FROM barbers WHERE slug='leo-r'),    'Leo R.',    CURRENT_DATE, '1:00 PM',  '30 min', '$35', 'confirmed'),
    ('Erik Johansson', 'erik.j@email.com',       '(612) 555-1005', 'The Executive',     (SELECT id FROM barbers WHERE slug='albi-a'),   'Albi A.',   CURRENT_DATE, '1:00 PM',  '60 min', '$90', 'confirmed'),
    -- 1:45 PM
    ('Kevin Park',     'kevin.p@email.com',      '(612) 555-1010', 'Beard Sculpting',   (SELECT id FROM barbers WHERE slug='james-d'),  'James D.',  CURRENT_DATE, '1:45 PM',  '30 min', '$40', 'confirmed'),
    -- 2:30 PM
    ('Jamal Williams', 'jamal.w@email.com',      '(612) 555-1004', 'The Signature Cut', (SELECT id FROM barbers WHERE slug='marcus-v'), 'Marcus V.', CURRENT_DATE, '2:30 PM',  '45 min', '$55', 'confirmed'),
    ('David Chen',     'david.chen@email.com',   '(612) 555-1002', 'Beard Sculpting',   (SELECT id FROM barbers WHERE slug='albi-a'),   'Albi A.',   CURRENT_DATE, '2:30 PM',  '30 min', '$40', 'confirmed'),
    -- 3:15 PM
    ('Marco Diaz',     'marco.d@email.com',      '(612) 555-1009', 'Hot Towel Shave',   (SELECT id FROM barbers WHERE slug='leo-r'),    'Leo R.',    CURRENT_DATE, '3:15 PM',  '45 min', '$50', 'confirmed'),
    -- 4:00 PM
    ('Carlos Mendoza', 'carlos.m@email.com',     '(612) 555-1006', 'The Signature Cut', (SELECT id FROM barbers WHERE slug='marcus-v'), 'Marcus V.', CURRENT_DATE, '4:00 PM',  '45 min', '$55', 'confirmed'),
    ('Tyler Brooks',   'tyler.b@email.com',      '(612) 555-1007', 'The Signature Cut', (SELECT id FROM barbers WHERE slug='james-d'),  'James D.',  CURRENT_DATE, '4:00 PM',  '45 min', '$55', 'confirmed');

-- =====================================================
-- 15. BOOKINGS — TOMORROW
-- =====================================================
INSERT INTO bookings (client_name, client_email, client_phone, service, barber_id, barber_name, date, time, duration, price, status) VALUES
    ('Darnell Jackson','darnell.j@email.com',    '(612) 555-1008', 'The Signature Cut', (SELECT id FROM barbers WHERE slug='marcus-v'), 'Marcus V.', CURRENT_DATE+1, '10:00 AM', '45 min', '$55', 'confirmed'),
    ('Adrian Reyes',   'adrian.reyes@email.com', '(612) 555-1001', 'The Executive',     (SELECT id FROM barbers WHERE slug='albi-a'),   'Albi A.',   CURRENT_DATE+1, '10:00 AM', '60 min', '$90', 'confirmed'),
    ('Marco Diaz',     'marco.d@email.com',      '(612) 555-1009', 'Hot Towel Shave',   (SELECT id FROM barbers WHERE slug='james-d'),  'James D.',  CURRENT_DATE+1, '10:45 AM', '45 min', '$50', 'confirmed'),
    ('Kevin Park',     'kevin.p@email.com',      '(612) 555-1010', 'Kids Cut',          (SELECT id FROM barbers WHERE slug='leo-r'),    'Leo R.',    CURRENT_DATE+1, '11:30 AM', '30 min', '$35', 'confirmed'),
    ('Tyler Brooks',   'tyler.b@email.com',      '(612) 555-1007', 'Beard Sculpting',   (SELECT id FROM barbers WHERE slug='albi-a'),   'Albi A.',   CURRENT_DATE+1, '1:00 PM',  '30 min', '$40', 'confirmed'),
    ('Erik Johansson', 'erik.j@email.com',       '(612) 555-1005', 'The Signature Cut', (SELECT id FROM barbers WHERE slug='marcus-v'), 'Marcus V.', CURRENT_DATE+1, '2:30 PM',  '45 min', '$55', 'confirmed');

-- =====================================================
-- 16. BOOKINGS — PAST
-- =====================================================
INSERT INTO bookings (client_name, client_email, client_phone, service, barber_id, barber_name, date, time, duration, price, status) VALUES
    ('Adrian Reyes',   'adrian.reyes@email.com', '(612) 555-1001', 'The Signature Cut', (SELECT id FROM barbers WHERE slug='marcus-v'), 'Marcus V.', CURRENT_DATE-7, '10:00 AM', '45 min', '$55', 'completed'),
    ('David Chen',     'david.chen@email.com',   '(612) 555-1002', 'The Executive',     (SELECT id FROM barbers WHERE slug='james-d'),  'James D.',  CURRENT_DATE-7, '11:00 AM', '60 min', '$90', 'completed'),
    ('Erik Johansson', 'erik.j@email.com',       '(612) 555-1005', 'Hot Towel Shave',   (SELECT id FROM barbers WHERE slug='marcus-v'), 'Marcus V.', CURRENT_DATE-3, '2:00 PM',  '45 min', '$50', 'completed'),
    ('Jamal Williams', 'jamal.w@email.com',      '(612) 555-1004', 'The Signature Cut', (SELECT id FROM barbers WHERE slug='james-d'),  'James D.',  CURRENT_DATE-5, '10:00 AM', '45 min', '$55', 'completed'),
    ('Darnell Jackson','darnell.j@email.com',    '(612) 555-1008', 'Beard Sculpting',   (SELECT id FROM barbers WHERE slug='leo-r'),    'Leo R.',    CURRENT_DATE-2, '3:00 PM',  '30 min', '$40', 'completed'),
    ('Marco Diaz',     'marco.d@email.com',      '(612) 555-1009', 'The Executive',     (SELECT id FROM barbers WHERE slug='albi-a'),   'Albi A.',   CURRENT_DATE-1, '10:00 AM', '60 min', '$90', 'completed'),
    ('Carlos Mendoza', 'carlos.m@email.com',     '(612) 555-1006', 'The Signature Cut', (SELECT id FROM barbers WHERE slug='leo-r'),    'Leo R.',    CURRENT_DATE-4, '1:00 PM',  '45 min', '$55', 'no_show'),
    ('Tyler Brooks',   'tyler.b@email.com',      '(612) 555-1007', 'The Executive',     (SELECT id FROM barbers WHERE slug='marcus-v'), 'Marcus V.', CURRENT_DATE-1, '4:00 PM',  '60 min', '$90', 'cancelled');

-- =====================================================
-- 17. APPLICANTS
-- =====================================================
INSERT INTO applicants (name, email, phone, ig_handle, experience, license_status, status, notes) VALUES
    ('Jordan Miles',     'jordan.m@email.com',  '(612) 555-2001', '@jordancuts', '3-5 Years',  'Active Master Barber',  'pending',   NULL),
    ('Andre Washington', 'andre.w@email.com',   '(612) 555-2002', '@drecutz',    '5-10 Years', 'Active Master Barber',  'interview', 'Strong portfolio. Schedule for in-person demo.'),
    ('Trevor Lin',       'trevor.l@email.com',  '(612) 555-2003', '@trevfades',  '1-3 Years',  'Student / Apprentice',  'rejected',  'Promising but needs more experience.'),
    ('Deja Price',       'deja.p@email.com',    '(612) 555-2004', '@dejacutz',   '5-10 Years', 'Active Master Barber',  'pending',   NULL),
    ('Ricky Vega',       'ricky.v@email.com',   '(612) 555-2005', '@rickyvega',  '3-5 Years',  'Active Barber License', 'interview', 'Lives in St. Paul. Open to full-time.');

-- =====================================================
-- 18. LINK AUTH USERS (run AFTER creating users in Auth)
-- =====================================================
-- After creating users in Supabase Dashboard → Authentication → Users:
--
-- Admin (Albeiro):
--   INSERT INTO user_roles (auth_id, role) VALUES ('<UUID>', 'admin');
--
-- Barbers:
--   UPDATE barbers SET auth_id = '<UUID>' WHERE slug = 'marcus-v';
--   INSERT INTO user_roles (auth_id, role) VALUES ('<UUID>', 'barber');
--   (repeat for albi-a, james-d, leo-r)
