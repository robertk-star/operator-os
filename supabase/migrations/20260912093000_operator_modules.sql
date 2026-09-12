create table if not exists public.priorities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  rank integer not null default 1,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.tools (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  url text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.procedures (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.outbound_sequences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  audience text,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

alter table public.priorities enable row level security;
alter table public.tools enable row level security;
alter table public.procedures enable row level security;
alter table public.outbound_sequences enable row level security;

create policy priorities_member_all on public.priorities for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy tools_member_all on public.tools for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy procedures_member_all on public.procedures for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy outbound_member_all on public.outbound_sequences for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

grant select, insert, update, delete on public.priorities, public.tools, public.procedures, public.outbound_sequences to authenticated;
