-- Add Campaign Manager to clients
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS campaign_manager text;

-- Index for quick filtering by Campaign Manager
CREATE INDEX IF NOT EXISTS clients_campaign_manager_idx
  ON public.clients (campaign_manager);

-- Backfill existing rows to 'Troy' when unset
UPDATE public.clients
SET campaign_manager = 'Troy'
WHERE campaign_manager IS NULL;