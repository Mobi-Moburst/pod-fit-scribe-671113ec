
-- 1. Fix get_team_org_id to return NULL for unauthenticated requests
CREATE OR REPLACE FUNCTION public.get_team_org_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN NULL
    ELSE '11111111-1111-1111-1111-111111111111'::uuid
  END;
$$;

-- 2. Recreate org-scoped policies on {authenticated} role only
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'airtable_connections','aeo_audit_cache','aeo_audit_runs','batch_sessions',
    'call_notes','clients','companies','evaluations','podcast_metadata_cache',
    'reports','speakers'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Enable read access for org" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Enable insert access for org" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Enable update access for org" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Enable delete access for org" ON public.%I', tbl);

    EXECUTE format($f$CREATE POLICY "Enable read access for org" ON public.%I FOR SELECT TO authenticated USING (org_id = public.get_team_org_id())$f$, tbl);
    EXECUTE format($f$CREATE POLICY "Enable insert access for org" ON public.%I FOR INSERT TO authenticated WITH CHECK (org_id = public.get_team_org_id())$f$, tbl);
    EXECUTE format($f$CREATE POLICY "Enable update access for org" ON public.%I FOR UPDATE TO authenticated USING (org_id = public.get_team_org_id()) WITH CHECK (org_id = public.get_team_org_id())$f$, tbl);
    EXECUTE format($f$CREATE POLICY "Enable delete access for org" ON public.%I FOR DELETE TO authenticated USING (org_id = public.get_team_org_id())$f$, tbl);
  END LOOP;
END $$;

-- 3. Remove admin visibility of other users' Fireflies API keys
DROP POLICY IF EXISTS "Admins can view all fireflies connections" ON public.fireflies_connections;

-- 4. Revoke EXECUTE from anon on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.get_team_org_id() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_team_org_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

-- 5. Storage: restrict listing & writes on public buckets to authenticated users
DROP POLICY IF EXISTS "Public can view headshots" ON storage.objects;
DROP POLICY IF EXISTS "Org members can upload headshots" ON storage.objects;
DROP POLICY IF EXISTS "Org members can update headshots" ON storage.objects;
DROP POLICY IF EXISTS "Org members can delete headshots" ON storage.objects;
DROP POLICY IF EXISTS "Public can view highlights" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload highlights" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update highlights" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete highlights" ON storage.objects;

CREATE POLICY "Authenticated can list headshots" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'speaker-headshots');
CREATE POLICY "Authenticated can upload headshots" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'speaker-headshots');
CREATE POLICY "Authenticated can update headshots" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'speaker-headshots');
CREATE POLICY "Authenticated can delete headshots" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'speaker-headshots');

CREATE POLICY "Authenticated can list highlights" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'report-highlights');
CREATE POLICY "Authenticated can upload highlights" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'report-highlights');
CREATE POLICY "Authenticated can update highlights" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'report-highlights');
CREATE POLICY "Authenticated can delete highlights" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'report-highlights');
