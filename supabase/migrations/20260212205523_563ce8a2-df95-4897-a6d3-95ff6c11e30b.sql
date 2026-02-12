
-- Create podcast_metadata_cache table for caching Podchaser API results
CREATE TABLE public.podcast_metadata_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  apple_podcast_url text NOT NULL,
  podcast_name text,
  listeners_per_episode integer,
  monthly_listens integer,
  social_reach integer,
  categories text,
  description text,
  fetched_at timestamp with time zone NOT NULL DEFAULT now(),
  org_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique constraint on apple_podcast_url + org_id to allow per-org caching
CREATE UNIQUE INDEX idx_podcast_metadata_cache_url_org ON public.podcast_metadata_cache (apple_podcast_url, org_id);

-- Enable RLS
ALTER TABLE public.podcast_metadata_cache ENABLE ROW LEVEL SECURITY;

-- RLS policies matching existing org-based pattern
CREATE POLICY "Enable read access for org"
  ON public.podcast_metadata_cache FOR SELECT
  USING (org_id = get_team_org_id());

CREATE POLICY "Enable insert access for org"
  ON public.podcast_metadata_cache FOR INSERT
  WITH CHECK (org_id = get_team_org_id());

CREATE POLICY "Enable update access for org"
  ON public.podcast_metadata_cache FOR UPDATE
  USING (org_id = get_team_org_id());

CREATE POLICY "Enable delete access for org"
  ON public.podcast_metadata_cache FOR DELETE
  USING (org_id = get_team_org_id());
