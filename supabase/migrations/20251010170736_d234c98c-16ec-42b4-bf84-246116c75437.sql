-- Add new columns to clients table for enhanced eligibility tracking
ALTER TABLE clients 
  ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('male', 'female', 'non_binary', 'unspecified')),
  ADD COLUMN IF NOT EXISTS guest_identity_tags text[],
  ADD COLUMN IF NOT EXISTS professional_credentials text[];