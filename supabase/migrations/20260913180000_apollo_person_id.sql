alter table public.contacts
  add column if not exists apollo_person_id text;
