-- Date-only overrides retain source prescriptions, personal revisions, approved
-- strength targets and the dates of sessions that have already started.
create table public.programme_session_dates (
  assignment_id uuid not null references public.program_assignments(id) on delete cascade,
  program_workout_id uuid not null references public.program_workouts(id) on delete cascade,
  scheduled_on date not null,
  revision integer not null default 1 check (revision > 0),
  primary key (assignment_id, program_workout_id)
);
create index programme_session_dates_workout_idx on public.programme_session_dates(program_workout_id);
alter table public.programme_session_dates enable row level security;
revoke all on public.programme_session_dates from public, anon, authenticated;
grant select, insert, update, delete on public.programme_session_dates to authenticated;
create policy programme_session_dates_access on public.programme_session_dates to authenticated
using (exists (select 1 from public.program_assignments a where a.id=assignment_id and app_private.person_is_accessible(a.person_id)))
with check (exists (select 1 from public.program_assignments a where a.id=assignment_id and app_private.person_is_accessible(a.person_id)));

create function app_private.programme_session_scheduled_date(p_assignment_id uuid,p_workout_id uuid)
returns date language sql stable security invoker set search_path='' as $$
  select coalesce(d.scheduled_on,p.scheduled_on,
    case when w.week_number is null or w.day_number is null then a.started_on
    else a.started_on+(greatest(0,w.week_number-1)*7+greatest(0,w.day_number-1)) end)
  from public.program_assignments a join public.program_workouts w on w.program_id=a.program_id and w.id=p_workout_id
  left join public.personal_programme_sessions p on p.assignment_id=a.id and p.program_workout_id=w.id
  left join public.programme_session_dates d on d.assignment_id=a.id and d.program_workout_id=w.id
  where a.id=p_assignment_id;
$$;
revoke all on function app_private.programme_session_scheduled_date(uuid,uuid) from public,anon;
grant execute on function app_private.programme_session_scheduled_date(uuid,uuid) to authenticated;

create function app_private.guard_programme_session_date() returns trigger
language plpgsql security invoker set search_path='' as $$
declare a public.program_assignments%rowtype; w public.program_workouts%rowtype;
  assignment_id_value uuid; workout_id_value uuid;
begin
  assignment_id_value:=case when tg_op='DELETE' then old.assignment_id else new.assignment_id end;
  workout_id_value:=case when tg_op='DELETE' then old.program_workout_id else new.program_workout_id end;
  if tg_op='UPDATE' and (new.assignment_id<>old.assignment_id or new.program_workout_id<>old.program_workout_id) then
    raise exception 'A session date cannot be moved to a different run.';
  end if;
  select * into a from public.program_assignments where id=assignment_id_value for update;
  -- Permit FK cascade cleanup when the owning run has been deleted.
  if tg_op='DELETE' and a.id is null then return old; end if;
  select * into w from public.program_workouts where id=workout_id_value and program_id=a.program_id;
  if a.id is null or not app_private.person_is_accessible(a.person_id) or a.status not in ('active','paused') or w.id is null
    or app_private.programme_workout_position(w.id)<a.current_workout_index then
    raise exception 'Only remaining sessions in a current programme can be moved.';
  end if;
  if exists(select 1 from public.suggested_workouts s where s.program_assignment_id=a.id and s.program_workout_id=w.id
    and s.status in ('accepted','completed','skipped')) then
    raise exception 'This session has already started, completed or been skipped.';
  end if;
  if tg_op='DELETE' then return old; end if;
  new.revision:=case when tg_op='INSERT' then 1 else old.revision+1 end;
  return new;
end; $$;
revoke all on function app_private.guard_programme_session_date() from public,anon;
grant execute on function app_private.guard_programme_session_date() to authenticated;
create trigger guard_programme_session_date before insert or update or delete on public.programme_session_dates
for each row execute function app_private.guard_programme_session_date();

-- A deliberate date edit in the existing personal editor becomes the new base
-- date; an override must not hide it. Other prescription edits retain the date.
create function app_private.clear_programme_date_after_personal_edit() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.scheduled_on is distinct from old.scheduled_on then
    delete from public.programme_session_dates where assignment_id=new.assignment_id and program_workout_id=new.program_workout_id;
  end if;
  return new;
end; $$;
revoke all on function app_private.clear_programme_date_after_personal_edit() from public,anon;
grant execute on function app_private.clear_programme_date_after_personal_edit() to authenticated;
create trigger clear_programme_date_after_personal_edit after update of scheduled_on on public.personal_programme_sessions
for each row execute function app_private.clear_programme_date_after_personal_edit();

-- Serialize starts (including native starts through REST) with a date shift.
create function app_private.lock_programme_schedule_for_suggestion() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.program_assignment_id is not null and new.program_workout_id is not null then
    perform 1 from public.program_assignments where id=new.program_assignment_id for update;
  end if;
  return new;
end; $$;
revoke all on function app_private.lock_programme_schedule_for_suggestion() from public,anon;
grant execute on function app_private.lock_programme_schedule_for_suggestion() to authenticated;
create trigger lock_programme_schedule_for_suggestion before insert or update on public.suggested_workouts
for each row execute function app_private.lock_programme_schedule_for_suggestion();

create function public.reschedule_programme_sessions(
  p_assignment_id uuid, p_current_workout_index integer, p_anchor_workout_id uuid,
  p_new_date date, p_snapshot jsonb, p_clashes jsonb default '[]'::jsonb, p_allow_earlier boolean default false
) returns integer language plpgsql security invoker set search_path='' as $$
declare a public.program_assignments%rowtype; w record; item jsonb; old_date date; shift_days integer;
  locked boolean; dates date[]:='{}'; changes jsonb:='[]'; actual_clashes jsonb:='[]'; clash record;
  previous_date date; resulting_date date; n integer:=0; expected_count integer;
begin
  select * into a from public.program_assignments where id=p_assignment_id for update;
  if a.id is null or not app_private.person_is_accessible(a.person_id) then raise exception 'Programme not found.'; end if;
  if a.status<>'active' or a.current_workout_index is distinct from p_current_workout_index then
    raise exception 'Your programme moved on. Reopen the date preview.';
  end if;
  if app_private.programme_workout_position(p_anchor_workout_id) is distinct from a.current_workout_index
    or not exists(select 1 from public.program_workouts where id=p_anchor_workout_id and program_id=a.program_id) then
    raise exception 'Move the next programme session first.';
  end if;
  if p_snapshot is null or jsonb_typeof(p_snapshot)<>'array' or jsonb_array_length(p_snapshot)=0
    or jsonb_array_length(p_snapshot)>500 or p_clashes is null or jsonb_typeof(p_clashes)<>'array' then
    raise exception 'Invalid date preview.';
  end if;
  select count(*) into expected_count from public.program_workouts x where x.program_id=a.program_id
    and app_private.programme_workout_position(x.id)>=a.current_workout_index;
  if expected_count<>jsonb_array_length(p_snapshot)
    or (select count(distinct x->>'workoutId') from jsonb_array_elements(p_snapshot) x)<>expected_count then
    raise exception 'The remaining sessions changed. Reopen the date preview.';
  end if;
  old_date:=app_private.programme_session_scheduled_date(a.id,p_anchor_workout_id);
  select x into item from jsonb_array_elements(p_snapshot) x where x->>'workoutId'=p_anchor_workout_id::text;
  if item is null or (item->>'date')::date is distinct from old_date then
    raise exception 'A session changed or started. Reopen the date preview.';
  end if;
  shift_days:=p_new_date-old_date;
  if old_date is null or p_new_date is null or (shift_days=0 or (shift_days<0 and not p_allow_earlier)) or extract(year from p_new_date)>9999 then
    raise exception 'Choose a later valid date for the next session.';
  end if;
  for w in select x.*,p.revision as personal_revision,coalesce(d.revision,0) as schedule_revision
    from public.program_workouts x left join public.personal_programme_sessions p on p.assignment_id=a.id and p.program_workout_id=x.id
    left join public.programme_session_dates d on d.assignment_id=a.id and d.program_workout_id=x.id
    where x.program_id=a.program_id and app_private.programme_workout_position(x.id)>=a.current_workout_index
    order by x.sequence_index,x.id
  loop
    select x into item from jsonb_array_elements(p_snapshot) x where x->>'workoutId'=w.id::text;
    old_date:=app_private.programme_session_scheduled_date(a.id,w.id);
    locked:=exists(select 1 from public.suggested_workouts s where s.program_assignment_id=a.id and s.program_workout_id=w.id
      and s.status in ('accepted','completed','skipped'));
    if old_date is null or item is null or (item->>'date')::date is distinct from old_date
      or (item->>'scheduleRevision')::integer is distinct from w.schedule_revision
      or (item->>'personalRevision')::integer is distinct from w.personal_revision
      or (item->>'locked')::boolean is distinct from locked then
      raise exception 'A session changed or started. Reopen the date preview.';
    end if;
    if locked and w.id=p_anchor_workout_id then raise exception 'The next session has already started.'; end if;
    resulting_date:=case when locked then old_date else old_date+shift_days end;
    if extract(year from resulting_date)>9999 or (previous_date is not null and resulting_date<previous_date) then
      raise exception 'These dates would change the session order around a fixed session.';
    end if;
    previous_date:=resulting_date;
    if not locked then
      changes:=changes||jsonb_build_array(jsonb_build_object('workoutId',w.id,'date',resulting_date));
      dates:=array_append(dates,resulting_date);
    end if;
  end loop;
  -- Recheck planned clashes at Apply; a newly scheduled workout invalidates the preview.
  for clash in
    select s.id::text as id,s.suggested_for as day from public.suggested_workouts s
      where s.person_id=a.person_id and s.program_workout_id is null and s.status in ('pending','accepted') and s.suggested_for=any(dates)
    union all
    select other.id::text||':'||x.id::text,app_private.programme_session_scheduled_date(other.id,x.id)
      from public.program_assignments other join public.program_workouts x on x.program_id=other.program_id
      where other.person_id=a.person_id and other.status='active' and other.id<>a.id
        and app_private.programme_session_scheduled_date(other.id,x.id)=any(dates)
  loop
    for item in select x from jsonb_array_elements(changes) x where (x->>'date')::date=clash.day loop
      actual_clashes:=actual_clashes||jsonb_build_array(jsonb_build_object('id',clash.id,'date',clash.day,'workoutId',item->>'workoutId'));
    end loop;
  end loop;
  if jsonb_array_length(actual_clashes)<>jsonb_array_length(p_clashes) or exists(
    select 1 from jsonb_array_elements(actual_clashes) actual where not exists(
      select 1 from jsonb_array_elements(p_clashes) expected where expected=actual
    )) then raise exception 'Other planned training changed. Recheck the date preview.'; end if;
  for item in select x from jsonb_array_elements(changes) x loop
    insert into public.programme_session_dates(assignment_id,program_workout_id,scheduled_on)
      values(a.id,(item->>'workoutId')::uuid,(item->>'date')::date)
    on conflict(assignment_id,program_workout_id) do update set scheduled_on=excluded.scheduled_on;
    update public.suggested_workouts set suggested_for=(item->>'date')::date
      where program_assignment_id=a.id and program_workout_id=(item->>'workoutId')::uuid and status='pending';
    n:=n+1;
  end loop;
  return n;
end; $$;
revoke all on function public.reschedule_programme_sessions(uuid,integer,uuid,date,jsonb,jsonb,boolean) from public,anon;
grant execute on function public.reschedule_programme_sessions(uuid,integer,uuid,date,jsonb,jsonb,boolean) to authenticated;

notify pgrst, 'reload schema';
