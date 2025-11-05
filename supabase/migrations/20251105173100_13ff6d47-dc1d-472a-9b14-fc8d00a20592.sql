-- Add missing columns to batch_sessions table
ALTER TABLE batch_sessions
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS total_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS success_count INTEGER DEFAULT 0;