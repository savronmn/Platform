-- SAVRON canonical shop hours (Google Business listing)
-- Mon–Fri 10:00–19:00, Sat 09:00–16:30, Sun 09:00–14:00

UPDATE public.barbers
SET working_hours = '{
  "Mon": {"open": "10:00", "close": "19:00"},
  "Tue": {"open": "10:00", "close": "19:00"},
  "Wed": {"open": "10:00", "close": "19:00"},
  "Thu": {"open": "10:00", "close": "19:00"},
  "Fri": {"open": "10:00", "close": "19:00"},
  "Sat": {"open": "09:00", "close": "16:30"},
  "Sun": {"open": "09:00", "close": "14:00"}
}'::jsonb
WHERE active = true;
