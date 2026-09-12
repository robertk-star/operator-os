-- Allow an authenticated user to create a workspace and join as owner.
-- Run this in the Supabase SQL Editor after the core schema.

create policy workspaces_insert_authenticated on public.workspaces
  for insert to authenticated
  with check (true);

create policy workspace_members_insert_self on public.workspace_members
  for insert to authenticated
  with check (user_id = auth.uid());
