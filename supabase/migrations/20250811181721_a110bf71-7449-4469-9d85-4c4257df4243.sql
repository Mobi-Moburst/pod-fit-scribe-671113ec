
-- 1) Ensure extension for UUID operations
create extension if not exists pgcrypto;

-- 2) Add org_id column to scope data to your organization
alter table public.clients add column if not exists org_id uuid;
alter table public.evaluations add column if not exists org_id uuid;

-- Make org_id required (will be populated by trigger from request header)
alter table public.clients alter column org_id set not null;
alter table public.evaluations alter column org_id set not null;

-- 3) Require only the fields you want for new clients
-- Make campaign_strategy and media_kit_url required and non-empty
-- Backfill NULLs to empty strings first to avoid migration errors (new DB should have none)
update public.clients set campaign_strategy = coalesce(campaign_strategy, '');
update public.clients set media_kit_url = coalesce(media_kit_url, '');

alter table public.clients
  alter column campaign_strategy set not null,
  alter column media_kit_url set not null,
  add constraint clients_campaign_strategy_nonempty check (char_length(btrim(campaign_strategy)) > 0),
  add constraint clients_media_kit_nonempty check (char_length(btrim(media_kit_url)) > 0);

-- 4) Trigger to set org_id from request header on insert
create or replace function public.set_org_id_from_header()
returns trigger
language plpgsql
as $$
declare
  hdr text;
begin
  -- Read x-org-id header (if present)
  begin
    hdr := current_setting('request.headers.x-org-id', true);
  exception when others then
    hdr := null;
  end;

  if (new.org_id is null) then
    if hdr is null or hdr = '' then
      raise exception 'Missing x-org-id request header required by RLS';
    end if;
    new.org_id := hdr::uuid;
  end if;

  return new;
end;
$$;

drop trigger if exists clients_set_org on public.clients;
create trigger clients_set_org
before insert on public.clients
for each row execute function public.set_org_id_from_header();

drop trigger if exists evaluations_set_org on public.evaluations;
create trigger evaluations_set_org
before insert on public.evaluations
for each row execute function public.set_org_id_from_header();

-- 5) RLS: enable and add org-scoped policies for browser access
alter table public.clients enable row level security;
alter table public.evaluations enable row level security;

-- Drop any existing policies to avoid duplicates (safe if none exist)
do $$
begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='clients') then
    execute 'drop policy if exists clients_select_org on public.clients';
    execute 'drop policy if exists clients_insert_org on public.clients';
    execute 'drop policy if exists clients_update_org on public.clients';
    execute 'drop policy if exists clients_delete_org on public.clients';
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='evaluations') then
    execute 'drop policy if exists evals_select_org on public.evaluations';
    execute 'drop policy if exists evals_insert_org on public.evaluations';
    execute 'drop policy if exists evals_update_org on public.evaluations';
    execute 'drop policy if exists evals_delete_org on public.evaluations';
  end if;
end$$;

-- Clients policies
create policy clients_select_org
  on public.clients
  for select
  using (org_id = nullif(current_setting('request.headers.x-org-id', true), '')::uuid);

create policy clients_insert_org
  on public.clients
  for insert
  with check (org_id = nullif(current_setting('request.headers.x-org-id', true), '')::uuid);

create policy clients_update_org
  on public.clients
  for update
  using (org_id = nullif(current_setting('request.headers.x-org-id', true), '')::uuid)
  with check (org_id = nullif(current_setting('request.headers.x-org-id', true), '')::uuid);

create policy clients_delete_org
  on public.clients
  for delete
  using (org_id = nullif(current_setting('request.headers.x-org-id', true), '')::uuid);

-- Evaluations policies
create policy evals_select_org
  on public.evaluations
  for select
  using (org_id = nullif(current_setting('request.headers.x-org-id', true), '')::uuid);

create policy evals_insert_org
  on public.evaluations
  for insert
  with check (org_id = nullif(current_setting('request.headers.x-org-id', true), '')::uuid);

create policy evals_update_org
  on public.evaluations
  for update
  using (org_id = nullif(current_setting('request.headers.x-org-id', true), '')::uuid)
  with check (org_id = nullif(current_setting('request.headers.x-org-id', true), '')::uuid);

create policy evals_delete_org
  on public.evaluations
  for delete
  using (org_id = nullif(current_setting('request.headers.x-org-id', true), '')::uuid);

-- 6) Helpful indexes
create index if not exists clients_org_id_idx on public.clients(org_id);
create index if not exists evaluations_org_id_idx on public.evaluations(org_id);
create index if not exists evaluations_client_id_idx on public.evaluations(client_id);
