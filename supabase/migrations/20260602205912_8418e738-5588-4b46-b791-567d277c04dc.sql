CREATE TABLE public.momentum_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  airtable_record_id text NOT NULL UNIQUE,
  year_table text NOT NULL,
  campaign_manager text,
  client_name text,
  podcast_name text,
  podcast_url text,
  host_name text,
  activity_type text,
  date_secured date,
  start_date_time timestamptz,
  company_id uuid,
  industry text,
  raw_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_momentum_bookings_date_secured ON public.momentum_bookings(date_secured DESC);
CREATE INDEX idx_momentum_bookings_cm ON public.momentum_bookings(campaign_manager);
CREATE INDEX idx_momentum_bookings_industry ON public.momentum_bookings(industry);
CREATE INDEX idx_momentum_bookings_company ON public.momentum_bookings(company_id);
CREATE INDEX idx_momentum_bookings_activity ON public.momentum_bookings(activity_type);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.momentum_bookings TO authenticated;
GRANT ALL ON public.momentum_bookings TO service_role;

ALTER TABLE public.momentum_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for org" ON public.momentum_bookings
  FOR SELECT TO authenticated USING (org_id = get_team_org_id());
CREATE POLICY "Enable insert access for org" ON public.momentum_bookings
  FOR INSERT TO authenticated WITH CHECK (org_id = get_team_org_id());
CREATE POLICY "Enable update access for org" ON public.momentum_bookings
  FOR UPDATE TO authenticated USING (org_id = get_team_org_id()) WITH CHECK (org_id = get_team_org_id());
CREATE POLICY "Enable delete access for org" ON public.momentum_bookings
  FOR DELETE TO authenticated USING (org_id = get_team_org_id());

CREATE TRIGGER update_momentum_bookings_updated_at
  BEFORE UPDATE ON public.momentum_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();