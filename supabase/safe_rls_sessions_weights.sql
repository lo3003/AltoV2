-- safe_rls_sessions_weights.sql
-- Objectif: activer le RLS sur public.scheduled_sessions et public.client_weight_logs
--           sans casser l'app, avec des policies qui couvrent les 2 acteurs:
--             - le COACH propriétaire (clients.coach_id = auth.uid())
--             - le CLIENT lui-même  (clients.auth_user_id = auth.uid())
--
-- Principes:
--   * Idempotent : on peut le rejouer sans erreur
--   * Pas de DROP destructif sur policies existantes (au cas où)
--   * SECURITY DEFINER non utilisé : tout passe par auth.uid()
--
-- IMPORTANT: vérifier qu'aucune requête de l'app ne tape ces tables sans
-- être authentifiée. Toutes les requêtes passent par le client supabase-js
-- avec le JWT de l'user, donc OK.

begin;

-- =============================================================================
-- 1) public.scheduled_sessions
-- =============================================================================

alter table public.scheduled_sessions enable row level security;
-- on NE force PAS RLS pour le service_role (Edge Functions, cron) qui doit pouvoir
-- bypass via la service key. Le service_role bypass RLS par défaut sauf si forced.

-- ----- SELECT : coach propriétaire OU client concerné -----------------------
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'scheduled_sessions'
      and policyname = 'scheduled_sessions_select_owner'
  ) then
    create policy scheduled_sessions_select_owner
      on public.scheduled_sessions
      for select
      to authenticated
      using (
        exists (
          select 1 from public.clients c
          where c.id = scheduled_sessions.client_id
            and (c.coach_id = auth.uid() or c.auth_user_id = auth.uid())
        )
      );
  end if;
end $$;

-- ----- INSERT : seul le coach propriétaire peut planifier -------------------
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'scheduled_sessions'
      and policyname = 'scheduled_sessions_insert_coach'
  ) then
    create policy scheduled_sessions_insert_coach
      on public.scheduled_sessions
      for insert
      to authenticated
      with check (
        exists (
          select 1 from public.clients c
          where c.id = scheduled_sessions.client_id
            and c.coach_id = auth.uid()
        )
      );
  end if;
end $$;

-- ----- UPDATE : coach propriétaire OU client concerné -----------------------
-- (le client peut marquer une séance terminée / annulée côté app)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'scheduled_sessions'
      and policyname = 'scheduled_sessions_update_owner'
  ) then
    create policy scheduled_sessions_update_owner
      on public.scheduled_sessions
      for update
      to authenticated
      using (
        exists (
          select 1 from public.clients c
          where c.id = scheduled_sessions.client_id
            and (c.coach_id = auth.uid() or c.auth_user_id = auth.uid())
        )
      )
      with check (
        exists (
          select 1 from public.clients c
          where c.id = scheduled_sessions.client_id
            and (c.coach_id = auth.uid() or c.auth_user_id = auth.uid())
        )
      );
  end if;
end $$;

-- ----- DELETE : seul le coach propriétaire ----------------------------------
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'scheduled_sessions'
      and policyname = 'scheduled_sessions_delete_coach'
  ) then
    create policy scheduled_sessions_delete_coach
      on public.scheduled_sessions
      for delete
      to authenticated
      using (
        exists (
          select 1 from public.clients c
          where c.id = scheduled_sessions.client_id
            and c.coach_id = auth.uid()
        )
      );
  end if;
end $$;

-- =============================================================================
-- 2) public.client_weight_logs
-- =============================================================================

alter table public.client_weight_logs enable row level security;

-- ----- SELECT : coach propriétaire OU client concerné -----------------------
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'client_weight_logs'
      and policyname = 'client_weight_logs_select_owner'
  ) then
    create policy client_weight_logs_select_owner
      on public.client_weight_logs
      for select
      to authenticated
      using (
        exists (
          select 1 from public.clients c
          where c.id = client_weight_logs.client_id
            and (c.coach_id = auth.uid() or c.auth_user_id = auth.uid())
        )
      );
  end if;
end $$;

-- ----- INSERT : coach propriétaire OU client concerné -----------------------
-- (le client peut logger son poids, le coach peut le faire à sa place)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'client_weight_logs'
      and policyname = 'client_weight_logs_insert_owner'
  ) then
    create policy client_weight_logs_insert_owner
      on public.client_weight_logs
      for insert
      to authenticated
      with check (
        exists (
          select 1 from public.clients c
          where c.id = client_weight_logs.client_id
            and (c.coach_id = auth.uid() or c.auth_user_id = auth.uid())
        )
      );
  end if;
end $$;

-- ----- UPDATE : coach propriétaire OU client concerné -----------------------
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'client_weight_logs'
      and policyname = 'client_weight_logs_update_owner'
  ) then
    create policy client_weight_logs_update_owner
      on public.client_weight_logs
      for update
      to authenticated
      using (
        exists (
          select 1 from public.clients c
          where c.id = client_weight_logs.client_id
            and (c.coach_id = auth.uid() or c.auth_user_id = auth.uid())
        )
      )
      with check (
        exists (
          select 1 from public.clients c
          where c.id = client_weight_logs.client_id
            and (c.coach_id = auth.uid() or c.auth_user_id = auth.uid())
        )
      );
  end if;
end $$;

-- ----- DELETE : coach propriétaire OU client concerné -----------------------
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'client_weight_logs'
      and policyname = 'client_weight_logs_delete_owner'
  ) then
    create policy client_weight_logs_delete_owner
      on public.client_weight_logs
      for delete
      to authenticated
      using (
        exists (
          select 1 from public.clients c
          where c.id = client_weight_logs.client_id
            and (c.coach_id = auth.uid() or c.auth_user_id = auth.uid())
        )
      );
  end if;
end $$;

-- =============================================================================
-- Index pour les EXISTS (perf des policies)
-- =============================================================================
create index if not exists idx_clients_coach_id      on public.clients (coach_id);
create index if not exists idx_clients_auth_user_id  on public.clients (auth_user_id);

commit;

-- =============================================================================
-- VÉRIFICATION (à lancer après commit)
-- =============================================================================
-- select tablename, policyname, cmd
-- from pg_policies
-- where schemaname = 'public'
--   and tablename in ('scheduled_sessions', 'client_weight_logs')
-- order by tablename, cmd, policyname;
