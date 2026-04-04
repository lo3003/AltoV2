-- safe_custom_program_linking.sql
-- Objectif: préparer la BDD pour les programmes sur-mesure SANS casser l'existant.
-- Principes de sécurité:
-- 1) Additif uniquement (pas de drop/rename destructif)
-- 2) Idempotent (relançable)
-- 3) Contraintes en NOT VALID quand nécessaire
-- 4) Skip contrôlé avec NOTICE si la donnée existante est incompatible

begin;

-- -----------------------------------------------------------------------------
-- 0) Pré-check: tables minimales
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.programs') is null then
    raise exception 'Table public.programs introuvable';
  end if;

  if to_regclass('public.clients') is null then
    raise exception 'Table public.clients introuvable';
  end if;

  if to_regclass('public.client_programs') is null then
    raise exception 'Table public.client_programs introuvable';
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 1) programs.specific_client_id (ajout si absent, typé comme clients.id)
-- -----------------------------------------------------------------------------
do $$
declare
  client_id_type text;
  has_specific_client_id boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'programs'
      and column_name = 'specific_client_id'
  ) into has_specific_client_id;

  if not has_specific_client_id then
    select format_type(a.atttypid, a.atttypmod)
    into client_id_type
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'clients'
      and a.attname = 'id'
      and a.attnum > 0
      and not a.attisdropped;

    if client_id_type is null then
      raise exception 'Impossible de déterminer le type de public.clients.id';
    end if;

    execute format(
      'alter table public.programs add column specific_client_id %s null',
      client_id_type
    );

    raise notice 'Colonne programs.specific_client_id ajoutée (%).', client_id_type;
  else
    raise notice 'Colonne programs.specific_client_id déjà présente.';
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 2) Index utile pour la séparation modèles/sur-mesure
-- -----------------------------------------------------------------------------
create index if not exists idx_programs_coach_specific_client
  on public.programs (coach_id, specific_client_id);

-- -----------------------------------------------------------------------------
-- 3) FK programs.specific_client_id -> clients.id (NOT VALID pour ne pas bloquer)
-- -----------------------------------------------------------------------------
do $$
declare
  fk_exists boolean;
begin
  select exists (
    select 1
    from pg_constraint
    where conname = 'programs_specific_client_id_fkey'
      and conrelid = 'public.programs'::regclass
  ) into fk_exists;

  if not fk_exists then
    alter table public.programs
      add constraint programs_specific_client_id_fkey
      foreign key (specific_client_id)
      references public.clients(id)
      on delete set null
      not valid;

    raise notice 'FK programs_specific_client_id_fkey créée en NOT VALID.';
  else
    raise notice 'FK programs_specific_client_id_fkey déjà présente.';
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 4) Unicité client_programs(client_id, program_id)
--    Sécurisé: si doublons existants, on NE CRASH PAS; on skip avec NOTICE.
-- -----------------------------------------------------------------------------
do $$
declare
  duplicates_count bigint;
begin
  select count(*)
  into duplicates_count
  from (
    select client_id, program_id
    from public.client_programs
    group by client_id, program_id
    having count(*) > 1
  ) d;

  if duplicates_count = 0 then
    create unique index if not exists uq_client_programs_client_program
      on public.client_programs (client_id, program_id);

    raise notice 'Index unique uq_client_programs_client_program OK.';
  else
    raise notice 'Index unique non créé: % doublon(s) client_programs(client_id, program_id) détecté(s).', duplicates_count;
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 5) Intégrité des dates sur client_programs (sans casser l'historique)
-- -----------------------------------------------------------------------------
do $$
declare
  chk_exists boolean;
begin
  select exists (
    select 1
    from pg_constraint
    where conname = 'chk_client_programs_dates'
      and conrelid = 'public.client_programs'::regclass
  ) into chk_exists;

  if not chk_exists then
    alter table public.client_programs
      add constraint chk_client_programs_dates
      check (
        start_date is null
        or end_date is null
        or end_date > start_date
      )
      not valid;

    raise notice 'Contrainte chk_client_programs_dates créée en NOT VALID.';
  else
    raise notice 'Contrainte chk_client_programs_dates déjà présente.';
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 6) Index de requêtage utile pour les timelines client
-- -----------------------------------------------------------------------------
create index if not exists idx_client_programs_client_dates
  on public.client_programs (client_id, start_date, end_date);

commit;

-- -----------------------------------------------------------------------------
-- OPTIONNEL (à exécuter plus tard, hors pic, après nettoyage des données)
-- -----------------------------------------------------------------------------
-- alter table public.programs validate constraint programs_specific_client_id_fkey;
-- alter table public.client_programs validate constraint chk_client_programs_dates;
