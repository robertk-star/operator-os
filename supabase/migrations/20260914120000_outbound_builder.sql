alter table public.outbound_sequences
  add column if not exists audience_tags text[] not null default '{}',
  add column if not exists tag_match_mode text not null default 'any',
  add column if not exists time_zone text not null default 'America/Chicago',
  add column if not exists sending_days integer[] not null default '{1,2,3,4,5}',
  add column if not exists start_hour text not null default '09:00',
  add column if not exists end_hour text not null default '16:00',
  add column if not exists min_minutes_between_emails integer not null default 15,
  add column if not exists max_leads_per_day integer not null default 25,
  add column if not exists unsubscribe_text text not null default 'Reply unsubscribe to stop future messages.',
  add column if not exists sender_postal_address text not null default '';

create table if not exists public.outbound_sequence_steps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  sequence_id uuid not null references public.outbound_sequences(id) on delete cascade,
  step_order integer not null default 1,
  delay_days integer not null default 0,
  subject text not null default '',
  body_text text not null default '',
  created_at timestamptz not null default now()
);

alter table public.outbound_sequence_steps enable row level security;
drop policy if exists outbound_steps_all on public.outbound_sequence_steps;
create policy outbound_steps_all on public.outbound_sequence_steps
  for all using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));
