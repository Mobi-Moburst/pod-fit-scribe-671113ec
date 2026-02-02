-- Create function to update timestamps (if not exists)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create airtable_connections table for storing API credentials per company/speaker
CREATE TABLE public.airtable_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  name TEXT NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  speaker_id UUID REFERENCES public.speakers(id) ON DELETE CASCADE,
  base_id TEXT NOT NULL,
  table_id TEXT NOT NULL,
  personal_access_token TEXT NOT NULL,
  field_mapping JSONB NOT NULL DEFAULT '{
    "podcast_name": "Podcast Name",
    "action": "Action",
    "scheduled_date_time": "Recording Date",
    "date_booked": "Date Booked",
    "date_published": "Date Published",
    "link_to_episode": "Episode Link",
    "show_notes": "Show Notes",
    "apple_podcast_link": "Apple Podcast Link"
  }'::jsonb,
  speaker_column_name TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.airtable_connections ENABLE ROW LEVEL SECURITY;

-- Create RLS policies matching existing org-based access pattern
CREATE POLICY "Enable read access for org" 
ON public.airtable_connections 
FOR SELECT 
USING (org_id = get_team_org_id());

CREATE POLICY "Enable insert access for org" 
ON public.airtable_connections 
FOR INSERT 
WITH CHECK (org_id = get_team_org_id());

CREATE POLICY "Enable update access for org" 
ON public.airtable_connections 
FOR UPDATE 
USING (org_id = get_team_org_id());

CREATE POLICY "Enable delete access for org" 
ON public.airtable_connections 
FOR DELETE 
USING (org_id = get_team_org_id());

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_airtable_connections_updated_at
BEFORE UPDATE ON public.airtable_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups by company/speaker
CREATE INDEX idx_airtable_connections_company_id ON public.airtable_connections(company_id);
CREATE INDEX idx_airtable_connections_speaker_id ON public.airtable_connections(speaker_id);