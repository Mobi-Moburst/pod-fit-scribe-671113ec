-- Enable pgcrypto for gen_random_uuid
create extension if not exists pgcrypto;

-- Clients table
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  industry text,
  icp text,
  target_roles text[],
  target_company_sizes text[],
  target_regions text[],
  topics_to_prioritize text[],
  topics_to_avoid text[],
  keywords_positive text[],
  keywords_negative text[],
  content_goals text,
  cta text,
  campaign_strategy text,
  media_kit_url text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Evaluations table
create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  url text not null,
  show_title text,
  show_notes_excerpt text,
  overall_score numeric(4,1) check (overall_score between 0 and 10),
  rubric_json jsonb not null,
  citations text[],
  confidence numeric(4,2),
  created_at timestamptz default now()
);

-- Touch updated_at trigger
create or replace function public.touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;

drop trigger if exists clients_touch on public.clients;
create trigger clients_touch before update on public.clients
for each row execute function public.touch_updated_at();

-- Security: disable RLS for internal tool scenario
alter table public.clients disable row level security;
alter table public.evaluations disable row level security;