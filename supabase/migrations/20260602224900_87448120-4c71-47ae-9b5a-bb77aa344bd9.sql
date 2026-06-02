CREATE TABLE public.ltv_offboarding (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  airtable_record_id TEXT NOT NULL,
  client_name TEXT NOT NULL,
  campaign_manager TEXT,
  date_ended DATE,
  company_id UUID,
  speaker_id UUID,
  raw_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (org_id, airtable_record_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ltv_offboarding TO authenticated;
GRANT ALL ON public.ltv_offboarding TO service_role;

ALTER TABLE public.ltv_offboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for org"
  ON public.ltv_offboarding FOR SELECT TO authenticated
  USING (org_id = get_team_org_id());

CREATE POLICY "Enable insert access for org"
  ON public.ltv_offboarding FOR INSERT TO authenticated
  WITH CHECK (org_id = get_team_org_id());

CREATE POLICY "Enable update access for org"
  ON public.ltv_offboarding FOR UPDATE TO authenticated
  USING (org_id = get_team_org_id())
  WITH CHECK (org_id = get_team_org_id());

CREATE POLICY "Enable delete access for org"
  ON public.ltv_offboarding FOR DELETE TO authenticated
  USING (org_id = get_team_org_id());

CREATE TRIGGER update_ltv_offboarding_updated_at
  BEFORE UPDATE ON public.ltv_offboarding
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_ltv_offboarding_date_ended ON public.ltv_offboarding (date_ended);
CREATE INDEX idx_ltv_offboarding_org ON public.ltv_offboarding (org_id);