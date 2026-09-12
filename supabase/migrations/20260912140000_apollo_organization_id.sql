alter table public.organizations
  add column if not exists apollo_organization_id text;
create unique index if not exists organizations_workspace_apollo_id
  on public.organizations (workspace_id, apollo_organization_id)
  where apollo_organization_id is not null;
