-- Add brand_colors column to companies table for co-branded reports
ALTER TABLE public.companies 
ADD COLUMN brand_colors JSONB DEFAULT NULL;