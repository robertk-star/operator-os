-- Reliable first-run create. Run this in the Supabase SQL Editor.

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create or replace function public.create_workspace(workspace_name text, workspace_mode text default 'solo')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  uid uuid;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'Not signed in';
  end if;
  if workspace_mode not in ('solo', 'team') then
    workspace_mode := 'solo';
  end if;

  insert into public.workspaces (name, mode)
  values (workspace_name, workspace_mode)
  returning id into new_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_id, uid, 'owner');

  return new_id;
end;
$$;

revoke all on function public.create_workspace(text, text) from public;
grant execute on function public.create_workspace(text, text) to authenticated;
