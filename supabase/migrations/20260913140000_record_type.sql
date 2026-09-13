alter table public.contacts
  add column if not exists record_type text not null default 'company';
update public.contacts
  set record_type = 'person'
  where coalesce(email, '') <> '' or coalesce(first_name, '') <> '';
