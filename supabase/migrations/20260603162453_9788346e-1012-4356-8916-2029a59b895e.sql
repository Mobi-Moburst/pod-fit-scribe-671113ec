CREATE TABLE public.hubspot_settings (
  org_id uuid PRIMARY KEY,
  portal_id text,
  pipeline_id text,
  pipeline_label text,
  stages jsonb NOT NULL DEFAULT '[]'::jsonb,
  kc_client_property text NOT NULL DEFAULT 'kc_client',
  show_url_property text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hubspot_settings TO authenticated;
GRANT ALL ON public.hubspot_settings TO service_role;

ALTER TABLE public.hubspot_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for org"
  ON public.hubspot_settings FOR SELECT TO authenticated
  USING (org_id = get_team_org_id());

CREATE POLICY "Enable insert access for org"
  ON public.hubspot_settings FOR INSERT TO authenticated
  WITH CHECK (org_id = get_team_org_id());

CREATE POLICY "Enable update access for org"
  ON public.hubspot_settings FOR UPDATE TO authenticated
  USING (org_id = get_team_org_id())
  WITH CHECK (org_id = get_team_org_id());

CREATE POLICY "Enable delete access for org"
  ON public.hubspot_settings FOR DELETE TO authenticated
  USING (org_id = get_team_org_id());

CREATE TRIGGER update_hubspot_settings_updated_at
  BEFORE UPDATE ON public.hubspot_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();