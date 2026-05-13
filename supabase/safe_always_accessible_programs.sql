-- safe_always_accessible_programs.sql
-- Adds an `always_accessible` flag on client_programs assignments.
-- A program marked as always accessible is shown to the client regardless
-- of start/end dates, and pinned to the top of their dashboard.
-- Idempotent.

begin;

alter table public.client_programs
  add column if not exists always_accessible boolean not null default false;

create index if not exists idx_client_programs_always_accessible
  on public.client_programs (client_id, always_accessible)
  where always_accessible = true;

commit;
