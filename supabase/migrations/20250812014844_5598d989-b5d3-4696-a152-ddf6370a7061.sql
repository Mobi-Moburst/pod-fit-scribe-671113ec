
-- 1) Single-team org id as a constant
CREATE OR REPLACE FUNCTION public.get_team_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT '11111111-1111-1111-1111-111111111111'::uuid;
$$;

-- 2) Trigger function: always set org_id to team constant
CREATE OR REPLACE FUNCTION public.set_org_id_to_team()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.org_id := public.get_team_org_id();
  RETURN NEW;
END;
$function$;

-- 3) Ensure triggers use the team-constant setter (replace header-based ones)
DO $$
BEGIN
  -- clients
  IF EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'set_org_id_on_clients' AND n.nspname = 'public' AND c.relname = 'clients'
  ) THEN
    DROP TRIGGER set_org_id_on_clients ON public.clients;
  END IF;

  CREATE TRIGGER set_org_id_on_clients
  BEFORE INSERT OR UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_org_id_to_team();

  -- evaluations
  IF EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'set_org_id_on_evaluations' AND n.nspname = 'public' AND c.relname = 'evaluations'
  ) THEN
    DROP TRIGGER set_org_id_on_evaluations ON public.evaluations;
  END IF;

  CREATE TRIGGER set_org_id_on_evaluations
  BEFORE INSERT OR UPDATE ON public.evaluations
  FOR EACH ROW EXECUTE FUNCTION public.set_org_id_to_team();
END $$;

-- 4) Replace RLS policies on clients to use the team constant
DROP POLICY IF EXISTS clients_select_org ON public.clients;
DROP POLICY IF EXISTS clients_insert_org ON public.clients;
DROP POLICY IF EXISTS clients_update_org ON public.clients;
DROP POLICY IF EXISTS clients_delete_org ON public.clients;

CREATE POLICY clients_select_org ON public.clients
FOR SELECT USING (org_id = public.get_team_org_id());

CREATE POLICY clients_insert_org ON public.clients
FOR INSERT WITH CHECK (org_id = public.get_team_org_id());

CREATE POLICY clients_update_org ON public.clients
FOR UPDATE USING (org_id = public.get_team_org_id())
WITH CHECK (org_id = public.get_team_org_id());

CREATE POLICY clients_delete_org ON public.clients
FOR DELETE USING (org_id = public.get_team_org_id());

-- 5) Replace RLS policies on evaluations to use the team constant
DROP POLICY IF EXISTS evals_select_org ON public.evaluations;
DROP POLICY IF EXISTS evals_insert_org ON public.evaluations;
DROP POLICY IF EXISTS evals_update_org ON public.evaluations;
DROP POLICY IF EXISTS evals_delete_org ON public.evaluations;

CREATE POLICY evals_select_org ON public.evaluations
FOR SELECT USING (org_id = public.get_team_org_id());

CREATE POLICY evals_insert_org ON public.evaluations
FOR INSERT WITH CHECK (org_id = public.get_team_org_id());

CREATE POLICY evals_update_org ON public.evaluations
FOR UPDATE USING (org_id = public.get_team_org_id())
WITH CHECK (org_id = public.get_team_org_id());

CREATE POLICY evals_delete_org ON public.evaluations
FOR DELETE USING (org_id = public.get_team_org_id());

-- 6) Backfill everything to the team org id to ensure visibility
UPDATE public.clients
SET org_id = public.get_team_org_id()
WHERE org_id IS DISTINCT FROM public.get_team_org_id();

UPDATE public.evaluations
SET org_id = public.get_team_org_id()
WHERE org_id IS DISTINCT FROM public.get_team_org_id();
