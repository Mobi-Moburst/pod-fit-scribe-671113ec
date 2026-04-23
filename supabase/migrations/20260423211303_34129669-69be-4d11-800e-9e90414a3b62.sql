CREATE TABLE IF NOT EXISTS public.aeo_audit_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  engine text NOT NULL DEFAULT 'claude',
  topic text,
  stage text,
  response_text text,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  client_present boolean NOT NULL DEFAULT false,
  competitors_present text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS aeo_audit_cache_company_idx ON public.aeo_audit_cache (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS aeo_audit_cache_lookup_idx ON public.aeo_audit_cache (company_id, prompt, engine, created_at DESC);

ALTER TABLE public.aeo_audit_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for org" ON public.aeo_audit_cache
  FOR SELECT USING (org_id = get_team_org_id());
CREATE POLICY "Enable insert access for org" ON public.aeo_audit_cache
  FOR INSERT WITH CHECK (org_id = get_team_org_id());
CREATE POLICY "Enable update access for org" ON public.aeo_audit_cache
  FOR UPDATE USING (org_id = get_team_org_id());
CREATE POLICY "Enable delete access for org" ON public.aeo_audit_cache
  FOR DELETE USING (org_id = get_team_org_id());