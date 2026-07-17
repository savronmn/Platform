-- Rename beard service and backfill references in live data.
UPDATE public.barbers
SET services_offered = (
  SELECT array_agg(
    CASE
      WHEN elem = 'Beard Sculpting + Hot Towel Shave'
        THEN 'Haircut + Beard + Hot Towel Shave'
      ELSE elem
    END
  )
  FROM unnest(services_offered) AS elem
)
WHERE services_offered @> ARRAY['Beard Sculpting + Hot Towel Shave'];

UPDATE public.bookings
SET service = REPLACE(
  service,
  'Beard Sculpting + Hot Towel Shave',
  'Haircut + Beard + Hot Towel Shave'
)
WHERE service LIKE '%Beard Sculpting + Hot Towel Shave%';

UPDATE public.services
SET
  booking_page_slug = 'haircut-beard-hot-towel-shave'
WHERE name = 'Haircut + Beard + Hot Towel Shave'
  AND (booking_page_slug IS NULL OR booking_page_slug = 'beard-sculpting-hot-towel-shave');
