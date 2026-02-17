-- Fix existing airtable connections that have "Episode Link" instead of "Link to episode"
UPDATE airtable_connections 
SET field_mapping = jsonb_set(
  field_mapping::jsonb, 
  '{link_to_episode}', 
  '"Link to episode"'
)
WHERE field_mapping::jsonb->>'link_to_episode' = 'Episode Link';