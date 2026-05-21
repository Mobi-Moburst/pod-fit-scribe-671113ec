-- Remove Fathom data and change default source to Fireflies
DELETE FROM public.call_notes WHERE source = 'fathom';
ALTER TABLE public.call_notes ALTER COLUMN source SET DEFAULT 'fireflies';