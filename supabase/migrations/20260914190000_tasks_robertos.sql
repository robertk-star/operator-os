alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks add constraint tasks_status_check check (status in ('open','doing','done','stopped','in_progress','waiting','completed','cancelled'));
alter table public.tasks add column if not exists priority text not null default 'normal';
alter table public.tasks add column if not exists waiting_on text;
alter table public.tasks add column if not exists follow_up_date date;
alter table public.tasks add column if not exists completed_at timestamptz;
alter table public.tasks add column if not exists assigned_to uuid;
