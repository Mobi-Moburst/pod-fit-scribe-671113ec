-- Create batch_sessions table to track batch uploads
CREATE TABLE public.batch_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  client_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  total_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.batch_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for batch_sessions
CREATE POLICY "batch_sessions_select_org" ON public.batch_sessions
  FOR SELECT USING (org_id = get_team_org_id());

CREATE POLICY "batch_sessions_insert_org" ON public.batch_sessions
  FOR INSERT WITH CHECK (org_id = get_team_org_id());

CREATE POLICY "batch_sessions_delete_org" ON public.batch_sessions
  FOR DELETE USING (org_id = get_team_org_id());

-- Trigger to auto-set org_id
CREATE TRIGGER set_batch_sessions_org_id
  BEFORE INSERT ON public.batch_sessions
  FOR EACH ROW
  EXECUTE FUNCTION set_org_id_to_team();

-- Add batch_session_id to evaluations table
ALTER TABLE public.evaluations
ADD COLUMN batch_session_id UUID REFERENCES public.batch_sessions(id) ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX idx_evaluations_batch_session ON public.evaluations(batch_session_id);