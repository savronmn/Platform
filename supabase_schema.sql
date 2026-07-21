-- ============================================================
-- SAVRON — Database schema (mirrors production Supabase)
-- WARNING: This is a reference file. Tables already exist.
-- Only run individual ALTER statements if columns are missing.
-- ============================================================

-- FIX: Add missing phone column to email_subscribers
-- Run this in Supabase SQL Editor if you get "Failed to save subscriber":
--
--   ALTER TABLE email_subscribers ADD COLUMN IF NOT EXISTS phone TEXT;
--

-- Reference schema below (DO NOT re-run table creation if tables exist)

-- email_subscribers
-- id UUID PK, name TEXT, email TEXT UNIQUE, phone TEXT,
-- pass_serial_number TEXT UNIQUE, google_pass_object_id TEXT,
-- visit_count INT DEFAULT 0, issued_at TIMESTAMPTZ, last_visit_at TIMESTAMPTZ,
-- active BOOLEAN DEFAULT TRUE

-- barbers
-- id UUID PK, auth_id UUID, name TEXT, slug TEXT UNIQUE, role TEXT,
-- bio TEXT, specialties TEXT[], image_url TEXT, phone TEXT, email TEXT,
-- instagram_url TEXT, google_calendar_id TEXT, google_calendar_tokens JSONB,
-- google_sync_token TEXT, google_channel_id TEXT, google_resource_id TEXT,
-- working_hours JSONB, active BOOLEAN, created_at TIMESTAMPTZ

-- clients
-- id UUID PK, auth_id UUID, name TEXT, email TEXT UNIQUE, phone TEXT,
-- notes TEXT, preferences TEXT, membership_status TEXT, visit_count INT,
-- created_at TIMESTAMPTZ, last_booking_date DATE

-- bookings
-- id UUID PK, client_id UUID FK, client_name TEXT, client_email TEXT,
-- client_phone TEXT, service TEXT, barber_id UUID FK, barber_name TEXT,
-- date DATE, time TEXT, duration TEXT, price TEXT, status TEXT,
-- notes TEXT, google_event_id TEXT, created_at TIMESTAMPTZ

-- services
-- id UUID PK, name TEXT, duration_minutes INT, price_cents INT,
-- color_code TEXT, active BOOLEAN, created_at TIMESTAMPTZ

-- user_roles
-- id UUID PK, auth_id UUID UNIQUE, role TEXT, created_at TIMESTAMPTZ

-- applicants
-- id UUID PK, name TEXT, email TEXT, phone TEXT, ig_handle TEXT,
-- experience TEXT, license_status TEXT, video_url TEXT, status TEXT,
-- notes TEXT, created_at TIMESTAMPTZ

-- barber_service (junction table — per-barber price/duration)
-- barber_id UUID FK, service_id UUID FK, price_cents INT, duration_minutes INT
-- PK(barber_id, service_id)
