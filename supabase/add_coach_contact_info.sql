-- Add contact info fields to the coaches table so clients can reach them.
-- Run in Supabase SQL editor.

alter table public.coaches
  add column if not exists phone text;

alter table public.coaches
  add column if not exists email text;
-- Cached email for display (the auth.users email is the source of truth).

alter table public.coaches
  add column if not exists bio text;
-- Optional short bio displayed on the client's "Mon Coach" page.
