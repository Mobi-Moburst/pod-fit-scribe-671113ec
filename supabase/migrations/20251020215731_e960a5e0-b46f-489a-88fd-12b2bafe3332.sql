-- Add UPDATE policy for batch_sessions table
CREATE POLICY "batch_sessions_update_org"
ON batch_sessions
FOR UPDATE
TO public
USING (org_id = get_team_org_id())
WITH CHECK (org_id = get_team_org_id());