create table if not exists public.sequence_enrollments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  sequence_id uuid not null references public.outbound_sequences(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  status text not null default 'queued',
  created_at timestamptz not null default now(),
  unique (sequence_id, contact_id)
);

alter table public.sequence_enrollments enable row level security;
create policy sequence_enrollments_member_all on public.sequence_enrollments
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
grant select, insert, update, delete on public.sequence_enrollments to authenticated;
