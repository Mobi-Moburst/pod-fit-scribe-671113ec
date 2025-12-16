-- Fix RLS policies: Drop all existing policies (with or without trailing space) and recreate as PERMISSIVE

-- ============================================
-- REPORTS TABLE
-- ============================================
DROP POLICY IF EXISTS "Enable delete access for org" ON public.reports;
DROP POLICY IF EXISTS "Enable insert access for org" ON public.reports;
DROP POLICY IF EXISTS "Enable read access for org" ON public.reports;
DROP POLICY IF EXISTS "Enable update access for org" ON public.reports;

CREATE POLICY "Enable read access for org"
ON public.reports FOR SELECT
USING (org_id = get_team_org_id());

CREATE POLICY "Enable insert access for org"
ON public.reports FOR INSERT
WITH CHECK (org_id = get_team_org_id());

CREATE POLICY "Enable update access for org"
ON public.reports FOR UPDATE
USING (org_id = get_team_org_id());

CREATE POLICY "Enable delete access for org"
ON public.reports FOR DELETE
USING (org_id = get_team_org_id());

-- ============================================
-- CLIENTS TABLE
-- ============================================
DROP POLICY IF EXISTS "Enable delete access for org" ON public.clients;
DROP POLICY IF EXISTS "Enable insert access for org" ON public.clients;
DROP POLICY IF EXISTS "Enable read access for org" ON public.clients;
DROP POLICY IF EXISTS "Enable update access for org" ON public.clients;

CREATE POLICY "Enable read access for org"
ON public.clients FOR SELECT
USING (org_id = get_team_org_id());

CREATE POLICY "Enable insert access for org"
ON public.clients FOR INSERT
WITH CHECK (org_id = get_team_org_id());

CREATE POLICY "Enable update access for org"
ON public.clients FOR UPDATE
USING (org_id = get_team_org_id());

CREATE POLICY "Enable delete access for org"
ON public.clients FOR DELETE
USING (org_id = get_team_org_id());

-- ============================================
-- EVALUATIONS TABLE
-- ============================================
DROP POLICY IF EXISTS "Enable delete access for org" ON public.evaluations;
DROP POLICY IF EXISTS "Enable insert access for org" ON public.evaluations;
DROP POLICY IF EXISTS "Enable read access for org" ON public.evaluations;
DROP POLICY IF EXISTS "Enable update access for org" ON public.evaluations;

CREATE POLICY "Enable read access for org"
ON public.evaluations FOR SELECT
USING (org_id = get_team_org_id());

CREATE POLICY "Enable insert access for org"
ON public.evaluations FOR INSERT
WITH CHECK (org_id = get_team_org_id());

CREATE POLICY "Enable update access for org"
ON public.evaluations FOR UPDATE
USING (org_id = get_team_org_id());

CREATE POLICY "Enable delete access for org"
ON public.evaluations FOR DELETE
USING (org_id = get_team_org_id());

-- ============================================
-- BATCH_SESSIONS TABLE
-- ============================================
DROP POLICY IF EXISTS "Enable delete access for org" ON public.batch_sessions;
DROP POLICY IF EXISTS "Enable insert access for org" ON public.batch_sessions;
DROP POLICY IF EXISTS "Enable read access for org" ON public.batch_sessions;
DROP POLICY IF EXISTS "Enable update access for org" ON public.batch_sessions;

CREATE POLICY "Enable read access for org"
ON public.batch_sessions FOR SELECT
USING (org_id = get_team_org_id());

CREATE POLICY "Enable insert access for org"
ON public.batch_sessions FOR INSERT
WITH CHECK (org_id = get_team_org_id());

CREATE POLICY "Enable update access for org"
ON public.batch_sessions FOR UPDATE
USING (org_id = get_team_org_id());

CREATE POLICY "Enable delete access for org"
ON public.batch_sessions FOR DELETE
USING (org_id = get_team_org_id());