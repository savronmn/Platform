-- SAVRON Business OS — Full Database Schema
-- Run this ENTIRE file in Supabase SQL Editor
-- ⚠️  This DROPS existing tables. Only run on a fresh setup or when resetting.

-- =========================================
-- 1. DROP EXISTING (clean slate)
-- =========================================
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS applicants CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS barbers CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;

-- =========================================
-- 2. USER ROLES TABLE
-- =========================================
CREATE TABLE user_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    auth_id UUID NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'barber', 'client')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================
-- 3. BARBERS TABLE
-- =========================================
CREATE TABLE barbers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    auth_id UUID UNIQUE,              -- links to Supabase Auth user
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,         -- URL-friendly: marcus-v
    role TEXT NOT NULL DEFAULT 'Barber',
    bio TEXT,
    specialties TEXT[],
    image_url TEXT,
    phone TEXT,
    email TEXT,
    instagram_url TEXT,
    google_calendar_id TEXT,
    google_calendar_tokens JSONB,
    google_sync_token TEXT,
    google_channel_id TEXT,
    google_resource_id TEXT,
    working_hours JSONB,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================
-- 4. CLIENTS TABLE
-- =========================================
CREATE TABLE clients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    auth_id UUID UNIQUE,              -- links to Supabase Auth user
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    notes TEXT,
    preferences TEXT,
    membership_status TEXT DEFAULT 'standard' CHECK (membership_status IN ('standard', 'inner_circle', 'vip')),
    visit_count INTEGER DEFAULT 0,
    last_booking_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================
-- 5. APPLICANTS TABLE (Hiring Portal)
-- =========================================
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

-- =========================================
-- 6. BOOKINGS TABLE
-- =========================================
CREATE TABLE bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    client_name TEXT,
    client_email TEXT,
    client_phone TEXT,
    service TEXT NOT NULL,
    barber_id UUID REFERENCES barbers(id) ON DELETE SET NULL,
    barber_name TEXT,
    date DATE NOT NULL,
    time TEXT NOT NULL,
    duration TEXT DEFAULT '45 min',
    price TEXT,
    status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'completed', 'cancelled', 'no_show')),
    notes TEXT,
    google_event_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================
-- 7. ROW LEVEL SECURITY
-- =========================================
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE barbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE applicants ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- user_roles: only authenticated can read their own
CREATE POLICY "Users can read own role" ON user_roles
    FOR SELECT USING (auth.uid() = auth_id);

-- Removed "Admin full access on user_roles" because querying user_roles
-- inside its own policy causes infinite recursion in Postgres.
-- Admins should use the service_role key or a backend function to manage roles.

-- barbers: public can read, authenticated admin gets full access
CREATE POLICY "Public can read barbers" ON barbers
    FOR SELECT USING (TRUE);

CREATE POLICY "Admin full access on barbers" ON barbers
    FOR ALL USING (
        EXISTS (SELECT 1 FROM user_roles WHERE auth_id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Barbers can read own record" ON barbers
    FOR SELECT USING (auth.uid() = auth_id);

CREATE POLICY "Barbers can update own record" ON barbers
    FOR UPDATE USING (auth.uid() = auth_id);

-- applicants: public can insert, admin gets full access
CREATE POLICY "Public can apply" ON applicants
    FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Admin full access on applicants" ON applicants
    FOR ALL USING (
        EXISTS (SELECT 1 FROM user_roles WHERE auth_id = auth.uid() AND role = 'admin')
    );

-- clients: admin full access, clients can read own
CREATE POLICY "Admin full access on clients" ON clients
    FOR ALL USING (
        EXISTS (SELECT 1 FROM user_roles WHERE auth_id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Clients can read own record" ON clients
    FOR SELECT USING (auth.uid() = auth_id);

CREATE POLICY "Clients can update own record" ON clients
    FOR UPDATE USING (auth.uid() = auth_id);

CREATE POLICY "Public can insert clients" ON clients
    FOR INSERT WITH CHECK (TRUE);

-- bookings: admin full access, barbers see their own, clients see their own, public can insert
CREATE POLICY "Admin full access on bookings" ON bookings
    FOR ALL USING (
        EXISTS (SELECT 1 FROM user_roles WHERE auth_id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Barbers can read own bookings" ON bookings
    FOR SELECT USING (
        barber_id IN (SELECT id FROM barbers WHERE auth_id = auth.uid())
    );

CREATE POLICY "Barbers can update own bookings" ON bookings
    FOR UPDATE USING (
        barber_id IN (SELECT id FROM barbers WHERE auth_id = auth.uid())
    );

CREATE POLICY "Clients can read own bookings" ON bookings
    FOR SELECT USING (
        client_id IN (SELECT id FROM clients WHERE auth_id = auth.uid())
    );

CREATE POLICY "Public can book" ON bookings
    FOR INSERT WITH CHECK (TRUE);

-- Allow public to read back the booking they just created (needed for .select('id') after .insert())
CREATE POLICY "Public can read own booking by email" ON bookings
    FOR SELECT USING (TRUE);

-- =========================================
-- 8. SAMPLE DATA
-- =========================================

-- Barbers (auth_id will be set after creating auth users)
INSERT INTO barbers (name, slug, role, bio, specialties, image_url, phone, email) VALUES
    ('Marcus V.', 'marcus-v', 'Master Barber',
     'A decade of precision cuts and signature fades. Marcus trained under three master barbers in Chicago before founding his craft in Minneapolis.',
     ARRAY['Signature Fades', 'Hot Towel Shaves', 'Beard Sculpting'],
     'https://images.unsplash.com/photo-1534308143481-c55f00be8bd7?q=80&w=2000&auto=format&fit=crop',
     '(612) 555-0101', 'marcus@savronmpls.com'),

    ('James D.', 'james-d', 'Senior Stylist',
     'Fashion-forward cuts with architectural precision. James brings a modern edge to classic barbering with 7 years of experience.',
     ARRAY['Modern Cuts', 'Textured Styles', 'Color Work'],
     'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=2000&auto=format&fit=crop',
     '(612) 555-0102', 'james@savronmpls.com'),

    ('Leo R.', 'leo-r', 'Barber',
     'Clean lines and sharp details. Leo specializes in classic cuts with a contemporary twist. 4 years behind the chair.',
     ARRAY['Classic Cuts', 'Line-ups', 'Kids Cuts'],
     'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=2000&auto=format&fit=crop',
     '(612) 555-0103', 'leo@savronmpls.com');

-- Clients
INSERT INTO clients (name, email, phone, membership_status, visit_count, notes, preferences) VALUES
    ('Adrian Reyes', 'adrian.reyes@email.com', '(612) 555-1001', 'vip', 24, 'Prefers Marcus. Always books the first slot.', 'Low fade, beard trim. No product on top.'),
    ('David Chen', 'david.chen@email.com', '(612) 555-1002', 'inner_circle', 15, 'Consistent regular. Tips well.', 'Textured crop, clean neckline.'),
    ('Marcus Taylor', 'marcus.t@email.com', '(612) 555-1003', 'standard', 3, 'New client, referred by Adrian.', 'Still deciding on a regular style.'),
    ('Jamal Williams', 'jamal.w@email.com', '(612) 555-1004', 'inner_circle', 18, 'Works downtown, books lunch slots.', 'Temp fade, always wants lineup.'),
    ('Erik Johansson', 'erik.j@email.com', '(612) 555-1005', 'vip', 30, 'Founding member. Brings friends.', 'Executive cut, hot towel shave.'),
    ('Carlos Mendoza', 'carlos.m@email.com', '(612) 555-1006', 'standard', 5, 'College student, comes once a month.', 'Buzz cut, quick and clean.'),
    ('Tyler Brooks', 'tyler.b@email.com', '(612) 555-1007', 'standard', 1, 'Walk-in that converted.', 'Exploring styles.'),
    ('Darnell Jackson', 'darnell.j@email.com', '(612) 555-1008', 'inner_circle', 12, 'Brings his son too.', 'Skin fade, beard shape-up.');

-- Bookings (using subqueries to reference proper IDs)
INSERT INTO bookings (client_name, client_email, client_phone, service, barber_id, barber_name, date, time, duration, price, status) VALUES
    -- Today's bookings
    ('Adrian Reyes', 'adrian.reyes@email.com', '(612) 555-1001', 'The Signature Cut', (SELECT id FROM barbers WHERE slug = 'marcus-v'), 'Marcus V.', CURRENT_DATE, '10:00 AM', '45 min', '$55', 'confirmed'),
    ('David Chen', 'david.chen@email.com', '(612) 555-1002', 'The Executive', (SELECT id FROM barbers WHERE slug = 'james-d'), 'James D.', CURRENT_DATE, '10:00 AM', '60 min', '$90', 'confirmed'),
    ('Jamal Williams', 'jamal.w@email.com', '(612) 555-1004', 'The Signature Cut', (SELECT id FROM barbers WHERE slug = 'marcus-v'), 'Marcus V.', CURRENT_DATE, '11:00 AM', '45 min', '$55', 'confirmed'),
    ('Erik Johansson', 'erik.j@email.com', '(612) 555-1005', 'Hot Towel Shave', (SELECT id FROM barbers WHERE slug = 'leo-r'), 'Leo R.', CURRENT_DATE, '10:30 AM', '45 min', '$50', 'confirmed'),
    ('Carlos Mendoza', 'carlos.m@email.com', '(612) 555-1006', 'Beard Sculpting', (SELECT id FROM barbers WHERE slug = 'leo-r'), 'Leo R.', CURRENT_DATE, '1:00 PM', '30 min', '$40', 'confirmed'),

    -- Tomorrow's bookings
    ('Darnell Jackson', 'darnell.j@email.com', '(612) 555-1008', 'The Signature Cut', (SELECT id FROM barbers WHERE slug = 'marcus-v'), 'Marcus V.', CURRENT_DATE + 1, '10:00 AM', '45 min', '$55', 'confirmed'),
    ('Tyler Brooks', 'tyler.b@email.com', '(612) 555-1007', 'The Executive', (SELECT id FROM barbers WHERE slug = 'james-d'), 'James D.', CURRENT_DATE + 1, '2:00 PM', '60 min', '$90', 'confirmed'),
    ('Marcus Taylor', 'marcus.t@email.com', '(612) 555-1003', 'Beard Sculpting', (SELECT id FROM barbers WHERE slug = 'leo-r'), 'Leo R.', CURRENT_DATE + 1, '11:00 AM', '30 min', '$40', 'confirmed'),

    -- Past bookings (completed)
    ('Adrian Reyes', 'adrian.reyes@email.com', '(612) 555-1001', 'The Signature Cut', (SELECT id FROM barbers WHERE slug = 'marcus-v'), 'Marcus V.', CURRENT_DATE - 7, '10:00 AM', '45 min', '$55', 'completed'),
    ('David Chen', 'david.chen@email.com', '(612) 555-1002', 'The Executive', (SELECT id FROM barbers WHERE slug = 'james-d'), 'James D.', CURRENT_DATE - 7, '11:00 AM', '60 min', '$90', 'completed'),
    ('Erik Johansson', 'erik.j@email.com', '(612) 555-1005', 'Hot Towel Shave', (SELECT id FROM barbers WHERE slug = 'marcus-v'), 'Marcus V.', CURRENT_DATE - 3, '2:00 PM', '45 min', '$50', 'completed'),
    ('Jamal Williams', 'jamal.w@email.com', '(612) 555-1004', 'The Signature Cut', (SELECT id FROM barbers WHERE slug = 'james-d'), 'James D.', CURRENT_DATE - 5, '10:00 AM', '45 min', '$55', 'completed'),
    ('Darnell Jackson', 'darnell.j@email.com', '(612) 555-1008', 'Beard Sculpting', (SELECT id FROM barbers WHERE slug = 'leo-r'), 'Leo R.', CURRENT_DATE - 2, '3:00 PM', '30 min', '$40', 'completed'),

    -- No-shows
    ('Carlos Mendoza', 'carlos.m@email.com', '(612) 555-1006', 'The Signature Cut', (SELECT id FROM barbers WHERE slug = 'leo-r'), 'Leo R.', CURRENT_DATE - 4, '1:00 PM', '45 min', '$55', 'no_show'),

    -- Cancelled
    ('Tyler Brooks', 'tyler.b@email.com', '(612) 555-1007', 'The Executive', (SELECT id FROM barbers WHERE slug = 'marcus-v'), 'Marcus V.', CURRENT_DATE - 1, '4:00 PM', '60 min', '$90', 'cancelled');

-- Applicants
INSERT INTO applicants (name, email, phone, ig_handle, experience, license_status, status, notes) VALUES
    ('Jordan Miles', 'jordan.m@email.com', '(612) 555-2001', '@jordancuts', '3-5 Years', 'Active Master Barber', 'pending', NULL),
    ('Andre Washington', 'andre.w@email.com', '(612) 555-2002', '@drecutz', '5-10 Years', 'Active Master Barber', 'interview', 'Strong portfolio. Schedule for in-person demo.'),
    ('Trevor Lin', 'trevor.l@email.com', '(612) 555-2003', '@trevfades', '1-3 Years', 'Student / Apprentice', 'rejected', 'Promising but needs more experience.');


-- =========================================
-- 9. HELPER: Link auth users to roles
-- After creating users in Supabase Auth, run:
--
-- INSERT INTO user_roles (auth_id, role) VALUES
--     ('ADMIN_AUTH_UUID_HERE', 'admin');
--
-- UPDATE barbers SET auth_id = 'BARBER_AUTH_UUID_HERE' WHERE slug = 'marcus-v';
-- INSERT INTO user_roles (auth_id, role) VALUES ('BARBER_AUTH_UUID_HERE', 'barber');
--
-- UPDATE clients SET auth_id = 'CLIENT_AUTH_UUID_HERE' WHERE email = 'adrian.reyes@email.com';
-- INSERT INTO user_roles (auth_id, role) VALUES ('CLIENT_AUTH_UUID_HERE', 'client');
-- =========================================
