-- Monthly EOM snapshots of LTV + offboarding state for historic views
CREATE TABLE public.ltv_monthly_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL,
  year_month text NOT NULL,            -- 'YYYY-MM' (UTC)
  source text NOT NULL,                -- 'ltv' | 'offboarding'
  airtable_record_id text NOT NULL,

  client_name text NOT NULL,
  campaign_manager text,

  -- LTV fields
  status text,
  campaign_success_status text,
  cohort text,
  offboarding boolean,
  zz_complete boolean,
  renewal_date date,
  renewed boolean,
  goal_this_month numeric,
  deliverables_completed_this_month numeric,
  actual_bookings_to_date numeric,
  total_bookings_per_month numeric,
  total_planned_bookings_by_eom numeric,
  current_month_cumulative_pct_fulfilled numeric,

  -- Offboarding-specific
  date_ended date,

  raw_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshotted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ltv_monthly_snapshots_unique
    UNIQUE (org_id, source, airtable_record_id, year_month)
);

CREATE INDEX idx_ltv_monthly_snapshots_org_month
  ON public.ltv_monthly_snapshots (org_id, year_month);
CREATE INDEX idx_ltv_monthly_snapshots_source
  ON public.ltv_monthly_snapshots (org_id, source, year_month);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ltv_monthly_snapshots TO authenticated;
GRANT ALL ON public.ltv_monthly_snapshots TO service_role;

ALTER TABLE public.ltv_monthly_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for org"
  ON public.ltv_monthly_snapshots FOR SELECT TO authenticated
  USING (org_id = get_team_org_id());

CREATE POLICY "Enable insert access for org"
  ON public.ltv_monthly_snapshots FOR INSERT TO authenticated
  WITH CHECK (org_id = get_team_org_id());

CREATE POLICY "Enable update access for org"
  ON public.ltv_monthly_snapshots FOR UPDATE TO authenticated
  USING (org_id = get_team_org_id())
  WITH CHECK (org_id = get_team_org_id());

CREATE POLICY "Enable delete access for org"
  ON public.ltv_monthly_snapshots FOR DELETE TO authenticated
  USING (org_id = get_team_org_id());

CREATE TRIGGER update_ltv_monthly_snapshots_updated_at
  BEFORE UPDATE ON public.ltv_monthly_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure pg_cron / pg_net are available for scheduled snapshotting
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;