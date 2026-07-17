-- =============================================
-- SAVRON — Safe Barbers Fix (run in Supabase SQL Editor)
-- Does NOT drop any tables or data.
-- =============================================

-- 1. Ensure 'active' column exists on barbers
ALTER TABLE barbers ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;

-- 2. Make sure all existing barbers are marked active
UPDATE barbers SET active = TRUE WHERE active IS NULL;

-- 3. If barbers table is empty, insert the sample barbers
INSERT INTO barbers (name, slug, role, bio, specialties, image_url, phone, email, active)
SELECT * FROM (VALUES
    ('Marcus V.', 'marcus-v', 'Master Barber',
     'A decade of precision cuts and signature fades. Marcus trained under three master barbers in Chicago before founding his craft in Minneapolis.',
     ARRAY['Signature Fades', 'Hot Towel Shaves', 'Beard Design'],
     'https://images.unsplash.com/photo-1534308143481-c55f00be8bd7?q=80&w=2000&auto=format&fit=crop',
     '(612) 555-0101', 'marcus@savronmpls.com', TRUE),

    ('James D.', 'james-d', 'Senior Stylist',
     'Fashion-forward cuts with architectural precision. James brings a modern edge to classic barbering with 7 years of experience.',
     ARRAY['Modern Cuts', 'Textured Styles', 'Color Work'],
     'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=2000&auto=format&fit=crop',
     '(612) 555-0102', 'james@savronmpls.com', TRUE),

    ('Leo R.', 'leo-r', 'Barber',
     'Clean lines and sharp details. Leo specializes in classic cuts with a contemporary twist. 4 years behind the chair.',
     ARRAY['Classic Cuts', 'Line-ups', 'Kids Cuts'],
     'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=2000&auto=format&fit=crop',
     '(612) 555-0103', 'leo@savronmpls.com', TRUE)
) AS v(name, slug, role, bio, specialties, image_url, phone, email, active)
WHERE NOT EXISTS (SELECT 1 FROM barbers LIMIT 1);

-- 4. Verify — you should see 3 barbers returned
SELECT id, name, slug, role, active FROM barbers ORDER BY name;
