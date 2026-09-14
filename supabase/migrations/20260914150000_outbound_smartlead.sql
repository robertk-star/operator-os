alter table public.outbound_sequences
  add column if not exists external_campaign_id text,
  add column if not exists last_error text,
  add column if not exists sending_account_ids text[] not null default '{}';
