-- Fix linter: set stable search_path for functions
ALTER FUNCTION public.touch_updated_at() SET search_path = public;
ALTER FUNCTION public.set_org_id_from_header() SET search_path = public;