-- Migration: Add experience_summary to applicants table
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS experience_summary TEXT;
