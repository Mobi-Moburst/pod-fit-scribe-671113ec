-- Create clients table
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  company_url TEXT,
  media_kit_url TEXT,
  target_audiences TEXT[] DEFAULT '{}',
  talking_points TEXT[] DEFAULT '{}',
  avoid TEXT[] DEFAULT '{}',
  notes TEXT DEFAULT '',
  campaign_strategy TEXT DEFAULT '',
  campaign_manager TEXT,
  logo_url TEXT,
  tags TEXT[] DEFAULT '{}',
  product_type TEXT DEFAULT '',
  professional_credentials TEXT[] DEFAULT '{}',
  pitch_template TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create evaluations table
CREATE TABLE IF NOT EXISTS public.evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  batch_session_id UUID,
  org_id UUID NOT NULL,
  url TEXT NOT NULL,
  show_title TEXT,
  show_description TEXT,
  episode_title TEXT,
  episode_description TEXT,
  overall_score INTEGER,
  confidence INTEGER,
  rubric_json JSONB,
  citations JSONB,
  is_eligible BOOLEAN DEFAULT true,
  ineligibility_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create batch_sessions table
CREATE TABLE IF NOT EXISTS public.batch_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  org_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_sessions ENABLE ROW LEVEL SECURITY;

-- Create function to get team org ID
CREATE OR REPLACE FUNCTION public.get_team_org_id()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT '11111111-1111-1111-1111-111111111111'::UUID;
$$;

-- Create RLS policies for clients table
CREATE POLICY "Enable read access for org" ON public.clients
  FOR SELECT USING (org_id = get_team_org_id());

CREATE POLICY "Enable insert access for org" ON public.clients
  FOR INSERT WITH CHECK (org_id = get_team_org_id());

CREATE POLICY "Enable update access for org" ON public.clients
  FOR UPDATE USING (org_id = get_team_org_id());

CREATE POLICY "Enable delete access for org" ON public.clients
  FOR DELETE USING (org_id = get_team_org_id());

-- Create RLS policies for evaluations table
CREATE POLICY "Enable read access for org" ON public.evaluations
  FOR SELECT USING (org_id = get_team_org_id());

CREATE POLICY "Enable insert access for org" ON public.evaluations
  FOR INSERT WITH CHECK (org_id = get_team_org_id());

CREATE POLICY "Enable update access for org" ON public.evaluations
  FOR UPDATE USING (org_id = get_team_org_id());

CREATE POLICY "Enable delete access for org" ON public.evaluations
  FOR DELETE USING (org_id = get_team_org_id());

-- Create RLS policies for batch_sessions table
CREATE POLICY "Enable read access for org" ON public.batch_sessions
  FOR SELECT USING (org_id = get_team_org_id());

CREATE POLICY "Enable insert access for org" ON public.batch_sessions
  FOR INSERT WITH CHECK (org_id = get_team_org_id());

CREATE POLICY "Enable update access for org" ON public.batch_sessions
  FOR UPDATE USING (org_id = get_team_org_id());

CREATE POLICY "Enable delete access for org" ON public.batch_sessions
  FOR DELETE USING (org_id = get_team_org_id());

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_clients_org_id ON public.clients(org_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_org_id ON public.evaluations(org_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_client_id ON public.evaluations(client_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_batch_session_id ON public.evaluations(batch_session_id);
CREATE INDEX IF NOT EXISTS idx_batch_sessions_org_id ON public.batch_sessions(org_id);
CREATE INDEX IF NOT EXISTS idx_batch_sessions_client_id ON public.batch_sessions(client_id);