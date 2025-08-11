-- Add new minimal-but-richer client profile columns if missing
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS company text,
  ADD COLUMN IF NOT EXISTS media_kit_url text,
  ADD COLUMN IF NOT EXISTS target_audiences text[],
  ADD COLUMN IF NOT EXISTS talking_points text[],
  ADD COLUMN IF NOT EXISTS avoid text[],
  ADD COLUMN IF NOT EXISTS notes text;

-- Migrate legacy fields into the new arrays when present
-- target_audiences <= target_roles[] + split(icp)
UPDATE public.clients c SET
  target_audiences = COALESCE(
    c.target_audiences,
    (
      SELECT ARRAY(SELECT DISTINCT btrim(x) FROM unnest(
        COALESCE(c.target_roles, '{}'::text[])
        || COALESCE(
             CASE WHEN c.icp IS NOT NULL AND length(btrim(c.icp)) > 0
                  THEN regexp_split_to_array(replace(c.icp, '•', ','), '\s*,\s*')
                  ELSE '{}'::text[] END,
             '{}'::text[]
           )
      ) AS t(x) WHERE btrim(x) <> '')
    )
  );

-- talking_points <= topics_to_prioritize[] + keywords_positive[]
UPDATE public.clients c SET
  talking_points = COALESCE(
    c.talking_points,
    (
      SELECT ARRAY(SELECT DISTINCT btrim(x) FROM unnest(
        COALESCE(c.topics_to_prioritize, '{}'::text[])
        || COALESCE(c.keywords_positive, '{}'::text[])
      ) AS t(x) WHERE btrim(x) <> '')
    )
  );

-- avoid <= topics_to_avoid[] + keywords_negative[]
UPDATE public.clients c SET
  avoid = COALESCE(
    c.avoid,
    (
      SELECT ARRAY(SELECT DISTINCT btrim(x) FROM unnest(
        COALESCE(c.topics_to_avoid, '{}'::text[])
        || COALESCE(c.keywords_negative, '{}'::text[])
      ) AS t(x) WHERE btrim(x) <> '')
    )
  );
