-- safe_client_weight_logs.sql
-- Objectif: journaliser le poids client semaine par semaine sans casser l'existant.
-- Principes: additif, idempotent, compatible legacy.

begin;

-- -----------------------------------------------------------------------------
-- 0) Pré-check
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.clients') is null then
    raise exception 'Table public.clients introuvable';
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 1) Création table public.client_weight_logs
-- -----------------------------------------------------------------------------
do $$
declare
  client_id_type text;
  table_exists boolean;
begin
  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'client_weight_logs'
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

    if client_id_type is null then
      raise exception 'Impossible de déterminer le type de public.clients.id';
    end if;

    execute format($sql$
      create table public.client_weight_logs (
        id bigserial primary key,
        client_id %s not null,
        weight_kg numeric(6,2) not null,
        measured_at date not null default current_date,
        note text null,
        created_at timestamptz not null default now()
      )
    $sql$, client_id_type);

    raise notice 'Table public.client_weight_logs créée (client_id %).', client_id_type;
  else
    raise notice 'Table public.client_weight_logs déjà présente.';
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 2) Colonnes additionnelles (idempotent)
-- -----------------------------------------------------------------------------
alter table public.client_weight_logs
  add column if not exists note text null;

alter table public.client_weight_logs
  add column if not exists created_at timestamptz not null default now();

-- -----------------------------------------------------------------------------
-- 3) FK (NOT VALID pour compatibilité)
-- -----------------------------------------------------------------------------
do $$
declare
  fk_exists boolean;
begin
  select exists (
    select 1
    from pg_constraint
    where conname = 'client_weight_logs_client_id_fkey'
      and conrelid = 'public.client_weight_logs'::regclass
  ) into fk_exists;

  if not fk_exists then
    alter table public.client_weight_logs
      add constraint client_weight_logs_client_id_fkey
      foreign key (client_id)
      references public.clients(id)
      on delete cascade
      not valid;
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 4) Check poids raisonnable (NOT VALID)
-- -----------------------------------------------------------------------------
do $$
declare
  chk_exists boolean;
begin
  select exists (
    select 1
    from pg_constraint
    where conname = 'chk_client_weight_logs_weight'
      and conrelid = 'public.client_weight_logs'::regclass
  ) into chk_exists;

  if not chk_exists then
    alter table public.client_weight_logs
      add constraint chk_client_weight_logs_weight
      check (weight_kg > 0 and weight_kg < 500)
      not valid;
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 5) Unicité d'une saisie par jour/client (skip si doublons)
-- -----------------------------------------------------------------------------
do $$
declare
  duplicates_count bigint;
begin
  select count(*)
  into duplicates_count
  from (
    select client_id, measured_at
    from public.client_weight_logs
    group by client_id, measured_at
    having count(*) > 1
  ) d;

  if duplicates_count = 0 then
    create unique index if not exists uq_client_weight_logs_client_date
      on public.client_weight_logs (client_id, measured_at);
  else
    raise notice 'Index unique non créé: % doublon(s) client/date détecté(s).', duplicates_count;
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 6) Index de lecture
-- -----------------------------------------------------------------------------
create index if not exists idx_client_weight_logs_client_measured
  on public.client_weight_logs (client_id, measured_at);

commit;

-- -----------------------------------------------------------------------------
-- OPTIONNEL (plus tard)
-- -----------------------------------------------------------------------------
-- alter table public.client_weight_logs validate constraint client_weight_logs_client_id_fkey;
-- alter table public.client_weight_logs validate constraint chk_client_weight_logs_weight;
