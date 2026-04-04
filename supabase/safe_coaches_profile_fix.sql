-- safe_coaches_profile_fix.sql
-- Objectif: corriger le 406/PGRST116 sur /coaches?id=eq.<auth_user_id>
-- Principes:
-- 1) Non destructif et idempotent
-- 2) Compatible avec une base partiellement initialisée
-- 3) Ajoute le profil coach manquant sans impacter les clients

begin;

-- -----------------------------------------------------------------------------
-- 0) Pré-check auth.users
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('auth.users') is null then
    raise exception 'Table auth.users introuvable';
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 1) Table public.coaches (création sûre)
-- -----------------------------------------------------------------------------
create table if not exists public.coaches (
  id uuid primary key,
  full_name text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.coaches
  add column if not exists full_name text null;

alter table public.coaches
  add column if not exists created_at timestamptz not null default now();

alter table public.coaches
  add column if not exists updated_at timestamptz not null default now();

-- FK vers auth.users (NOT VALID pour rester non bloquant)
do $$
declare
  fk_exists boolean;
begin
  select exists (
    select 1
    from pg_constraint
    where conname = 'coaches_id_fkey'
      and conrelid = 'public.coaches'::regclass
  ) into fk_exists;

  if not fk_exists then
    alter table public.coaches
      add constraint coaches_id_fkey
      foreign key (id)
      references auth.users(id)
      on delete cascade
      not valid;
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 2) Trigger updated_at (idempotent)
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.set_coaches_updated_at()') is null then
    create function public.set_coaches_updated_at()
    returns trigger
    language plpgsql
    as $fn$
    begin
      new.updated_at = now();
      return new;
    end;
    $fn$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_coaches_updated_at'
      and tgrelid = 'public.coaches'::regclass
      and not tgisinternal
  ) then
    create trigger trg_coaches_updated_at
    before update on public.coaches
    for each row
    execute function public.set_coaches_updated_at();
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 3) RLS + policies minimales (lecture/màj de son propre profil)
-- -----------------------------------------------------------------------------
alter table public.coaches enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'coaches'
      and policyname = 'coaches_select_own'
  ) then
    create policy coaches_select_own
      on public.coaches
      for select
      to authenticated
      using (id = auth.uid());
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'coaches'
      and policyname = 'coaches_update_own'
  ) then
    create policy coaches_update_own
      on public.coaches
      for update
      to authenticated
      using (id = auth.uid())
      with check (id = auth.uid());
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'coaches'
      and policyname = 'coaches_insert_own'
  ) then
    create policy coaches_insert_own
      on public.coaches
      for insert
      to authenticated
      with check (id = auth.uid());
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 4) Backfill non destructif des coachs déjà référencés
--    (clients.coach_id / programs.coach_id -> coaches.id)
-- -----------------------------------------------------------------------------
do $$
declare
  clients_exists boolean;
  programs_exists boolean;
  sql_text text;
begin
  select to_regclass('public.clients') is not null into clients_exists;
  select to_regclass('public.programs') is not null into programs_exists;

  sql_text := '';

  if clients_exists then
    sql_text := sql_text || '
      select distinct c.coach_id::uuid as coach_id
      from public.clients c
      where c.coach_id is not null';
  end if;

  if programs_exists then
    if sql_text <> '' then
      sql_text := sql_text || '
      union';
    end if;

    sql_text := sql_text || '
      select distinct p.coach_id::uuid as coach_id
      from public.programs p
      where p.coach_id is not null';
  end if;

  if sql_text <> '' then
    execute format($q$
      insert into public.coaches (id, full_name)
      select src.coach_id,
             coalesce(
               nullif(trim(coalesce(u.raw_user_meta_data->>'full_name', '')), ''),
               split_part(coalesce(u.email, ''), '@', 1),
               'Coach'
             )
      from (
        %s
      ) src
      left join auth.users u on u.id = src.coach_id
      on conflict (id) do nothing
    $q$, sql_text);
  end if;
end
$$;

commit;

-- -----------------------------------------------------------------------------
-- OPTIONNEL (plus tard)
-- -----------------------------------------------------------------------------
-- alter table public.coaches validate constraint coaches_id_fkey;
