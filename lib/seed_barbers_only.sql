-- =====================================================
-- SAVRON — BARBERS ONLY SEED
-- Safe to run on existing DB — uses ON CONFLICT to
-- skip duplicates. Does NOT wipe any other data.
-- =====================================================

INSERT INTO barbers (name, slug, role, bio, specialties, image_url, phone, email, instagram_url, active)
VALUES
    ('Albi A.',   'albi-a',   'Master Barber & Owner',
     'The founder of Sabrón. Albeiro has 15+ years behind the chair and built this shop from the ground up. Known for his legendary skin fades and his ability to read exactly what a client wants.',
     ARRAY['Skin Fades', 'Beard Design', 'Hair Art'],
     'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=2000&auto=format&fit=crop',
     '(612) 555-0100', 'albi@savronmpls.com', 'https://instagram.com/albi.savron', TRUE),

    ('Marcus V.', 'marcus-v', 'Master Barber',
     'A decade of precision cuts and signature fades. Marcus trained under three master barbers in Chicago before bringing his craft to Minneapolis.',
     ARRAY['Signature Fades', 'Hot Towel Shaves', 'Beard Design'],
     'https://images.unsplash.com/photo-1534308143481-c55f00be8bd7?q=80&w=2000&auto=format&fit=crop',
     '(612) 555-0101', 'marcus@savronmpls.com', 'https://instagram.com/marcusv.cuts', TRUE),

    ('James D.',  'james-d',  'Senior Stylist',
     'Fashion-forward cuts with architectural precision. James brings a modern edge to classic barbering with 7 years of experience across Minneapolis and New York.',
     ARRAY['Modern Cuts', 'Textured Styles', 'Color Work'],
     'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=2000&auto=format&fit=crop',
     '(612) 555-0102', 'james@savronmpls.com', 'https://instagram.com/jamesd.style', TRUE),

    ('Leo R.',    'leo-r',    'Barber',
     'Clean lines and sharp details. Leo specializes in classic cuts with a contemporary twist. 4 years behind the chair and a favorite for kids and family cuts.',
     ARRAY['Classic Cuts', 'Line-ups', 'Kids Cuts'],
     'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=2000&auto=format&fit=crop',
     '(612) 555-0103', 'leo@savronmpls.com', 'https://instagram.com/leor.barber', TRUE)

ON CONFLICT (slug) DO UPDATE SET
    name         = EXCLUDED.name,
    role         = EXCLUDED.role,
    bio          = EXCLUDED.bio,
    specialties  = EXCLUDED.specialties,
    image_url    = EXCLUDED.image_url,
    phone        = EXCLUDED.phone,
    email        = EXCLUDED.email,
    instagram_url = EXCLUDED.instagram_url,
    active       = EXCLUDED.active;
