-- Enable RLS to satisfy security while relying on service role in Edge Functions
alter table public.clients enable row level security;
alter table public.evaluations enable row level security;

-- No public policies are created so only service role (Edge Functions) can access.
-- This maintains the "internal tool" constraint safely.