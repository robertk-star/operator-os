alter table public.contacts
  add column if not exists research_notes text,
  add column if not exists researched_at timestamptz;
