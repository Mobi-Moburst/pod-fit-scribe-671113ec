-- Add airtable_embed_url column to speakers table
ALTER TABLE public.speakers 
ADD COLUMN airtable_embed_url TEXT DEFAULT NULL;