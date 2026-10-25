-- Rest is calendar intent, never a completed or skipped workout.
create table public.training_rest_days (
  person_id uuid not null references public.people(id) on delete cascade,
  rest_date date not null,
  date_changes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  primary key (person_id, rest_date)
);
alter table public.training_rest_days enable row level security;
revoke all on public.training_rest_days from public, anon;
grant select, insert, update, delete on public.training_rest_days to authenticated;
create policy training_rest_days_access on public.training_rest_days to authenticated
  using (app_private.person_is_accessible(person_id))
  with check (app_private.person_is_accessible(person_id));

-- Read the schedule and move dates in one transaction. Repeated clicks are
-- idempotent. Existing programme guards serialize starts against these writes.
create function public.set_training_rest_day(
  p_person_id uuid, p_date date, p_rest boolean, p_restore_dates boolean default true
) returns integer language plpgsql security invoker set search_path='' as $$
declare
  a record; w record; s record; change jsonb; changes jsonb := '[]';
  old_date date; new_date date; next_date date; previous_date date;
  shift_days integer; schedule_revision integer; moved integer := 0;
  today date := (now() at time zone 'Europe/London')::date;
begin
  if auth.uid() is null or not app_private.person_is_accessible(p_person_id) then
    raise exception 'Profile not found.';
  end if;
  if p_date is null or not isfinite(p_date) or extract(year from p_date) not between 1 and 9998
    or p_rest is null then raise exception 'Choose a valid rest date.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_person_id::text, 1025));
  perform 1 from public.program_assignments where person_id=p_person_id
    and status in ('active','paused') order by id for update;
  perform 1 from public.suggested_workouts where person_id=p_person_id order by id for update;

  if not p_rest then
    select date_changes into changes from public.training_rest_days
      where person_id=p_person_id and rest_date=p_date for update;
    if not found then return 0; end if;
    if p_restore_dates then
      for change in select value from jsonb_array_elements(changes) loop
        if change->>'kind'='programme' then
          if not exists(select 1 from public.programme_session_dates d
            join public.program_assignments pa on pa.id=d.assignment_id
            where d.assignment_id=(change->>'assignmentId')::uuid
              and d.program_workout_id=(change->>'workoutId')::uuid
              and pa.person_id=p_person_id and pa.status in ('active','paused')
              and app_private.programme_workout_position(d.program_workout_id)>=pa.current_workout_index
              and d.scheduled_on=(change->>'newDate')::date
              and d.revision=(change->>'revision')::integer)
            or exists(select 1 from public.suggested_workouts sw
              where sw.program_assignment_id=(change->>'assignmentId')::uuid
                and sw.program_workout_id=(change->>'workoutId')::uuid
                and (sw.status in ('accepted','completed','skipped') or sw.completed_session_id is not null))
            or exists(select 1 from public.training_rest_days rd where rd.person_id=p_person_id
              and rd.rest_date=(change->>'oldDate')::date and rd.rest_date<>p_date) then
            raise exception 'A moved workout changed or started. Remove the rest label without restoring dates instead.';
          end if;
          update public.programme_session_dates set scheduled_on=(change->>'oldDate')::date
            where assignment_id=(change->>'assignmentId')::uuid
              and program_workout_id=(change->>'workoutId')::uuid;
          update public.suggested_workouts set suggested_for=(change->>'oldDate')::date
            where program_assignment_id=(change->>'assignmentId')::uuid
              and program_workout_id=(change->>'workoutId')::uuid and status='pending';
        else
          if not exists(select 1 from public.suggested_workouts sw where sw.id=(change->>'id')::uuid
            and sw.person_id=p_person_id and sw.status='pending' and sw.completed_session_id is null
            and sw.suggested_for=(change->>'newDate')::date)
            or exists(select 1 from public.training_rest_days rd where rd.person_id=p_person_id
              and rd.rest_date=(change->>'oldDate')::date and rd.rest_date<>p_date) then
            raise exception 'A moved workout changed or started. Remove the rest label without restoring dates instead.';
          end if;
          update public.suggested_workouts set suggested_for=(change->>'oldDate')::date
            where id=(change->>'id')::uuid and person_id=p_person_id;
        end if;
        moved := moved+1;
      end loop;
    end if;
    delete from public.training_rest_days where person_id=p_person_id and rest_date=p_date;
    return moved;
  end if;

  if exists(select 1 from public.training_rest_days where person_id=p_person_id and rest_date=p_date)
    then return 0; end if;
  insert into public.training_rest_days(person_id,rest_date) values(p_person_id,p_date);
  for a in select * from public.program_assignments where person_id=p_person_id
    and status in ('active','paused') order by id loop
    -- The first unstarted session on the rest date anchors the shift. A future
    -- rest date must not move sessions before it, nor change the current index.
    shift_days := null;
    previous_date := null;
    for w in select pw.*,app_private.programme_workout_position(pw.id) as position
      from public.program_workouts pw where pw.program_id=a.program_id
        and app_private.programme_workout_position(pw.id)>=a.current_workout_index
      order by position,pw.id loop
      old_date := app_private.programme_session_scheduled_date(a.id,w.id);
      if old_date is null then continue; end if;
      if exists(select 1 from public.suggested_workouts sw
        where sw.program_assignment_id=a.id and sw.program_workout_id=w.id
          and (sw.status in ('accepted','completed','skipped') or sw.completed_session_id is not null)) then
        if previous_date is not null and old_date<previous_date then
          raise exception 'Moving these dates would overtake a started session. Finish that session first.';
        end if;
        previous_date := old_date;
        continue;
      end if;
      if shift_days is null and old_date=p_date then
        select min(app_private.programme_session_scheduled_date(a.id,pw.id)) into next_date
          from public.program_workouts pw where pw.program_id=a.program_id
          and app_private.programme_workout_position(pw.id)>w.position
          and app_private.programme_session_scheduled_date(a.id,pw.id)>p_date
          and app_private.programme_session_scheduled_date(a.id,pw.id)>=today;
        next_date := coalesce(next_date,greatest(p_date+1,today));
        shift_days := next_date-old_date;
      end if;
      if shift_days is null then previous_date := old_date; continue; end if;
      new_date := old_date+shift_days;
      while exists(select 1 from public.training_rest_days where person_id=p_person_id and rest_date=new_date) loop
        new_date := new_date+1;
        shift_days := shift_days+1;
      end loop;
      if previous_date is not null and new_date<previous_date then
        raise exception 'These dates would change programme order. Review the programme dates first.';
      end if;
      insert into public.programme_session_dates(assignment_id,program_workout_id,scheduled_on)
        values(a.id,w.id,new_date) on conflict(assignment_id,program_workout_id)
        do update set scheduled_on=excluded.scheduled_on returning revision into schedule_revision;
      update public.suggested_workouts set suggested_for=new_date
        where program_assignment_id=a.id and program_workout_id=w.id and status='pending';
      changes := changes || jsonb_build_array(jsonb_build_object('kind','programme',
        'assignmentId',a.id,'workoutId',w.id,'oldDate',old_date,'newDate',new_date,'revision',schedule_revision));
      previous_date := new_date;
      moved := moved+1;
    end loop;
  end loop;

  -- Individually planned sessions move to the next available date. Multiple
  -- sessions originally on one day stay together, including support work.
  next_date := greatest(p_date+1,today);
  while exists(select 1 from public.training_rest_days where person_id=p_person_id and rest_date=next_date) loop
    next_date := next_date+1;
  end loop;
  for s in select * from public.suggested_workouts where person_id=p_person_id
    and suggested_for=p_date and status='pending' and completed_session_id is null
    and program_workout_id is null order by id loop
    update public.suggested_workouts set suggested_for=next_date where id=s.id;
    changes := changes || jsonb_build_array(jsonb_build_object('kind','saved',
      'id',s.id,'oldDate',p_date,'newDate',next_date));
    moved := moved+1;
  end loop;
  update public.training_rest_days set date_changes=changes where person_id=p_person_id and rest_date=p_date;
  return moved;
end; $$;
revoke all on function public.set_training_rest_day(uuid,date,boolean,boolean) from public,anon;
grant execute on function public.set_training_rest_day(uuid,date,boolean,boolean) to authenticated;
notify pgrst, 'reload schema';
