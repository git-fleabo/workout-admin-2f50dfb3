-- One person has one current programme. Previous runs remain available for review.
create unique index if not exists program_assignments_one_active_per_person_uidx
  on public.program_assignments (person_id)
  where status = 'active';

create or replace function public.change_programme_run(
  p_assignment_id uuid,
  p_action text,
  p_started_on date default current_date
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source public.program_assignments%rowtype;
  next_id uuid;
begin
  if p_action is null or p_action not in ('restart', 'end') then
    raise exception 'Choose restart or end.';
  end if;

  select assignment.* into source
  from public.program_assignments assignment
  where assignment.id = p_assignment_id
  for update;

  if not found or source.status <> 'active' then
    raise exception 'The active programme could not be found.';
  end if;

  if p_action = 'restart' and p_started_on is null then
    raise exception 'Choose a start date for the new run.';
  end if;

  update public.suggested_workouts
  set status = 'archived'
  where program_assignment_id = source.id
    and status in ('pending', 'accepted');

  update public.program_assignments
  set status = 'archived'
  where id = source.id;

  if p_action = 'end' then
    return source.id;
  end if;

  insert into public.program_assignments (
    program_id, person_id, assigned_by_person_id, status,
    current_workout_index, started_on, cycle_number,
    previous_assignment_id, notes
  ) values (
    source.program_id, source.person_id, source.assigned_by_person_id, 'active',
    0, p_started_on, source.cycle_number + 1,
    source.id, source.notes
  ) returning id into next_id;

  insert into public.program_assignment_exercises (
    program_assignment_id, slot_key, exercise_id, exercise_name,
    training_max, is_enabled, load_adjustment_percent,
    manual_adjustment_percent, last_decision
  )
  select next_id, slot_key, exercise_id, exercise_name,
         training_max, is_enabled, 0, 0, null
  from public.program_assignment_exercises
  where program_assignment_id = source.id;

  insert into public.program_assignment_exercise_pools (
    program_assignment_id, role, exercise_id, exercise_name, is_enabled
  )
  select next_id, role, exercise_id, exercise_name, is_enabled
  from public.program_assignment_exercise_pools
  where program_assignment_id = source.id;

  return next_id;
end;
$$;

revoke all on function public.change_programme_run(uuid, text, date) from public;
revoke all on function public.change_programme_run(uuid, text, date) from anon;
grant execute on function public.change_programme_run(uuid, text, date) to authenticated;
