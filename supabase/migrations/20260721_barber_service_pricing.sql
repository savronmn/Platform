-- Per-barber service pricing and duration
-- Extends barber_service junction table with barber-specific price/duration.

ALTER TABLE public.barber_service
  ADD COLUMN IF NOT EXISTS price_cents integer,
  ADD COLUMN IF NOT EXISTS duration_minutes integer,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Backfill existing rows from the global services catalog
UPDATE public.barber_service bs
SET
  price_cents = COALESCE(bs.price_cents, s.price_cents),
  duration_minutes = COALESCE(bs.duration_minutes, s.duration_minutes),
  updated_at = now()
FROM public.services s
WHERE s.id = bs.service_id;

-- Seed barber_service rows from services_offered text arrays (when missing)
INSERT INTO public.barber_service (barber_id, service_id, price_cents, duration_minutes)
SELECT b.id, s.id, s.price_cents, s.duration_minutes
FROM public.barbers b
CROSS JOIN public.services s
WHERE b.services_offered IS NOT NULL
  AND s.name = ANY(b.services_offered)
  AND s.active = true
ON CONFLICT (barber_id, service_id) DO UPDATE
SET
  price_cents = COALESCE(public.barber_service.price_cents, EXCLUDED.price_cents),
  duration_minutes = COALESCE(public.barber_service.duration_minutes, EXCLUDED.duration_minutes),
  updated_at = now();

-- Barbers with no services_offered filter offer all active services by default
INSERT INTO public.barber_service (barber_id, service_id, price_cents, duration_minutes)
SELECT b.id, s.id, s.price_cents, s.duration_minutes
FROM public.barbers b
CROSS JOIN public.services s
WHERE (b.services_offered IS NULL OR array_length(b.services_offered, 1) IS NULL)
  AND s.active = true
  AND b.active = true
ON CONFLICT (barber_id, service_id) DO NOTHING;

-- RLS: barbers can read their own service pricing
DROP POLICY IF EXISTS "Barbers read own barber_service" ON public.barber_service;
CREATE POLICY "Barbers read own barber_service" ON public.barber_service
  FOR SELECT TO authenticated
  USING (barber_id IN (SELECT id FROM public.barbers WHERE auth_id = auth.uid()));
