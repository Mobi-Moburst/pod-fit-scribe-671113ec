-- Add columns for public report publishing
ALTER TABLE public.reports 
ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS public_slug text UNIQUE,
ADD COLUMN IF NOT EXISTS published_at timestamp with time zone;

-- Create index on public_slug for faster lookups
CREATE INDEX IF NOT EXISTS idx_reports_public_slug ON public.reports(public_slug) WHERE public_slug IS NOT NULL;

-- Add RLS policy for public read access to published reports
CREATE POLICY "Public can read published reports" 
ON public.reports 
FOR SELECT 
TO anon
USING (is_published = true AND public_slug IS NOT NULL);