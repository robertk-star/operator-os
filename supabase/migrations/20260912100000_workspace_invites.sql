drop policy if exists workspaces_update_member on public.workspaces;
create policy workspaces_update_member on public.workspaces
  for update using (public.is_workspace_member(id))
  with check (public.is_workspace_member(id));

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  invited_by uuid references auth.users(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.workspace_invites enable row level security;

create policy invites_member_all on public.workspace_invites
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

grant select, insert, update, delete on public.workspace_invites to authenticated;

create or replace function public.accept_pending_invites()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  user_email text;
  added integer := 0;
begin
  uid := auth.uid();
  if uid is null then
    return 0;
  end if;
  select email into user_email from auth.users where id = uid;
  if user_email is null then
    return 0;
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  select i.workspace_id, uid, i.role
  from public.workspace_invites i
  where lower(i.email) = lower(user_email)
    and i.accepted_at is null
  on conflict (workspace_id, user_id) do nothing;

  get diagnostics added = row_count;

  update public.workspace_invites
  set accepted_at = now()
  where lower(email) = lower(user_email)
    and accepted_at is null;

  return added;
end;
$$;

grant execute on function public.accept_pending_invites() to authenticated;
