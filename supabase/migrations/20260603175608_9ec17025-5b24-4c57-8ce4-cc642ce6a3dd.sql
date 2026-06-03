CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Remove existing schedule if present, then schedule incremental sync every 10 minutes
DO $$
BEGIN
  PERFORM cron.unschedule('hubspot-tickets-sync-10min');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'hubspot-tickets-sync-10min',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://acrvymqsczclwzakpkip.supabase.co/functions/v1/hubspot-sync-tickets',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjcnZ5bXFzY3pjbHd6YWtwa2lwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyODQ4NTcsImV4cCI6MjA3Nzg2MDg1N30.uHccf32IxPnTP2aGQO9V9KKMDfgGn7CMCasM0TyuVMQ","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjcnZ5bXFzY3pjbHd6YWtwa2lwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyODQ4NTcsImV4cCI6MjA3Nzg2MDg1N30.uHccf32IxPnTP2aGQO9V9KKMDfgGn7CMCasM0TyuVMQ"}'::jsonb,
    body := '{"mode":"incremental"}'::jsonb
  );
  $$
);