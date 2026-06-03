CREATE TABLE public.hubspot_tickets_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  hubspot_ticket_id text NOT NULL,
  pipeline_id text,
  stage_id text,
  subject text,
  kc_client text,
  kc_shortlist_id text,
  hubspot_owner_id text,
  owner_name text,
  owner_email text,
  priority text,
  show_url text,
  createdate timestamp with time zone,
  last_modified timestamp with time zone,
  close_date timestamp with time zone,
  raw_properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (org_id, hubspot_ticket_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hubspot_tickets_cache TO authenticated;
GRANT ALL ON public.hubspot_tickets_cache TO service_role;

ALTER TABLE public.hubspot_tickets_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for org" ON public.hubspot_tickets_cache
  FOR SELECT TO authenticated USING (org_id = get_team_org_id());
CREATE POLICY "Enable insert access for org" ON public.hubspot_tickets_cache
  FOR INSERT TO authenticated WITH CHECK (org_id = get_team_org_id());
CREATE POLICY "Enable update access for org" ON public.hubspot_tickets_cache
  FOR UPDATE TO authenticated USING (org_id = get_team_org_id()) WITH CHECK (org_id = get_team_org_id());
CREATE POLICY "Enable delete access for org" ON public.hubspot_tickets_cache
  FOR DELETE TO authenticated USING (org_id = get_team_org_id());

CREATE INDEX idx_hubspot_tickets_cache_org_client ON public.hubspot_tickets_cache (org_id, kc_client);
CREATE INDEX idx_hubspot_tickets_cache_org_pipeline ON public.hubspot_tickets_cache (org_id, pipeline_id);
CREATE INDEX idx_hubspot_tickets_cache_org_shortlist ON public.hubspot_tickets_cache (org_id, kc_shortlist_id);
CREATE INDEX idx_hubspot_tickets_cache_org_lastmod ON public.hubspot_tickets_cache (org_id, last_modified DESC);

CREATE TRIGGER update_hubspot_tickets_cache_updated_at
  BEFORE UPDATE ON public.hubspot_tickets_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();