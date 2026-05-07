-- safe_program_workout_preview_fields.sql
-- Objectif: ajouter les champs optionnels de previsualisation de seance sur public.programs.
-- Principes: additif, idempotent, non destructif.

begin;

-- -----------------------------------------------------------------------------
-- 0) Pre-check table programs
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.programs') is null then
    raise exception 'Table public.programs introuvable';
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 1) Colonnes optionnelles de previsualisation
-- -----------------------------------------------------------------------------
alter table public.programs
  add column if not exists session_instructions text null;

alter table public.programs
  add column if not exists estimated_duration_minutes integer null;

-- -----------------------------------------------------------------------------
-- 2) Contrainte douce sur la duree estimee (non bloquante)
-- -----------------------------------------------------------------------------
do $$
declare
  chk_exists boolean;
begin
  select exists (
    select 1
    from pg_constraint
    where conname = 'chk_programs_estimated_duration_minutes'
      and conrelid = 'public.programs'::regclass
  ) into chk_exists;

  if not chk_exists then
    alter table public.programs
      add constraint chk_programs_estimated_duration_minutes
      check (
        estimated_duration_minutes is null
        or estimated_duration_minutes between 1 and 600
      )
      not valid;
  end if;
end
$$;

commit;

-- -----------------------------------------------------------------------------
-- OPTIONNEL (plus tard)
-- -----------------------------------------------------------------------------
-- alter table public.programs validate constraint chk_programs_estimated_duration_minutes;
