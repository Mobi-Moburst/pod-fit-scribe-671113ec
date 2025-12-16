-- Phase A: Create companies and speakers tables with new columns

-- 1. Create companies table
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  name TEXT NOT NULL,
  company_url TEXT,
  logo_url TEXT,
  campaign_manager TEXT,
  airtable_embed_url TEXT,
  product_type TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for org" ON public.companies 
FOR SELECT USING (org_id = get_team_org_id());

CREATE POLICY "Enable insert access for org" ON public.companies 
FOR INSERT WITH CHECK (org_id = get_team_org_id());

CREATE POLICY "Enable update access for org" ON public.companies 
FOR UPDATE USING (org_id = get_team_org_id());

CREATE POLICY "Enable delete access for org" ON public.companies 
FOR DELETE USING (org_id = get_team_org_id());

-- 2. Create speakers table
CREATE TABLE public.speakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  name TEXT NOT NULL,
  title TEXT,
  media_kit_url TEXT DEFAULT '',
  gender TEXT,
  target_audiences TEXT[] DEFAULT '{}',
  talking_points TEXT[] DEFAULT '{}',
  avoid TEXT[] DEFAULT '{}',
  guest_identity_tags TEXT[] DEFAULT '{}',
  professional_credentials TEXT[] DEFAULT '{}',
  campaign_strategy TEXT DEFAULT '',
  pitch_template TEXT,
  competitors JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for speakers
ALTER TABLE public.speakers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for org" ON public.speakers 
FOR SELECT USING (org_id = get_team_org_id());

CREATE POLICY "Enable insert access for org" ON public.speakers 
FOR INSERT WITH CHECK (org_id = get_team_org_id());

CREATE POLICY "Enable update access for org" ON public.speakers 
FOR UPDATE USING (org_id = get_team_org_id());

CREATE POLICY "Enable delete access for org" ON public.speakers 
FOR DELETE USING (org_id = get_team_org_id());

-- 3. Add speaker_id to evaluations (nullable for migration)
ALTER TABLE public.evaluations ADD COLUMN speaker_id UUID REFERENCES public.speakers(id);

-- 4. Add speaker_id to batch_sessions (nullable for migration)
ALTER TABLE public.batch_sessions ADD COLUMN speaker_id UUID REFERENCES public.speakers(id);

-- 5. Add company_id and speaker_id to reports (speaker_id null = company-wide report)
ALTER TABLE public.reports ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.reports ADD COLUMN speaker_id UUID REFERENCES public.speakers(id);