-- safe_remove_wrong_coach_profile.sql
-- Objectif: supprimer un profil coach créé par erreur pour un compte client
-- Principes: ciblé, non destructif pour les vrais coachs, idempotent

begin;

-- Adapter l'ID si nécessaire
-- (celui remonté dans l'erreur API)
do $$
declare
  target_user_id uuid := '7d0fc8d6-5eb8-4ef7-a51c-fcffa1b958d9'::uuid;
  has_client_profile boolean;
  referenced_as_coach boolean;
begin
  -- Vérifie que ce user est bien lié à un profil client
  select exists (
    select 1
    from public.clients c
    where c.auth_user_id = target_user_id
  ) into has_client_profile;

  -- Vérifie qu'il est réellement utilisé comme coach dans la data métier
  select exists (
    select 1
    from public.clients c
    where c.coach_id::text = target_user_id::text
  )
  or exists (
    select 1
    from public.programs p
    where p.coach_id::text = target_user_id::text
  ) into referenced_as_coach;

  if has_client_profile and not referenced_as_coach then
    delete from public.coaches
    where id = target_user_id;

    raise notice 'Profil coach supprimé pour % (compte client, non référencé comme coach).', target_user_id;
  else
    raise notice 'Aucune suppression: has_client_profile=%, referenced_as_coach=% pour %.',
      has_client_profile, referenced_as_coach, target_user_id;
  end if;
end
$$;

commit;
