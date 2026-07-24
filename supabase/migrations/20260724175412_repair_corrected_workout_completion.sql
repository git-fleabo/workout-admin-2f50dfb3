begin;

set local statement_timeout = '5s';

drop policy if exists sessions_update_managed on public.sessions;
create policy sessions_update_managed
  on public.sessions
  for update
  to authenticated
  using (app_private.person_is_accessible(person_id))
  with check (app_private.person_is_accessible(person_id));

do $$
declare
  repaired_count integer;
begin
  update public.sessions as session
  set
    activity_type_id = (
      select
        case
          when count(distinct entry.activity_type_id) = 1
            then min(entry.activity_type_id::text)::uuid
          else (
            select activity.id
            from public.activity_types as activity
            where activity.slug = 'mixed-training'
          )
        end
      from public.session_entries as entry
      where entry.session_id = session.id
    ),
    completed = true
  where session.id = '26096f13-436a-423f-88c6-49f13d7b35dc'
    and session.session_date = date '2026-07-24'
    and session.title = 'Workout'
    and session.completed = false
    and exists (
      select 1
      from public.session_entries as entry
      where entry.session_id = session.id
    )
    and not exists (
      select 1
      from public.session_entries as entry
      where entry.session_id = session.id
        and entry.completed is not true
    )
    and exists (
      select 1
      from public.session_entries as entry
      join public.entry_sets as entry_set
        on entry_set.session_entry_id = entry.id
      where entry.session_id = session.id
    )
    and not exists (
      select 1
      from public.session_entries as entry
      join public.entry_sets as entry_set
        on entry_set.session_entry_id = entry.id
      where entry.session_id = session.id
        and entry_set.completed is not true
    );

  get diagnostics repaired_count = row_count;

  if repaired_count > 1 then
    raise exception 'Expected to repair at most one corrected workout, repaired %', repaired_count;
  end if;

  if exists (
    select 1
    from public.sessions as session
    where session.id = '26096f13-436a-423f-88c6-49f13d7b35dc'
      and (
        session.completed is not true
        or session.activity_type_id is null
      )
  ) then
    raise exception 'Corrected workout still lacks completed state or parent activity';
  end if;
end
$$;

commit;
