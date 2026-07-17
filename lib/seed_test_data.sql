-- =====================================================
-- SAVRON — FULL TEST SEED
-- Run this in Supabase SQL Editor to populate
-- everything needed to test the platform.
--
-- HOW TO USE:
--   1. Run schema.sql first (base tables)
--   2. Run migration_v2.sql (services, barber_service, new cols)
--   3. Run migration_v3.sql (google_event_id, tokens col)
--   4. Run THIS file (rich sample data)
-- =====================================================

-- =====================================================
-- WIPE existing sample data (keep schema intact)
-- =====================================================
DELETE FROM bookings;
DELETE FROM applicants;
DELETE FROM clients;
DELETE FROM barber_service;
DELETE FROM services;
DELETE FROM barbers;

-- =====================================================
-- 1. BARBERS  (4 barbers incl. owner Albi)
-- =====================================================
INSERT INTO barbers (name, slug, role, bio, specialties, image_url, phone, email, instagram_url, active) VALUES

    ('Albi A.', 'albi-a', 'Master Barber & Owner',
     'The founder of Sabrón. Albeiro has 15+ years behind the chair and built this shop from the ground up. Known for his legendary skin fades and his ability to read exactly what a client wants.',
     ARRAY['Skin Fades', 'Beard Design', 'Hair Art'],
     'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=2000&auto=format&fit=crop',
     '(612) 555-0100', 'albi@savronmpls.com',
     'https://instagram.com/albi.savron', TRUE),

    ('Marcus V.', 'marcus-v', 'Master Barber',
     'A decade of precision cuts and signature fades. Marcus trained under three master barbers in Chicago before bringing his craft to Minneapolis.',
     ARRAY['Signature Fades', 'Hot Towel Shaves', 'Beard Design'],
     'https://images.unsplash.com/photo-1534308143481-c55f00be8bd7?q=80&w=2000&auto=format&fit=crop',
     '(612) 555-0101', 'marcus@savronmpls.com',
     'https://instagram.com/marcusv.cuts', TRUE),

    ('James D.', 'james-d', 'Senior Stylist',
     'Fashion-forward cuts with architectural precision. James brings a modern edge to classic barbering with 7 years of experience across Minneapolis and New York.',
     ARRAY['Modern Cuts', 'Textured Styles', 'Color Work'],
     'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=2000&auto=format&fit=crop',
     '(612) 555-0102', 'james@savronmpls.com',
     'https://instagram.com/jamesd.style', TRUE),

    ('Leo R.', 'leo-r', 'Barber',
     'Clean lines and sharp details. Leo specializes in classic cuts with a contemporary twist. 4 years behind the chair and a favorite for kids and family cuts.',
     ARRAY['Classic Cuts', 'Line-ups', 'Kids Cuts'],
     'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=2000&auto=format&fit=crop',
     '(612) 555-0103', 'leo@savronmpls.com',
     'https://instagram.com/leor.barber', TRUE);

-- =====================================================
-- 2. SERVICES
-- =====================================================
INSERT INTO services (name, duration_minutes, price_cents, color_code, active) VALUES
    ('The Signature Cut', 45, 5500, '#10b981', TRUE),
    ('The Executive',     60, 9000, '#3b82f6', TRUE),
    ('Haircut + Beard + Hot Towel Shave', 60, 8000, '#f59e0b', TRUE),
    ('Kids Cut',          30, 3500, '#14b8a6', TRUE);

-- =====================================================
-- 3. BARBER → SERVICE MAPPINGS
-- =====================================================

-- Albi: everything
INSERT INTO barber_service (barber_id, service_id)
SELECT b.id, s.id FROM barbers b, services s
WHERE b.slug = 'albi-a';

-- Marcus: Signature Cut, Executive, Hot Towel Shave, Beard Sculpting
INSERT INTO barber_service (barber_id, service_id)
SELECT b.id, s.id FROM barbers b, services s
WHERE b.slug = 'marcus-v'
  AND s.name IN ('The Signature Cut', 'The Executive', 'Haircut + Beard + Hot Towel Shave');

-- James: Signature Cut, Executive, Beard Sculpting
INSERT INTO barber_service (barber_id, service_id)
SELECT b.id, s.id FROM barbers b, services s
WHERE b.slug = 'james-d'
  AND s.name IN ('The Signature Cut', 'The Executive', 'Haircut + Beard + Hot Towel Shave');

-- Leo: Signature Cut, Beard Sculpting, Kids Cut, Hot Towel Shave
INSERT INTO barber_service (barber_id, service_id)
SELECT b.id, s.id FROM barbers b, services s
WHERE b.slug = 'leo-r'
  AND s.name IN ('The Signature Cut', 'Haircut + Beard + Hot Towel Shave', 'Kids Cut');

-- =====================================================
-- 4. CLIENTS  (10 regulars)
-- =====================================================
INSERT INTO clients (name, email, phone, membership_status, visit_count, notes, preferences) VALUES
    ('Adrian Reyes',    'adrian.reyes@email.com',  '(612) 555-1001', 'vip',          24, 'Prefers Marcus. Always books the first slot.',  'Low fade, beard trim. No product on top.'),
    ('David Chen',      'david.chen@email.com',    '(612) 555-1002', 'inner_circle', 15, 'Consistent regular. Tips well.',               'Textured crop, clean neckline.'),
    ('Marcus Taylor',   'marcus.t@email.com',      '(612) 555-1003', 'standard',      3, 'New client, referred by Adrian.',              'Still deciding on a regular style.'),
    ('Jamal Williams',  'jamal.w@email.com',       '(612) 555-1004', 'inner_circle', 18, 'Works downtown, books lunch slots.',           'Temp fade, always wants lineup.'),
    ('Erik Johansson',  'erik.j@email.com',        '(612) 555-1005', 'vip',          30, 'Founding member. Brings friends.',             'Executive cut, hot towel shave.'),
    ('Carlos Mendoza',  'carlos.m@email.com',      '(612) 555-1006', 'standard',      5, 'College student, comes once a month.',         'Buzz cut, quick and clean.'),
    ('Tyler Brooks',    'tyler.b@email.com',       '(612) 555-1007', 'standard',      1, 'Walk-in that converted.',                      'Exploring styles.'),
    ('Darnell Jackson', 'darnell.j@email.com',     '(612) 555-1008', 'inner_circle', 12, 'Brings his son too.',                          'Skin fade, beard shape-up.'),
    ('Marco Diaz',      'marco.d@email.com',       '(612) 555-1009', 'vip',          40, 'Longest standing client. Never misses.',       'Old school taper, hard part.'),
    ('Kevin Park',      'kevin.p@email.com',       '(612) 555-1010', 'standard',      2, 'Referred by Marco.',                           'Drop fade, natural top.');

-- =====================================================
-- 5. BOOKINGS — TODAY  (full schedule for host dashboard)
-- =====================================================
INSERT INTO bookings (client_name, client_email, client_phone, service, barber_id, barber_name, date, time, duration, price, status) VALUES

    -- 10:00 AM block
    ('Adrian Reyes',    'adrian.reyes@email.com',  '(612) 555-1001', 'The Signature Cut', (SELECT id FROM barbers WHERE slug='albi-a'),   'Albi A.',   CURRENT_DATE, '10:00 AM', '45 min', '$55', 'confirmed'),
    ('David Chen',      'david.chen@email.com',    '(612) 555-1002', 'The Executive',     (SELECT id FROM barbers WHERE slug='marcus-v'), 'Marcus V.', CURRENT_DATE, '10:00 AM', '60 min', '$90', 'confirmed'),
    ('Erik Johansson',  'erik.j@email.com',        '(612) 555-1005', 'Haircut + Beard + Hot Towel Shave',   (SELECT id FROM barbers WHERE slug='james-d'),  'James D.',  CURRENT_DATE, '10:00 AM', '45 min', '$50', 'confirmed'),
    ('Carlos Mendoza',  'carlos.m@email.com',      '(612) 555-1006', 'Kids Cut',          (SELECT id FROM barbers WHERE slug='leo-r'),    'Leo R.',    CURRENT_DATE, '10:00 AM', '30 min', '$35', 'confirmed'),

    -- 10:45 AM block
    ('Jamal Williams',  'jamal.w@email.com',       '(612) 555-1004', 'Haircut + Beard + Hot Towel Shave',   (SELECT id FROM barbers WHERE slug='albi-a'),   'Albi A.',   CURRENT_DATE, '10:45 AM', '60 min', '$80', 'confirmed'),
    ('Marco Diaz',      'marco.d@email.com',       '(612) 555-1009', 'The Signature Cut', (SELECT id FROM barbers WHERE slug='marcus-v'), 'Marcus V.', CURRENT_DATE, '10:45 AM', '45 min', '$55', 'confirmed'),
    ('Kevin Park',      'kevin.p@email.com',       '(612) 555-1010', 'The Signature Cut', (SELECT id FROM barbers WHERE slug='leo-r'),    'Leo R.',    CURRENT_DATE, '10:45 AM', '45 min', '$55', 'confirmed'),

    -- 11:30 AM block
    ('Tyler Brooks',    'tyler.b@email.com',       '(612) 555-1007', 'The Executive',     (SELECT id FROM barbers WHERE slug='albi-a'),   'Albi A.',   CURRENT_DATE, '11:30 AM', '60 min', '$90', 'confirmed'),
    ('Darnell Jackson', 'darnell.j@email.com',     '(612) 555-1008', 'The Signature Cut', (SELECT id FROM barbers WHERE slug='james-d'),  'James D.',  CURRENT_DATE, '11:30 AM', '45 min', '$55', 'confirmed'),

    -- 1:00 PM block
    ('Adrian Reyes',    'adrian.reyes@email.com',  '(612) 555-1001', 'Haircut + Beard + Hot Towel Shave',   (SELECT id FROM barbers WHERE slug='marcus-v'), 'Marcus V.', CURRENT_DATE, '1:00 PM',  '45 min', '$50', 'confirmed'),
    ('Marcus Taylor',   'marcus.t@email.com',      '(612) 555-1003', 'Kids Cut',          (SELECT id FROM barbers WHERE slug='leo-r'),    'Leo R.',    CURRENT_DATE, '1:00 PM',  '30 min', '$35', 'confirmed'),
    ('Erik Johansson',  'erik.j@email.com',        '(612) 555-1005', 'The Executive',     (SELECT id FROM barbers WHERE slug='albi-a'),   'Albi A.',   CURRENT_DATE, '1:00 PM',  '60 min', '$90', 'confirmed'),

    -- 1:45 PM block
    ('Kevin Park',      'kevin.p@email.com',       '(612) 555-1010', 'Haircut + Beard + Hot Towel Shave',   (SELECT id FROM barbers WHERE slug='james-d'),  'James D.',  CURRENT_DATE, '1:45 PM',  '60 min', '$80', 'confirmed'),

    -- 2:30 PM block
    ('Jamal Williams',  'jamal.w@email.com',       '(612) 555-1004', 'The Signature Cut', (SELECT id FROM barbers WHERE slug='marcus-v'), 'Marcus V.', CURRENT_DATE, '2:30 PM',  '45 min', '$55', 'confirmed'),
    ('David Chen',      'david.chen@email.com',    '(612) 555-1002', 'Haircut + Beard + Hot Towel Shave',   (SELECT id FROM barbers WHERE slug='albi-a'),   'Albi A.',   CURRENT_DATE, '2:30 PM',  '60 min', '$80', 'confirmed'),

    -- 3:15 PM block
    ('Marco Diaz',      'marco.d@email.com',       '(612) 555-1009', 'Haircut + Beard + Hot Towel Shave',   (SELECT id FROM barbers WHERE slug='leo-r'),    'Leo R.',    CURRENT_DATE, '3:15 PM',  '45 min', '$50', 'confirmed'),

    -- 4:00 PM block
    ('Carlos Mendoza',  'carlos.m@email.com',      '(612) 555-1006', 'The Signature Cut', (SELECT id FROM barbers WHERE slug='marcus-v'), 'Marcus V.', CURRENT_DATE, '4:00 PM',  '45 min', '$55', 'confirmed'),
    ('Tyler Brooks',    'tyler.b@email.com',       '(612) 555-1007', 'The Signature Cut', (SELECT id FROM barbers WHERE slug='james-d'),  'James D.',  CURRENT_DATE, '4:00 PM',  '45 min', '$55', 'confirmed');

-- =====================================================
-- 6. BOOKINGS — TOMORROW
-- =====================================================
INSERT INTO bookings (client_name, client_email, client_phone, service, barber_id, barber_name, date, time, duration, price, status) VALUES
    ('Darnell Jackson', 'darnell.j@email.com',     '(612) 555-1008', 'The Signature Cut', (SELECT id FROM barbers WHERE slug='marcus-v'), 'Marcus V.', CURRENT_DATE+1, '10:00 AM', '45 min', '$55', 'confirmed'),
    ('Adrian Reyes',    'adrian.reyes@email.com',  '(612) 555-1001', 'The Executive',     (SELECT id FROM barbers WHERE slug='albi-a'),   'Albi A.',   CURRENT_DATE+1, '10:00 AM', '60 min', '$90', 'confirmed'),
    ('Marco Diaz',      'marco.d@email.com',       '(612) 555-1009', 'Haircut + Beard + Hot Towel Shave',   (SELECT id FROM barbers WHERE slug='james-d'),  'James D.',  CURRENT_DATE+1, '10:45 AM', '45 min', '$50', 'confirmed'),
    ('Kevin Park',      'kevin.p@email.com',       '(612) 555-1010', 'Kids Cut',          (SELECT id FROM barbers WHERE slug='leo-r'),    'Leo R.',    CURRENT_DATE+1, '11:30 AM', '30 min', '$35', 'confirmed'),
    ('Tyler Brooks',    'tyler.b@email.com',       '(612) 555-1007', 'Haircut + Beard + Hot Towel Shave',   (SELECT id FROM barbers WHERE slug='albi-a'),   'Albi A.',   CURRENT_DATE+1, '1:00 PM',  '60 min', '$80', 'confirmed'),
    ('Erik Johansson',  'erik.j@email.com',        '(612) 555-1005', 'The Signature Cut', (SELECT id FROM barbers WHERE slug='marcus-v'), 'Marcus V.', CURRENT_DATE+1, '2:30 PM',  '45 min', '$55', 'confirmed');

-- =====================================================
-- 7. BOOKINGS — PAST (mix of completed / no-show)
-- =====================================================
INSERT INTO bookings (client_name, client_email, client_phone, service, barber_id, barber_name, date, time, duration, price, status) VALUES
    ('Adrian Reyes',   'adrian.reyes@email.com', '(612) 555-1001', 'The Signature Cut', (SELECT id FROM barbers WHERE slug='marcus-v'), 'Marcus V.', CURRENT_DATE-7,  '10:00 AM', '45 min', '$55', 'completed'),
    ('David Chen',     'david.chen@email.com',   '(612) 555-1002', 'The Executive',     (SELECT id FROM barbers WHERE slug='james-d'),  'James D.',  CURRENT_DATE-7,  '11:00 AM', '60 min', '$90', 'completed'),
    ('Erik Johansson', 'erik.j@email.com',       '(612) 555-1005', 'Haircut + Beard + Hot Towel Shave',   (SELECT id FROM barbers WHERE slug='marcus-v'), 'Marcus V.', CURRENT_DATE-3,  '2:00 PM',  '45 min', '$50', 'completed'),
    ('Jamal Williams', 'jamal.w@email.com',      '(612) 555-1004', 'The Signature Cut', (SELECT id FROM barbers WHERE slug='james-d'),  'James D.',  CURRENT_DATE-5,  '10:00 AM', '45 min', '$55', 'completed'),
    ('Darnell Jackson','darnell.j@email.com',    '(612) 555-1008', 'Haircut + Beard + Hot Towel Shave',   (SELECT id FROM barbers WHERE slug='leo-r'),    'Leo R.',    CURRENT_DATE-2,  '3:00 PM',  '60 min', '$80', 'completed'),
    ('Marco Diaz',     'marco.d@email.com',      '(612) 555-1009', 'The Executive',     (SELECT id FROM barbers WHERE slug='albi-a'),   'Albi A.',   CURRENT_DATE-1,  '10:00 AM', '60 min', '$90', 'completed'),
    ('Carlos Mendoza', 'carlos.m@email.com',     '(612) 555-1006', 'The Signature Cut', (SELECT id FROM barbers WHERE slug='leo-r'),    'Leo R.',    CURRENT_DATE-4,  '1:00 PM',  '45 min', '$55', 'no_show'),
    ('Tyler Brooks',   'tyler.b@email.com',      '(612) 555-1007', 'The Executive',     (SELECT id FROM barbers WHERE slug='marcus-v'), 'Marcus V.', CURRENT_DATE-1,  '4:00 PM',  '60 min', '$90', 'cancelled');

-- =====================================================
-- 8. APPLICANTS
-- =====================================================
INSERT INTO applicants (name, email, phone, ig_handle, experience, license_status, status, notes) VALUES
    ('Jordan Miles',     'jordan.m@email.com',  '(612) 555-2001', '@jordancuts',  '3-5 Years',  'Active Master Barber',    'pending',   NULL),
    ('Andre Washington', 'andre.w@email.com',   '(612) 555-2002', '@drecutz',     '5-10 Years', 'Active Master Barber',    'interview', 'Strong portfolio. Schedule for in-person demo.'),
    ('Trevor Lin',       'trevor.l@email.com',  '(612) 555-2003', '@trevfades',   '1-3 Years',  'Student / Apprentice',    'rejected',  'Promising but needs more experience.'),
    ('Deja Price',       'deja.p@email.com',    '(612) 555-2004', '@dejacutz',    '5-10 Years', 'Active Master Barber',    'pending',   NULL),
    ('Ricky Vega',       'ricky.v@email.com',   '(612) 555-2005', '@rickyvega',   '3-5 Years',  'Active Barber License',   'interview', 'Lives in St. Paul. Open to full-time.');

-- =====================================================
-- 9. DONE — run the following to create auth users:
--
--   In Supabase Dashboard → Authentication → Users → Add User
--   Then link them:
--
--   Admin (Albeiro):
--     INSERT INTO user_roles (auth_id, role) VALUES ('<UUID>', 'admin');
--
--   Marcus (barber):
--     UPDATE barbers SET auth_id = '<UUID>' WHERE slug = 'marcus-v';
--     INSERT INTO user_roles (auth_id, role) VALUES ('<UUID>', 'barber');
--
--   (Repeat for james-d, leo-r, albi-a)
-- =====================================================
