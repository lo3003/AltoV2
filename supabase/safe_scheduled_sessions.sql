-- safe_scheduled_sessions.sql
-- Objectif: ajouter la planification fine des séances sans casser l'existant.
-- Principes:
-- 1) Additif et idempotent
-- 2) Compatible anciens schémas (types client/program dynamiques)
-- 3) Contrainte d'unicité non bloquante (skip si doublons)

begin;

-- -----------------------------------------------------------------------------
-- 0) Pré-check tables minimales
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.clients') is null then
    raise exception 'Table public.clients introuvable';
  end if;

  if to_regclass('public.programs') is null then
    raise exception 'Table public.programs introuvable';
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 1) Création de public.scheduled_sessions (si absente)
--    - id en bigserial pour stabilité
--    - client_id / program_id calés sur types réels des PK existantes
-- -----------------------------------------------------------------------------
do $$
declare
  client_id_type text;
  program_id_type text;
  table_exists boolean;
begin
  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'scheduled_sessions'
  ) into table_exists;

  if not table_exists then
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

    select format_type(a.atttypid, a.atttypmod)
    into program_id_type
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'programs'
      and a.attname = 'id'
      and a.attnum > 0
      and not a.attisdropped;

    if client_id_type is null then
      raise exception 'Impossible de déterminer le type de public.clients.id';
    end if;

    if program_id_type is null then
      raise exception 'Impossible de déterminer le type de public.programs.id';
    end if;

    execute format($sql$
      create table public.scheduled_sessions (
        id bigserial primary key,
        client_id %s not null,
        program_id %s not null,
        coach_scheduled_date date null,
        scheduled_date date not null,
        status text not null default 'planned',
        notes text null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$, client_id_type, program_id_type);

    raise notice 'Table public.scheduled_sessions créée (client_id %, program_id %).', client_id_type, program_id_type;
  else
    raise notice 'Table public.scheduled_sessions déjà présente.';
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 2) Colonnes additionnelles (idempotent) si table existait déjà
-- -----------------------------------------------------------------------------
alter table public.scheduled_sessions
  add column if not exists coach_scheduled_date date null;

alter table public.scheduled_sessions
  add column if not exists status text not null default 'planned';

alter table public.scheduled_sessions
  add column if not exists notes text null;

alter table public.scheduled_sessions
  add column if not exists created_at timestamptz not null default now();

alter table public.scheduled_sessions
  add column if not exists updated_at timestamptz not null default now();

update public.scheduled_sessions
set coach_scheduled_date = scheduled_date
where coach_scheduled_date is null;

-- -----------------------------------------------------------------------------
-- 3) FK de cohérence (NOT VALID pour ne pas bloquer l'historique)
-- -----------------------------------------------------------------------------
do $$
declare
  fk_client_exists boolean;
  fk_program_exists boolean;
begin
  select exists (
    select 1
    from pg_constraint
    where conname = 'scheduled_sessions_client_id_fkey'
      and conrelid = 'public.scheduled_sessions'::regclass
  ) into fk_client_exists;

  if not fk_client_exists then
    alter table public.scheduled_sessions
      add constraint scheduled_sessions_client_id_fkey
      foreign key (client_id)
      references public.clients(id)
      on delete cascade
      not valid;
  end if;

  select exists (
    select 1
    from pg_constraint
    where conname = 'scheduled_sessions_program_id_fkey'
      and conrelid = 'public.scheduled_sessions'::regclass
  ) into fk_program_exists;

  if not fk_program_exists then
    alter table public.scheduled_sessions
      add constraint scheduled_sessions_program_id_fkey
      foreign key (program_id)
      references public.programs(id)
      on delete cascade
      not valid;
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 4) Status autorisés (NOT VALID pour compatibilité)
-- -----------------------------------------------------------------------------
do $$
declare
  chk_exists boolean;
begin
  select exists (
    select 1
    from pg_constraint
    where conname = 'chk_scheduled_sessions_status'
      and conrelid = 'public.scheduled_sessions'::regclass
  ) into chk_exists;

  if not chk_exists then
    alter table public.scheduled_sessions
      add constraint chk_scheduled_sessions_status
      check (status in ('planned', 'completed', 'cancelled', 'skipped'))
      not valid;
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 5) Unicité d'un programme donné un jour donné pour un client
--    - si doublons existants, on skip pour ne pas bloquer
-- -----------------------------------------------------------------------------
do $$
declare
  duplicates_count bigint;
begin
  select count(*)
  into duplicates_count
  from (
    select client_id, program_id, scheduled_date
    from public.scheduled_sessions
    group by client_id, program_id, scheduled_date
    having count(*) > 1
  ) d;

  if duplicates_count = 0 then
    create unique index if not exists uq_scheduled_sessions_client_program_date
      on public.scheduled_sessions (client_id, program_id, scheduled_date);
  else
    raise notice 'Index unique non créé: % doublon(s) client/program/date détecté(s).', duplicates_count;
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 6) Index de lecture (calendrier)
-- -----------------------------------------------------------------------------
create index if not exists idx_scheduled_sessions_client_date
  on public.scheduled_sessions (client_id, scheduled_date);

create index if not exists idx_scheduled_sessions_program_date
  on public.scheduled_sessions (program_id, scheduled_date);

-- -----------------------------------------------------------------------------
-- 7) Trigger updated_at (sans DROP pour éviter toute opération destructive)
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.set_scheduled_sessions_updated_at()') is null then
    create function public.set_scheduled_sessions_updated_at()
    returns trigger
    language plpgsql
    as $fn$
    begin
      new.updated_at = now();
      return new;
    end;
    $fn$;
  else
    raise notice 'Fonction public.set_scheduled_sessions_updated_at() déjà présente.';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_scheduled_sessions_updated_at'
      and tgrelid = 'public.scheduled_sessions'::regclass
      and not tgisinternal
  ) then
    create trigger trg_scheduled_sessions_updated_at
    before update on public.scheduled_sessions
    for each row
    execute function public.set_scheduled_sessions_updated_at();
  else
    raise notice 'Trigger trg_scheduled_sessions_updated_at déjà présent.';
  end if;
end
$$;

commit;

-- -----------------------------------------------------------------------------
-- OPTIONNEL (plus tard, hors pic)
-- -----------------------------------------------------------------------------
-- alter table public.scheduled_sessions validate constraint scheduled_sessions_client_id_fkey;
-- alter table public.scheduled_sessions validate constraint scheduled_sessions_program_id_fkey;
-- alter table public.scheduled_sessions validate constraint chk_scheduled_sessions_status;
