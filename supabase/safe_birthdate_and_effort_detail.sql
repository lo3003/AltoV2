-- safe_birthdate_and_effort_detail.sql
-- 1) Ajout de `birth_date` sur public.clients (l'âge sera calculé côté front).
-- 2) Ajout de `effort_detail` sur public.exercises pour les cardio (ex: "5 min à 8km/h").
-- Idempotent.

begin;

-- ---------- 1) clients.birth_date ----------
alter table public.clients
  add column if not exists birth_date date null;

-- (on conserve `age` pour les fiches anciennes qui n'ont pas encore de birth_date)

-- ---------- 2) exercises.effort_detail ----------
alter table public.exercises
  add column if not exists effort_detail text null;

commit;
