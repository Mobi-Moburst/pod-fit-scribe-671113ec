ALTER TABLE public.call_notes
  ADD COLUMN IF NOT EXISTS excluded_at timestamptz,
  ADD COLUMN IF NOT EXISTS excluded_reason text;

CREATE INDEX IF NOT EXISTS idx_call_notes_excluded_at ON public.call_notes(excluded_at);