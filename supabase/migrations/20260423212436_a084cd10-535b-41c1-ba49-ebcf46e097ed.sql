CREATE TABLE public.aeo_audit_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  company_id UUID,
  model TEXT NOT NULL,
  prompts_run INTEGER NOT NULL DEFAULT 0,
  prompts_failed INTEGER NOT NULL DEFAULT 0,
  content_gap_analysis JSONB,
  geo_analysis JSONB,
  client_domain TEXT,
  competitor_names TEXT[] NOT NULL DEFAULT '{}',
  topics TEXT[] NOT NULL DEFAULT '{}',
  triggered_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_aeo_audit_runs_company_created ON public.aeo_audit_runs(company_id, created_at DESC);
CREATE INDEX idx_aeo_audit_runs_org ON public.aeo_audit_runs(org_id);

ALTER TABLE public.aeo_audit_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for org" ON public.aeo_audit_runs
  FOR SELECT USING (org_id = get_team_org_id());

CREATE POLICY "Enable insert access for org" ON public.aeo_audit_runs
  FOR INSERT WITH CHECK (org_id = get_team_org_id());

CREATE POLICY "Enable update access for org" ON public.aeo_audit_runs
  FOR UPDATE USING (org_id = get_team_org_id());

CREATE POLICY "Enable delete access for org" ON public.aeo_audit_runs
  FOR DELETE USING (org_id = get_team_org_id());