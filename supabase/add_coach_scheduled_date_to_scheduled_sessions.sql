alter table public.scheduled_sessions
  add column if not exists coach_scheduled_date date null;

update public.scheduled_sessions
set coach_scheduled_date = scheduled_date
where coach_scheduled_date is null;