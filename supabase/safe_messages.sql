-- safe_messages.sql
-- Active la messagerie sans casser les données legacy (IDs mixtes)
-- sender_id / receiver_id peuvent contenir UUID auth ou ID client legacy en texte

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
-- 1) Table messages (création si absente)
-- -----------------------------------------------------------------------------
create table if not exists public.messages (
  id bigserial primary key,
  sender_id text not null,
  receiver_id text not null,
  content text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 2) Colonnes additionnelles (idempotent)
-- -----------------------------------------------------------------------------
alter table public.messages add column if not exists sender_id text;
alter table public.messages add column if not exists receiver_id text;
alter table public.messages add column if not exists content text;
alter table public.messages add column if not exists is_read boolean not null default false;
alter table public.messages add column if not exists created_at timestamptz not null default now();
alter table public.messages add column if not exists updated_at timestamptz not null default now();

-- -----------------------------------------------------------------------------
-- 3) Index utiles
-- -----------------------------------------------------------------------------
create index if not exists idx_messages_sender_receiver_created
  on public.messages (sender_id, receiver_id, created_at);

create index if not exists idx_messages_receiver_read
  on public.messages (receiver_id, is_read, created_at);

-- -----------------------------------------------------------------------------
-- 4) Trigger updated_at
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.set_messages_updated_at()') is null then
    create function public.set_messages_updated_at()
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
    where tgname = 'trg_messages_updated_at'
      and tgrelid = 'public.messages'::regclass
      and not tgisinternal
  ) then
    create trigger trg_messages_updated_at
      before update on public.messages
      for each row
      execute function public.set_messages_updated_at();
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 5) RLS + policies compatibles legacy
-- -----------------------------------------------------------------------------
alter table public.messages enable row level security;

do $$
declare
  clients_exists boolean;
  expr_select text;
begin
  select to_regclass('public.clients') is not null into clients_exists;

  if clients_exists then
    expr_select := '
      sender_id::text = auth.uid()::text
      or receiver_id::text = auth.uid()::text
      or sender_id::text in (select c.id::text from public.clients c where c.auth_user_id = auth.uid())
      or receiver_id::text in (select c.id::text from public.clients c where c.auth_user_id = auth.uid())
    ';
  else
    expr_select := '
      sender_id::text = auth.uid()::text
      or receiver_id::text = auth.uid()::text
    ';
  end if;

  execute 'drop policy if exists messages_select_participants on public.messages';
  execute format(
    'create policy messages_select_participants on public.messages for select to authenticated using (%s)',
    expr_select
  );
end
$$;

do $$
declare
  clients_exists boolean;
  expr_insert text;
begin
  select to_regclass('public.clients') is not null into clients_exists;

  if clients_exists then
    expr_insert := '
      sender_id::text = auth.uid()::text
      or sender_id::text in (select c.id::text from public.clients c where c.auth_user_id = auth.uid())
    ';
  else
    expr_insert := 'sender_id::text = auth.uid()::text';
  end if;

  execute 'drop policy if exists messages_insert_sender_only on public.messages';
  execute format(
    'create policy messages_insert_sender_only on public.messages for insert to authenticated with check (%s)',
    expr_insert
  );
end
$$;

do $$
declare
  clients_exists boolean;
  expr_update text;
begin
  select to_regclass('public.clients') is not null into clients_exists;

  if clients_exists then
    expr_update := '
      receiver_id::text = auth.uid()::text
      or receiver_id::text in (select c.id::text from public.clients c where c.auth_user_id = auth.uid())
    ';
  else
    expr_update := 'receiver_id::text = auth.uid()::text';
  end if;

  execute 'drop policy if exists messages_update_receiver_only on public.messages';
  execute format(
    'create policy messages_update_receiver_only on public.messages for update to authenticated using (%1$s) with check (%1$s)',
    expr_update
  );
end
$$;

commit;