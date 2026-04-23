ALTER TABLE public.aeo_audit_runs
  ADD COLUMN IF NOT EXISTS prompts_queue JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS results_collected JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS processed_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engines_used TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS body_snapshot JSONB;