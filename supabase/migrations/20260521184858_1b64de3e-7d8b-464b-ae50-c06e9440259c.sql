SELECT cron.schedule(
  'fireflies-daily-sync',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://acrvymqsczclwzakpkip.supabase.co/functions/v1/sync-fireflies-meetings',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjcnZ5bXFzY3pjbHd6YWtwa2lwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyODQ4NTcsImV4cCI6MjA3Nzg2MDg1N30.uHccf32IxPnTP2aGQO9V9KKMDfgGn7CMCasM0TyuVMQ"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);