CREATE TABLE public.company_kpi_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  company_id UUID NOT NULL,
  "window" TEXT NOT NULL,
  kpis JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '1 hour'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT company_kpi_cache_unique UNIQUE (company_id, "window")
);

CREATE INDEX idx_company_kpi_cache_company ON public.company_kpi_cache(company_id);
CREATE INDEX idx_company_kpi_cache_expires ON public.company_kpi_cache(expires_at);

ALTER TABLE public.company_kpi_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for org"
ON public.company_kpi_cache FOR SELECT TO authenticated
USING (org_id = get_team_org_id());

CREATE POLICY "Enable insert access for org"
ON public.company_kpi_cache FOR INSERT TO authenticated
WITH CHECK (org_id = get_team_org_id());

CREATE POLICY "Enable update access for org"
ON public.company_kpi_cache FOR UPDATE TO authenticated
USING (org_id = get_team_org_id())
WITH CHECK (org_id = get_team_org_id());

CREATE POLICY "Enable delete access for org"
ON public.company_kpi_cache FOR DELETE TO authenticated
USING (org_id = get_team_org_id());

CREATE TRIGGER update_company_kpi_cache_updated_at
BEFORE UPDATE ON public.company_kpi_cache
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();