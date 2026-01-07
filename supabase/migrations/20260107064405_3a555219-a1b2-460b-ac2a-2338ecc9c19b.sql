-- Update the read policy to also allow authenticated users to view published reports
-- Currently only anon can view public reports, but authenticated users from different orgs cannot

CREATE POLICY "Authenticated can read published reports"
ON public.reports
FOR SELECT
TO authenticated
USING ((is_published = true) AND (public_slug IS NOT NULL));