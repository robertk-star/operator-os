alter table public.contacts add column if not exists drip_enrolled boolean not null default false;
alter table public.contacts add column if not exists drip_sequence_id uuid;
alter table public.contacts add column if not exists drip_sequence_name text;
