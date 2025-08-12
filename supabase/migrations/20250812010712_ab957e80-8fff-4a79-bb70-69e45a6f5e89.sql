-- Ensure org_id is set from header for shared visibility
DO $$ BEGIN
  CREATE TRIGGER set_org_id_on_clients
  BEFORE INSERT OR UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_org_id_from_header();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_org_id_on_evaluations
  BEFORE INSERT OR UPDATE ON public.evaluations
  FOR EACH ROW EXECUTE FUNCTION public.set_org_id_from_header();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill any existing rows missing org_id to the team org
UPDATE public.clients SET org_id = '11111111-1111-1111-1111-111111111111' WHERE org_id IS NULL;
UPDATE public.evaluations SET org_id = '11111111-1111-1111-1111-111111111111' WHERE org_id IS NULL;