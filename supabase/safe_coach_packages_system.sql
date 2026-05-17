-- safe_coach_packages_system.sql
-- Système de forfait : le client paie le coach pour un nombre de séances
-- en présentiel AVEC le coach. À ne pas confondre avec scheduled_sessions
-- qui sont des séances planifiées (souvent à faire seul, gratuites).
--
-- Modèle:
--   * Un client peut avoir un forfait ACTIF à la fois (statut 'active'),
--     plus un historique de forfaits 'finished' / 'cancelled'.
--   * Le coach coche manuellement les séances qui ont eu lieu en présentiel.
--   * Le coach peut désactiver le système pour un client (séances offertes).
--
-- Idempotent + non destructif sur les colonnes legacy de `clients`.

begin;

-- =============================================================================
-- 0) Pré-check
-- =============================================================================
do $$
begin
  if to_regclass('public.clients') is null then
    raise exception 'Table public.clients introuvable';
  end if;
  if to_regclass('public.coaches') is null then
    raise exception 'Table public.coaches introuvable';
  end if;
end
$$;

-- =============================================================================
-- 1) Toggle on/off par client (sur public.clients)
-- =============================================================================
alter table public.clients
  add column if not exists package_enabled boolean not null default false;

-- =============================================================================
-- 2) Presets de tarification (sur public.coaches)
--    JSON array : [{ "sessions": 1, "price": 25 }, { "sessions": 10, "price": 225 }]
-- =============================================================================
alter table public.coaches
  add column if not exists package_pricing jsonb not null
    default '[{"sessions":1,"price":25},{"sessions":5,"price":120},{"sessions":10,"price":225}]'::jsonb;

-- =============================================================================
-- 3) Table coach_packages — un forfait acheté
-- =============================================================================
do $$
declare
  client_id_type text;
begin
  if to_regclass('public.coach_packages') is null then
    select format_type(a.atttypid, a.atttypmod)
    into client_id_type
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'clients' and a.attname = 'id'
      and a.attnum > 0 and not a.attisdropped;

    execute format($sql$
      create table public.coach_packages (
        id              uuid primary key default gen_random_uuid(),
        client_id       %s not null references public.clients(id) on delete cascade,
        coach_id        uuid not null references public.coaches(id) on delete cascade,
        total_sessions  integer not null check (total_sessions > 0 and total_sessions <= 1000),
        price_eur       numeric(8,2) not null default 0 check (price_eur >= 0),
        unit_price_eur  numeric(8,2) generated always as (
          case when total_sessions > 0 then round(price_eur / total_sessions, 2) else 0 end
        ) stored,
        status          text not null default 'active'
                        check (status in ('active','finished','cancelled')),
        purchased_at    date not null default current_date,
        notes           text null,
        created_at      timestamptz not null default now(),
        updated_at      timestamptz not null default now()
      )
    $sql$, client_id_type);
  end if;
end
$$;

-- Only one ACTIVE package per (client, coach). Partial unique index.
create unique index if not exists uq_coach_packages_one_active
  on public.coach_packages (client_id, coach_id)
  where status = 'active';

create index if not exists idx_coach_packages_client
  on public.coach_packages (client_id, status);
create index if not exists idx_coach_packages_coach
  on public.coach_packages (coach_id, status);

-- =============================================================================
-- 4) Table coach_package_sessions — historique des séances cochées
-- =============================================================================
do $$
declare
  client_id_type text;
begin
  if to_regclass('public.coach_package_sessions') is null then
    select format_type(a.atttypid, a.atttypmod)
    into client_id_type
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'clients' and a.attname = 'id'
      and a.attnum > 0 and not a.attisdropped;

    execute format($sql$
      create table public.coach_package_sessions (
        id                uuid primary key default gen_random_uuid(),
        package_id        uuid not null references public.coach_packages(id) on delete cascade,
        client_id         %s not null references public.clients(id) on delete cascade,
        coach_id          uuid not null references public.coaches(id) on delete cascade,
        session_date      date not null default current_date,
        session_type      text not null default 'Mixte',
        duration_min      integer not null default 60 check (duration_min > 0 and duration_min <= 360),
        notes             text null,
        created_at        timestamptz not null default now()
      )
    $sql$, client_id_type);
  end if;
end
$$;

create index if not exists idx_coach_package_sessions_package
  on public.coach_package_sessions (package_id, session_date desc);
create index if not exists idx_coach_package_sessions_client
  on public.coach_package_sessions (client_id, session_date desc);

-- =============================================================================
-- 5) Trigger updated_at sur coach_packages
-- =============================================================================
do $$
begin
  if to_regprocedure('public.set_coach_packages_updated_at()') is null then
    create function public.set_coach_packages_updated_at()
    returns trigger
    language plpgsql
    security definer
    set search_path = pg_catalog, pg_temp
    as $fn$
    begin
      new.updated_at = now();
      return new;
    end;
    $fn$;
    revoke execute on function public.set_coach_packages_updated_at() from public, anon, authenticated;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_coach_packages_updated_at'
      and tgrelid = 'public.coach_packages'::regclass
      and not tgisinternal
  ) then
    create trigger trg_coach_packages_updated_at
      before update on public.coach_packages
      for each row execute function public.set_coach_packages_updated_at();
  end if;
end
$$;

-- =============================================================================
-- 6) Trigger : auto-finish d'un forfait quand toutes les séances sont cochées
-- =============================================================================
do $$
begin
  if to_regprocedure('public.auto_finish_coach_package()') is null then
    create function public.auto_finish_coach_package()
    returns trigger
    language plpgsql
    security definer
    set search_path = public, pg_catalog, pg_temp
    as $fn$
    declare
      pkg_id uuid;
      pkg_total int;
      consumed int;
    begin
      pkg_id := coalesce(new.package_id, old.package_id);
      if pkg_id is null then return coalesce(new, old); end if;

      select total_sessions into pkg_total
      from public.coach_packages where id = pkg_id;

      select count(*) into consumed
      from public.coach_package_sessions where package_id = pkg_id;

      if pkg_total is not null then
        if consumed >= pkg_total then
          update public.coach_packages set status = 'finished'
          where id = pkg_id and status = 'active';
        else
          -- Re-open if a session was deleted and the pkg was 'finished'
          update public.coach_packages set status = 'active'
          where id = pkg_id and status = 'finished';
        end if;
      end if;
      return coalesce(new, old);
    end;
    $fn$;
    revoke execute on function public.auto_finish_coach_package() from public, anon, authenticated;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_auto_finish_coach_package_ins'
      and tgrelid = 'public.coach_package_sessions'::regclass
      and not tgisinternal
  ) then
    create trigger trg_auto_finish_coach_package_ins
      after insert on public.coach_package_sessions
      for each row execute function public.auto_finish_coach_package();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_auto_finish_coach_package_del'
      and tgrelid = 'public.coach_package_sessions'::regclass
      and not tgisinternal
  ) then
    create trigger trg_auto_finish_coach_package_del
      after delete on public.coach_package_sessions
      for each row execute function public.auto_finish_coach_package();
  end if;
end
$$;

-- =============================================================================
-- 7) RLS — coach OU client concerné
-- =============================================================================
alter table public.coach_packages enable row level security;
alter table public.coach_package_sessions enable row level security;

-- coach_packages policies
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='coach_packages'
      and policyname='coach_packages_select_owner'
  ) then
    create policy coach_packages_select_owner
      on public.coach_packages for select to authenticated
      using (
        coach_id = auth.uid()
        or exists (
          select 1 from public.clients c
          where c.id = coach_packages.client_id and c.auth_user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='coach_packages'
      and policyname='coach_packages_write_coach'
  ) then
    create policy coach_packages_write_coach
      on public.coach_packages for all to authenticated
      using (coach_id = auth.uid())
      with check (coach_id = auth.uid());
  end if;
end
$$;

-- coach_package_sessions policies
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='coach_package_sessions'
      and policyname='coach_package_sessions_select_owner'
  ) then
    create policy coach_package_sessions_select_owner
      on public.coach_package_sessions for select to authenticated
      using (
        coach_id = auth.uid()
        or exists (
          select 1 from public.clients c
          where c.id = coach_package_sessions.client_id and c.auth_user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='coach_package_sessions'
      and policyname='coach_package_sessions_write_coach'
  ) then
    create policy coach_package_sessions_write_coach
      on public.coach_package_sessions for all to authenticated
      using (coach_id = auth.uid())
      with check (coach_id = auth.uid());
  end if;
end
$$;

commit;

-- =============================================================================
-- VÉRIF (à lancer après commit)
-- =============================================================================
-- select tablename, policyname, cmd from pg_policies
-- where schemaname = 'public' and tablename in ('coach_packages','coach_package_sessions')
-- order by tablename, cmd;
