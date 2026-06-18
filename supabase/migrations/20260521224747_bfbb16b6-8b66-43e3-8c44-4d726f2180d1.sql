ALTER TABLE public.ltv_snapshots ADD COLUMN IF NOT EXISTS speaker_id uuid;
CREATE INDEX IF NOT EXISTS idx_ltv_snapshots_speaker_id ON public.ltv_snapshots(speaker_id);