alter table public.workout_logs
  add column if not exists duration_minutes integer;
