-- Add missing columns to clients table
ALTER TABLE public.clients 
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS guest_identity_tags TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS title TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.clients.gender IS 'Guest gender: male, female, non_binary, or unspecified';
COMMENT ON COLUMN public.clients.guest_identity_tags IS 'Identity tags for shows with specific requirements (e.g., woman_entrepreneur, veteran)';
COMMENT ON COLUMN public.clients.title IS 'Professional title (e.g., CEO & Founder, CTO)';