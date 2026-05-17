-- safe_exercise_variants.sql
-- Ajoute une colonne `variants` (jsonb) sur public.exercises.
-- Une variante = un exercice alternatif à faire si le client n'a pas le
-- matériel. Elle hérite par défaut des paramètres de l'exercice de base
-- mais le coach peut les ajuster.
--
-- Forme du JSON : tableau d'objets
--   [{ "name": "...", "photo_url": "...", "body_part": "...",
--      "sets": "3", "reps": "12", "charge": "...", "charge_type": "kg",
--      "rest_time": "01:00", "effort_type": "fixed",
--      "reps_min": null, "reps_max": null, "duration_minutes": null,
--      "comment": "..." }]
--
-- Idempotent.

begin;

alter table public.exercises
  add column if not exists variants jsonb not null default '[]'::jsonb;

commit;
