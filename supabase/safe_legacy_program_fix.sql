begin;

create extension if not exists pgcrypto;

alter table public.exercises add column if not exists execution_mode text;
alter table public.exercises add column if not exists amrap_duration integer;
alter table public.exercises add column if not exists tabata_work integer;
alter table public.exercises add column if not exists tabata_rest integer;
alter table public.exercises add column if not exists is_section_header boolean default false;
alter table public.exercises add column if not exists superset_id text;

update public.exercises e
set execution_mode = normalized.mode
from (
  select
    id,
    case
      when lower(trim(coalesce(execution_mode, ''))) like '%emom%'
        or lower(trim(coalesce(type, ''))) like '%emom%'
        then 'EMOM'
      when lower(trim(coalesce(execution_mode, ''))) like '%amrap%'
        or lower(trim(coalesce(type, ''))) like '%amrap%'
        then 'AMRAP'
      when lower(trim(coalesce(execution_mode, ''))) like '%circuit%'
        or lower(trim(coalesce(type, ''))) like '%circuit%'
        then 'Circuit'
      when lower(trim(coalesce(execution_mode, ''))) in ('classique', 'classic', 'superset')
        or lower(trim(coalesce(type, ''))) like '%superset%'
        then 'Superset'
      when trim(coalesce(execution_mode, '')) = ''
        and trim(coalesce(type, '')) = ''
        then 'Superset'
      else 'Superset'
    end as mode
  from public.exercises
) normalized
where e.id = normalized.id
  and e.execution_mode is distinct from normalized.mode;

do $$
declare
  superset_data_type text;
begin
  select c.data_type
    into superset_data_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'exercises'
    and c.column_name = 'superset_id';

  if superset_data_type = 'uuid' then
    execute $sql$
      with ordered as (
        select
          id,
          program_id,
          coalesce("order", 2147483647) as ord,
          execution_mode,
          coalesce(is_section_header, false) as is_section_header,
          superset_id
        from public.exercises
      ),
      marks as (
        select
          *,
          case
            when is_section_header then 1
            when lag(is_section_header) over (partition by program_id order by ord, id) then 1
            when lag(execution_mode) over (partition by program_id order by ord, id) is distinct from execution_mode then 1
            else 0
          end as new_group
        from ordered
      ),
      grouped as (
        select
          *,
          sum(new_group) over (partition by program_id order by ord, id rows unbounded preceding) as grp_no
        from marks
      ),
      targets as (
        select
          id,
          program_id,
          execution_mode,
          grp_no
        from grouped
        where not is_section_header
          and execution_mode in ('Circuit', 'AMRAP', 'EMOM')
          and superset_id is null
      ),
      generated_keys as (
        select
          program_id,
          execution_mode,
          grp_no,
          gen_random_uuid() as gid
        from targets
        group by program_id, execution_mode, grp_no
      ),
      assignment as (
        select
          t.id,
          g.gid
        from targets t
        join generated_keys g
          on g.program_id = t.program_id
         and g.execution_mode = t.execution_mode
         and g.grp_no = t.grp_no
      )
      update public.exercises e
      set superset_id = a.gid
      from assignment a
      where e.id = a.id
        and e.superset_id is null
    $sql$;
  else
    execute $sql$
      with ordered as (
        select
          id,
          program_id,
          coalesce("order", 2147483647) as ord,
          execution_mode,
          coalesce(is_section_header, false) as is_section_header,
          superset_id
        from public.exercises
      ),
      marks as (
        select
          *,
          case
            when is_section_header then 1
            when lag(is_section_header) over (partition by program_id order by ord, id) then 1
            when lag(execution_mode) over (partition by program_id order by ord, id) is distinct from execution_mode then 1
            else 0
          end as new_group
        from ordered
      ),
      grouped as (
        select
          *,
          sum(new_group) over (partition by program_id order by ord, id rows unbounded preceding) as grp_no
        from marks
      ),
      targets as (
        select
          id,
          program_id,
          execution_mode,
          grp_no
        from grouped
        where not is_section_header
          and execution_mode in ('Circuit', 'AMRAP', 'EMOM')
          and (superset_id is null or btrim(superset_id::text) = '')
      ),
      generated_keys as (
        select
          program_id,
          execution_mode,
          grp_no,
          gen_random_uuid()::text as gid
        from targets
        group by program_id, execution_mode, grp_no
      ),
      assignment as (
        select
          t.id,
          g.gid
        from targets t
        join generated_keys g
          on g.program_id = t.program_id
         and g.execution_mode = t.execution_mode
         and g.grp_no = t.grp_no
      )
      update public.exercises e
      set superset_id = a.gid
      from assignment a
      where e.id = a.id
        and (e.superset_id is null or btrim(e.superset_id::text) = '')
    $sql$;
  end if;
end
$$;

commit;

alter table public.exercises add column if not exists set_details jsonb null;
alter table public.workout_logs add column if not exists duration_minutes integer;
