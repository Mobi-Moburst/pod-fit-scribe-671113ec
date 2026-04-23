ALTER TABLE public.aeo_audit_runs
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS aeo_audit_runs_status_idx
  ON public.aeo_audit_runs (status, created_at DESC);

-- Allow reading status by anyone in the org (read-only polling)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='aeo_audit_runs'
      AND policyname='aeo_audit_runs_read_by_org'
  ) THEN
    CREATE POLICY aeo_audit_runs_read_by_org
      ON public.aeo_audit_runs
      FOR SELECT
      TO authenticated
      USING (org_id = public.get_team_org_id());
  END IF;
END $$;

ALTER TABLE public.aeo_audit_runs ENABLE ROW LEVEL SECURITY;