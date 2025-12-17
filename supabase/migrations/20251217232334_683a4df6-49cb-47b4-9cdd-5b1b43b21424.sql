-- Remove the foreign key constraint first
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_client_id_fkey;

-- Drop the client_id column (no longer needed with company/speaker model)
ALTER TABLE reports DROP COLUMN IF EXISTS client_id;