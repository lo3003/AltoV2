-- Allow external (manual) sessions to be logged in workout_logs
-- (e.g. "Course 30 min", "Natation 1h", sports collectifs, etc.)
--
-- Run this in the Supabase SQL editor.

alter table public.workout_logs
  alter column program_id drop not null;

alter table public.workout_logs
  add column if not exists session_type text not null default 'app';
-- session_type: 'app' (logged via in-app workout) | 'external' (manually added by client)

alter table public.workout_logs
  add column if not exists external_name text;
-- Display name for external sessions, e.g. "Course matinale"

alter table public.workout_logs
  add column if not exists external_category text;
-- Free-form category, e.g. "Course", "Natation", "Sports collectifs", "Cardio", "Renforcement"

-- Optional: index to speed up "external session" filtering
create index if not exists workout_logs_session_type_idx
  on public.workout_logs (client_id, session_type, completed_at desc);
