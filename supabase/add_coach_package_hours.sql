-- Track the prepaid coaching hours package per client.
-- Lets the client see "Il te reste 6h avec <Coach> !" on their stats page.
--
-- Run this in the Supabase SQL editor.

alter table public.clients
  add column if not exists coach_package_total_hours numeric(6, 2);
-- Total hours purchased in the current package (e.g. 10.0). NULL means no active package.

alter table public.clients
  add column if not exists coach_package_used_hours numeric(6, 2) default 0;
-- Hours already consumed (the coach updates this manually after each session).

alter table public.clients
  add column if not exists coach_package_started_at date;
-- Optional: when the current package started — useful for billing UIs later.
