-- safe_coach_calendar_access.sql
-- Objectif: optimiser et sécuriser la lecture du calendrier global coach (scheduled_sessions).
-- Principes: additif, idempotent, non destructif.

begin;

-- -----------------------------------------------------------------------------
-- 0) Pré-check tables minimales
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.scheduled_sessions') is null then
    raise exception 'Table public.scheduled_sessions introuvable';
  end if;

  if to_regclass('public.clients') is null then
    raise exception 'Table public.clients introuvable';
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 1) Index de perf (coach calendar)
-- -----------------------------------------------------------------------------
create index if not exists idx_clients_coach_id_id
  on public.clients (coach_id, id);

create index if not exists idx_scheduled_sessions_date_client_status
  on public.scheduled_sessions (scheduled_date, client_id, status);

-- -----------------------------------------------------------------------------
-- 2) RLS scheduled_sessions
--    - Coach: lecture/écriture sur les sessions de ses clients
--    - Client: lecture + update sur ses propres sessions
-- -----------------------------------------------------------------------------
alter table public.scheduled_sessions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'scheduled_sessions'
      and policyname = 'scheduled_sessions_select_related_users'
  ) then
    create policy scheduled_sessions_select_related_users
      on public.scheduled_sessions
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.clients c
          where c.id = scheduled_sessions.client_id
            and (
              c.coach_id::text = auth.uid()::text
              or c.auth_user_id = auth.uid()
            )
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'scheduled_sessions'
      and policyname = 'scheduled_sessions_insert_coach_only'
  ) then
    create policy scheduled_sessions_insert_coach_only
      on public.scheduled_sessions
      for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.clients c
          where c.id = scheduled_sessions.client_id
            and c.coach_id::text = auth.uid()::text
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'scheduled_sessions'
      and policyname = 'scheduled_sessions_update_related_users'
  ) then
    create policy scheduled_sessions_update_related_users
      on public.scheduled_sessions
      for update
      to authenticated
      using (
        exists (
          select 1
          from public.clients c
          where c.id = scheduled_sessions.client_id
            and (
              c.coach_id::text = auth.uid()::text
              or c.auth_user_id = auth.uid()
            )
        )
      )
      with check (
        exists (
          select 1
          from public.clients c
          where c.id = scheduled_sessions.client_id
            and (
              c.coach_id::text = auth.uid()::text
              or c.auth_user_id = auth.uid()
            )
        )
      );
  end if;
end
$$;

commit;