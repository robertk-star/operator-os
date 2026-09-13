alter table public.contacts
  add column if not exists reviewed boolean not null default false;
