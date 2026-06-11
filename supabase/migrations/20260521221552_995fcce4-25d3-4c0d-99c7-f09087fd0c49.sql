CREATE TABLE public.ltv_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  airtable_record_id text NOT NULL UNIQUE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,

  -- Identity
  client_name text NOT NULL,
  campaign_manager text,
  cohort text,
  primary_industry text,

  -- Status
  status text,
  campaign_success_status text,
  fulfilled boolean,
  payment_paused boolean,
  offboarding boolean,

  -- Renewal
  renewal_date date,
  renewed boolean,

  -- Pacing (overall campaign)
  total_bookings_per_month numeric,
  actual_bookings_to_date numeric,
  total_planned_bookings_by_eom numeric,
  cumulative_pct_fulfilled numeric,

  -- This month
  deliverables_completed_this_month numeric,
  goal_this_month numeric,
  current_month_cumulative_pct_fulfilled numeric,
  adjusted_goal numeric,
  trend_vs_last_month text,

  -- Touch / cadence
  last_client_checkin date,
  next_checkin_scheduled date,
  eow_recap_sent boolean,

  -- Flexibility
  raw_fields jsonb NOT NULL DEFAULT '{}'::jsonb,

  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ltv_snapshots_org ON public.ltv_snapshots(org_id);
CREATE INDEX idx_ltv_snapshots_company ON public.ltv_snapshots(company_id);
CREATE INDEX idx_ltv_snapshots_campaign_manager ON public.ltv_snapshots(campaign_manager);
CREATE INDEX idx_ltv_snapshots_status ON public.ltv_snapshots(status);
CREATE INDEX idx_ltv_snapshots_renewal_date ON public.ltv_snapshots(renewal_date);

ALTER TABLE public.ltv_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for org"
  ON public.ltv_snapshots FOR SELECT
  TO authenticated
  USING (org_id = get_team_org_id());

CREATE POLICY "Enable insert access for org"
  ON public.ltv_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (org_id = get_team_org_id());

CREATE POLICY "Enable update access for org"
  ON public.ltv_snapshots FOR UPDATE
  TO authenticated
  USING (org_id = get_team_org_id())
  WITH CHECK (org_id = get_team_org_id());

CREATE POLICY "Enable delete access for org"
  ON public.ltv_snapshots FOR DELETE
  TO authenticated
  USING (org_id = get_team_org_id());

CREATE TRIGGER update_ltv_snapshots_updated_at
  BEFORE UPDATE ON public.ltv_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();