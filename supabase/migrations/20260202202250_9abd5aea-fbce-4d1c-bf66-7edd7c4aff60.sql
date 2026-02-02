-- Make personal_access_token nullable for connections using global token
ALTER TABLE airtable_connections 
  ALTER COLUMN personal_access_token DROP NOT NULL;