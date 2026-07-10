-- Migration: Add CRM columns
-- Run this in your Supabase SQL Editor

-- Add last_booking_date to clients for fast CRM filtering
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_booking_date DATE;

-- Backfill last_booking_date from existing bookings
UPDATE clients SET last_booking_date = (
    SELECT MAX(date) FROM bookings
    WHERE bookings.client_email = clients.email
    AND bookings.status IN ('confirmed', 'completed')
)
WHERE EXISTS (
    SELECT 1 FROM bookings WHERE bookings.client_email = clients.email
);
