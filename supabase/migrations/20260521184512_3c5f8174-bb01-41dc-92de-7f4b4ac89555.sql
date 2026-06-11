-- Create fireflies_connections table for per-CM API keys
CREATE TABLE public.fireflies_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  org_id uuid NOT NULL,
  api_key text NOT NULL,
  fireflies_user_id text,
  fireflies_email text,
  fireflies_name text,
  last_synced_at timestamptz,
  last_sync_status text,
  last_sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fireflies_connections ENABLE ROW LEVEL SECURITY;

-- CMs manage their own row
CREATE POLICY "Users can view own fireflies connection"
  ON public.fireflies_connections FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own fireflies connection"
  ON public.fireflies_connections FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND org_id = get_team_org_id());

CREATE POLICY "Users can update own fireflies connection"
  ON public.fireflies_connections FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own fireflies connection"
  ON public.fireflies_connections FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can view all connections for the admin dashboard
CREATE POLICY "Admins can view all fireflies connections"
  ON public.fireflies_connections FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_fireflies_connections_updated_at
  BEFORE UPDATE ON public.fireflies_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add fireflies_transcript_id to call_notes for dedupe
ALTER TABLE public.call_notes
  ADD COLUMN fireflies_transcript_id text;

CREATE UNIQUE INDEX call_notes_fireflies_transcript_id_unique
  ON public.call_notes (fireflies_transcript_id)
  WHERE fireflies_transcript_id IS NOT NULL;