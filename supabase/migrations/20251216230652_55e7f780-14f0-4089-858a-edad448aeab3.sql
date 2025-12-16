-- Phase B: Migrate existing clients data to companies and speakers

-- Step 1: Migrate clients to companies (using client.company as company name, fallback to client.name if no company)
INSERT INTO public.companies (id, org_id, name, company_url, logo_url, campaign_manager, airtable_embed_url, product_type, tags, notes, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  org_id,
  COALESCE(NULLIF(company, ''), name) as name,
  company_url,
  logo_url,
  campaign_manager,
  airtable_embed_url,
  COALESCE(product_type, ''),
  COALESCE(tags, '{}'),
  COALESCE(notes, ''),
  created_at,
  updated_at
FROM public.clients;

-- Step 2: Create speakers linked to the newly created companies
-- We need to match clients to companies by company name (or client name if no company)
INSERT INTO public.speakers (id, company_id, org_id, name, title, media_kit_url, gender, target_audiences, talking_points, avoid, guest_identity_tags, professional_credentials, campaign_strategy, pitch_template, competitors, created_at, updated_at)
SELECT 
  c.id as id,  -- Use the original client id as speaker id for easier FK updates
  comp.id as company_id,
  c.org_id,
  c.name,
  c.title,
  COALESCE(c.media_kit_url, ''),
  c.gender,
  COALESCE(c.target_audiences, '{}'),
  COALESCE(c.talking_points, '{}'),
  COALESCE(c.avoid, '{}'),
  COALESCE(c.guest_identity_tags, '{}'),
  COALESCE(c.professional_credentials, '{}'),
  COALESCE(c.campaign_strategy, ''),
  c.pitch_template,
  COALESCE(c.competitors, '[]'::jsonb),
  c.created_at,
  c.updated_at
FROM public.clients c
JOIN public.companies comp ON comp.name = COALESCE(NULLIF(c.company, ''), c.name) AND comp.org_id = c.org_id;

-- Step 3: Update evaluations to set speaker_id (client_id = speaker_id since we used same ID)
UPDATE public.evaluations e
SET speaker_id = e.client_id
WHERE e.client_id IN (SELECT id FROM public.speakers);

-- Step 4: Update batch_sessions to set speaker_id
UPDATE public.batch_sessions bs
SET speaker_id = bs.client_id
WHERE bs.client_id IN (SELECT id FROM public.speakers);

-- Step 5: Update reports to set company_id and speaker_id
UPDATE public.reports r
SET 
  speaker_id = r.client_id,
  company_id = s.company_id
FROM public.speakers s
WHERE r.client_id = s.id;