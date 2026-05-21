ALTER TABLE public.ltv_snapshots ADD COLUMN zz_complete boolean;
CREATE INDEX idx_ltv_snapshots_zz_complete ON public.ltv_snapshots(zz_complete);