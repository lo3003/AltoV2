-- safe_client_activation.sql
-- Objectif: permettre l'activation autonome d'un client via code sans ouvrir un SELECT large sur public.clients.
-- Stratégie:
-- 1) Index de lookup sur client_code
-- 2) RPC SECURITY DEFINER pour lookup et liaison auth_user_id
-- 3) Compatible RLS (les fonctions contournent RLS de facon controlee)

begin;

-- -----------------------------------------------------------------------------
-- 0) Pré-check
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.clients') is null then
    raise exception 'Table public.clients introuvable';
  end if;

  if to_regclass('auth.users') is null then
    raise exception 'Table auth.users introuvable';
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 1) Index lookup code client
-- -----------------------------------------------------------------------------
create index if not exists idx_clients_client_code_lookup
  on public.clients (client_code);

-- -----------------------------------------------------------------------------
-- 2) RPC: lookup d'activation (anon/authenticated)
-- -----------------------------------------------------------------------------
create or replace function public.client_activation_lookup(p_client_code text)
returns table (
  client_id text,
  email text,
  already_activated boolean,
  email_missing boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_code text := upper(trim(coalesce(p_client_code, '')));
begin
  if normalized_code = '' then
    return;
  end if;

  return query
  select
    c.id::text as client_id,
    c.email,
    (c.auth_user_id is not null) as already_activated,
    (coalesce(trim(c.email), '') = '') as email_missing
  from public.clients c
  where upper(trim(c.client_code)) = normalized_code
  limit 1;
end;
$$;

revoke all on function public.client_activation_lookup(text) from public;
grant execute on function public.client_activation_lookup(text) to anon;
grant execute on function public.client_activation_lookup(text) to authenticated;

-- -----------------------------------------------------------------------------
-- 3) RPC: liaison compte auth <-> client (authenticated)
-- -----------------------------------------------------------------------------
create or replace function public.client_activation_bind(p_client_code text, p_auth_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_code text := upper(trim(coalesce(p_client_code, '')));
begin
  if normalized_code = '' or p_auth_user_id is null then
    return false;
  end if;

  update public.clients c
  set auth_user_id = p_auth_user_id
  where upper(trim(c.client_code)) = normalized_code
    and c.auth_user_id is null;

  return found;
end;
$$;

revoke all on function public.client_activation_bind(text, uuid) from public;
grant execute on function public.client_activation_bind(text, uuid) to authenticated;

commit;