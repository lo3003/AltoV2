-- Allow the coach to attach a per-assignment instruction note when sending
-- a program to a client (e.g. "Pense à bien t'échauffer 10 min avant").
--
-- Run in Supabase SQL editor.

alter table public.client_programs
  add column if not exists coach_instructions text;
