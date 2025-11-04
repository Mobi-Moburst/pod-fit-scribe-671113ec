-- Fix function search path security warning
CREATE OR REPLACE FUNCTION public.get_team_org_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT '11111111-1111-1111-1111-111111111111'::UUID;
$$;