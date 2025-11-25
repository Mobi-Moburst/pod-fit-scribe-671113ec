-- Add competitors column to clients table
ALTER TABLE clients 
ADD COLUMN competitors JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN clients.competitors IS 'Array of competitor/peer thought leaders with name, role, peer_reason, and optional interview_count';