-- safe_security_warnings_fix.sql
-- Objectif: traiter les warnings du Security Advisor Supabase.
--
-- Cible:
--   1) Figer search_path des trigger functions (5 warnings function_search_path_mutable)
--   2) Révoquer EXECUTE sur les trigger functions exposées en REST (4 warnings)
--   3) Restreindre client_activation_* à `anon` uniquement (2 warnings authenticated)
--
-- Non couvert ici (manuel):
--   - Leaked password protection: Dashboard → Authentication → Policies → Enable
--   - Les 2 warnings restants sur client_activation_* côté `anon` sont VOULUS
--     (c'est le flux d'activation depuis l'écran de login, anon doit pouvoir appeler)

begin;

-- =============================================================================
-- 1) Search path immutable sur les trigger functions
-- =============================================================================
-- search_path = '' force tout à être qualifié (le plus strict). On utilise
-- `pg_catalog, pg_temp` qui est le standard recommandé par Supabase.
-- Si une fonction a besoin d'objets `public`, on l'ajoute explicitement.

do $$
begin
  if to_regprocedure('public.set_scheduled_sessions_updated_at()') is not null then
    alter function public.set_scheduled_sessions_updated_at()
      set search_path = pg_catalog, pg_temp;
  end if;
end $$;

do $$
begin
  if to_regprocedure('public.set_coaches_updated_at()') is not null then
    alter function public.set_coaches_updated_at()
      set search_path = pg_catalog, pg_temp;
  end if;
end $$;

do $$
begin
  if to_regprocedure('public.set_messages_updated_at()') is not null then
    alter function public.set_messages_updated_at()
      set search_path = pg_catalog, pg_temp;
  end if;
end $$;

-- Ces deux-là touchent à `auth.users` / `public.clients`, donc on inclut public.
do $$
begin
  if to_regprocedure('public.delete_auth_user_if_client_deleted()') is not null then
    alter function public.delete_auth_user_if_client_deleted()
      set search_path = public, pg_catalog, pg_temp;
  end if;
end $$;

do $$
begin
  if to_regprocedure('public.link_client_to_auth_user()') is not null then
    alter function public.link_client_to_auth_user()
      set search_path = public, pg_catalog, pg_temp;
  end if;
end $$;

-- =============================================================================
-- 2) Révoquer EXECUTE sur les trigger functions
--    Elles sont appelées UNIQUEMENT par le moteur de triggers postgres.
--    Personne (anon, authenticated, public) ne devrait pouvoir les appeler via REST.
-- =============================================================================

do $$
begin
  if to_regprocedure('public.delete_auth_user_if_client_deleted()') is not null then
    revoke execute on function public.delete_auth_user_if_client_deleted()
      from public, anon, authenticated;
  end if;
end $$;

do $$
begin
  if to_regprocedure('public.link_client_to_auth_user()') is not null then
    revoke execute on function public.link_client_to_auth_user()
      from public, anon, authenticated;
  end if;
end $$;

-- Bonus: pareil pour les `set_*_updated_at`, ce sont aussi des trigger fns
do $$
begin
  if to_regprocedure('public.set_scheduled_sessions_updated_at()') is not null then
    revoke execute on function public.set_scheduled_sessions_updated_at()
      from public, anon, authenticated;
  end if;
end $$;

do $$
begin
  if to_regprocedure('public.set_coaches_updated_at()') is not null then
    revoke execute on function public.set_coaches_updated_at()
      from public, anon, authenticated;
  end if;
end $$;

do $$
begin
  if to_regprocedure('public.set_messages_updated_at()') is not null then
    revoke execute on function public.set_messages_updated_at()
      from public, anon, authenticated;
  end if;
end $$;

-- =============================================================================
-- 3) client_activation_lookup / client_activation_bind
--    NON TRAITÉ — ces fonctions DOIVENT rester appelables par anon ET
--    authenticated (le flux d'activation peut basculer entre les deux rôles
--    selon la config email-confirm de Supabase Auth). Les 4 warnings restants
--    (anon × 2 + authenticated × 2) sont volontaires et acceptés.
--
--    Ils sont sécurisés au niveau APPLICATIF par la fonction elle-même qui
--    valide le client_code et l'auth_user_id avant de modifier quoi que ce soit.
-- =============================================================================

commit;

-- =============================================================================
-- VÉRIFICATIONS (optionnel, à lancer après commit)
-- =============================================================================

-- 1) Voir le search_path figé sur chaque fonction
-- select n.nspname || '.' || p.proname as function,
--        unnest(p.proconfig)            as config
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in (
--     'set_scheduled_sessions_updated_at',
--     'set_coaches_updated_at',
--     'set_messages_updated_at',
--     'delete_auth_user_if_client_deleted',
--     'link_client_to_auth_user'
--   );

-- 2) Voir qui peut exécuter quoi
-- select n.nspname || '.' || p.proname as function,
--        pg_catalog.pg_get_function_arguments(p.oid) as args,
--        coalesce(array_agg(acl.grantee::regrole) filter (where acl.grantee is not null), '{}') as grantees
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- left join lateral aclexplode(p.proacl) acl on true
-- where n.nspname = 'public'
--   and p.proname in (
--     'client_activation_lookup',
--     'client_activation_bind',
--     'delete_auth_user_if_client_deleted',
--     'link_client_to_auth_user',
--     'set_scheduled_sessions_updated_at',
--     'set_coaches_updated_at',
--     'set_messages_updated_at'
--   )
-- group by 1, 2;
