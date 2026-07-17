-- Test Data Seed for CRM Features
-- Run this in your Supabase SQL Editor to test the new dashboard

-- We assume barbers 'marcus-v', 'james-d', and 'leo-r' already exist from initial schema.
-- If not, those bookings will just have NULL barber_ids, which is fine for testing.

-- 1. Insert Test Clients with varying last_booking_date
INSERT INTO clients (name, email, phone, membership_status, visit_count, last_booking_date, notes)
VALUES
    -- Very Old (8+ weeks)
    ('Test User 8W', 'test8w@example.com', '(555) 100-8888', 'standard', 2, CURRENT_DATE - 65, 'Test client for 8 week filter'),
    ('VIP User 9W', 'vip9w@example.com', '(555) 100-9999', 'vip', 15, CURRENT_DATE - 70, 'VIP test client, over 8 weeks'),
    
    -- Old (6+ weeks)
    ('Test User 6W', 'test6w@example.com', '(555) 100-6666', 'standard', 4, CURRENT_DATE - 45, 'Test client for 6 week filter'),
    ('IC User 7W', 'ic7w@example.com', '(555) 100-7777', 'inner_circle', 8, CURRENT_DATE - 50, 'Inner circle test, over 6 weeks'),

    -- Recent (4+ weeks)
    ('Test User 4W', 'test4w@example.com', '(555) 100-4444', 'standard', 1, CURRENT_DATE - 30, 'Test client for 4 week filter'),
    
    -- Very Recent (< 4 weeks)
    ('Test User 1W', 'test1w@example.com', '(555) 100-1111', 'standard', 5, CURRENT_DATE - 7, 'Recent test client, should not show in overdue filters')
ON CONFLICT (email) DO UPDATE 
SET last_booking_date = EXCLUDED.last_booking_date,
    membership_status = EXCLUDED.membership_status;


-- 2. Insert Test Bookings for calendar testing
-- We'll link these to the clients we just created
INSERT INTO bookings (client_name, client_email, service, barber_id, barber_name, date, time, price, status)
VALUES
    -- A booking for today
    ('Test User 1W', 'test1w@example.com', 'The Signature Cut', (SELECT id FROM barbers WHERE slug = 'marcus-v' LIMIT 1), 'Marcus V.', CURRENT_DATE, '1:00 PM', '$55', 'confirmed'),
    
    -- Another booking for today
    ('Test User 4W', 'test4w@example.com', 'The Executive', (SELECT id FROM barbers WHERE slug = 'james-d' LIMIT 1), 'James D.', CURRENT_DATE, '2:30 PM', '$90', 'confirmed'),
    
    -- A past booking (completed)
    ('Test User 6W', 'test6w@example.com', 'Haircut + Beard + Hot Towel Shave', (SELECT id FROM barbers WHERE slug = 'leo-r' LIMIT 1), 'Leo R.', CURRENT_DATE - 45, '11:00 AM', '$80', 'completed'),

    -- A future booking
    ('VIP User 9W', 'vip9w@example.com', 'Haircut + Beard + Hot Towel Shave', (SELECT id FROM barbers WHERE slug = 'marcus-v' LIMIT 1), 'Marcus V.', CURRENT_DATE + 2, '10:00 AM', '$80', 'confirmed');
