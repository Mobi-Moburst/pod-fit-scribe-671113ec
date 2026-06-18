ALTER TABLE public.research_shortlists
  ADD COLUMN IF NOT EXISTS hubspot_ticket_id text,
  ADD COLUMN IF NOT EXISTS hubspot_contact_id text,
  ADD COLUMN IF NOT EXISTS hubspot_company_id text,
  ADD COLUMN IF NOT EXISTS hubspot_synced_at timestamptz;

ALTER TABLE public.hubspot_settings
  ADD COLUMN IF NOT EXISTS auto_create_associations boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS generic_domains text[] NOT NULL DEFAULT
    '{apple.com,podcasts.apple.com,spotify.com,youtube.com,substack.com}';