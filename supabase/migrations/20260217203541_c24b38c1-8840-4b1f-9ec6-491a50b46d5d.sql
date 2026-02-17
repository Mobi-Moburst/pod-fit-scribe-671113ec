
-- Create call_notes table for storing Fathom (and future Fireflies) meeting notes
CREATE TABLE public.call_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  speaker_id UUID REFERENCES public.speakers(id) ON DELETE SET NULL,
  fathom_meeting_id TEXT UNIQUE,
  meeting_title TEXT,
  meeting_date TIMESTAMPTZ,
  duration_seconds INTEGER,
  summary TEXT,
  action_items JSONB DEFAULT '[]'::jsonb,
  transcript TEXT,
  participants JSONB DEFAULT '[]'::jsonb,
  source TEXT NOT NULL DEFAULT 'fathom',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.call_notes ENABLE ROW LEVEL SECURITY;

-- RLS policies matching org_id pattern
CREATE POLICY "Enable read access for org"
  ON public.call_notes FOR SELECT
  USING (org_id = get_team_org_id());

CREATE POLICY "Enable insert access for org"
  ON public.call_notes FOR INSERT
  WITH CHECK (org_id = get_team_org_id());

CREATE POLICY "Enable update access for org"
  ON public.call_notes FOR UPDATE
  USING (org_id = get_team_org_id());

CREATE POLICY "Enable delete access for org"
  ON public.call_notes FOR DELETE
  USING (org_id = get_team_org_id());

-- Index for faster lookups by speaker
CREATE INDEX idx_call_notes_speaker_id ON public.call_notes(speaker_id);
CREATE INDEX idx_call_notes_company_id ON public.call_notes(company_id);
CREATE INDEX idx_call_notes_meeting_date ON public.call_notes(meeting_date DESC);
