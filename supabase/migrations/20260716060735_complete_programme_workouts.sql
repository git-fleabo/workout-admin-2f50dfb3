create or replace function public.complete_suggested_workout(
  p_workout_id uuid,
  p_session_id uuid
)
returns table (
  program_assignment_id uuid,
  current_workout_index integer,
  assignment_status text
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  workout_row public.suggested_workouts%rowtype;
  assignment_row public.program_assignments%rowtype;
  expected_workout_id uuid;
  total_workouts integer;
  next_workout_index integer;
begin
  select workout.*
  into workout_row
  from public.suggested_workouts workout
  where workout.id = p_workout_id
  for update;

  if not found then
    raise exception 'The workout plan could not be found.';
  end if;

  if not exists (
    select 1
    from public.sessions session
    where session.id = p_session_id
      and session.person_id = workout_row.person_id
      and session.completed = true
  ) then
    raise exception 'The completed session does not match this workout plan.';
  end if;

  if workout_row.status = 'completed' then
    if workout_row.completed_session_id is distinct from p_session_id then
      raise exception 'This workout plan is already linked to another completed session.';
    end if;
  elsif workout_row.status in ('pending', 'accepted') then
    update public.suggested_workouts
    set status = 'completed',
        completed_session_id = p_session_id
    where id = workout_row.id;
  else
    raise exception 'Only a pending or accepted workout plan can be completed.';
  end if;

  if workout_row.program_assignment_id is null then
    return query select null::uuid, null::integer, null::text;
    return;
  end if;

  select assignment.*
  into assignment_row
  from public.program_assignments assignment
  where assignment.id = workout_row.program_assignment_id
  for update;

  if not found then
    raise exception 'The linked programme assignment could not be found.';
  end if;

  if workout_row.status <> 'completed' then
    select programme_workout.id
    into expected_workout_id
    from public.program_workouts programme_workout
    where programme_workout.program_id = assignment_row.program_id
    order by programme_workout.sequence_index, programme_workout.id
    offset assignment_row.current_workout_index
    limit 1;

    if expected_workout_id is distinct from workout_row.program_workout_id then
      raise exception 'This is not the assignment''s current programme session.';
    end if;

    select count(*)::integer
    into total_workouts
    from public.program_workouts programme_workout
    where programme_workout.program_id = assignment_row.program_id;

    next_workout_index := assignment_row.current_workout_index + 1;

    update public.program_assignments
    set current_workout_index = next_workout_index,
        status = case when next_workout_index >= total_workouts then 'complete' else status end,
        completed_on = case when next_workout_index >= total_workouts then current_date else null end
    where id = assignment_row.id
    returning * into assignment_row;
  end if;

  return query
  select assignment_row.id, assignment_row.current_workout_index, assignment_row.status;
end;
$$;

revoke all on function public.complete_suggested_workout(uuid, uuid) from public;
revoke all on function public.complete_suggested_workout(uuid, uuid) from anon;
grant execute on function public.complete_suggested_workout(uuid, uuid) to authenticated;

create unique index if not exists suggested_workouts_open_programme_session_uidx
  on public.suggested_workouts (program_assignment_id, program_workout_id)
  where program_assignment_id is not null
    and program_workout_id is not null
    and status in ('pending', 'accepted');
