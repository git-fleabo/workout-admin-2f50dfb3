-- Advance only when the person deliberately chooses a later programme session.
-- Skipped sessions remain visible in the run without inventing completed workouts.
create or replace function public.choose_next_programme_session(
  p_assignment_id uuid,
  p_target_workout_id uuid
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  run_row public.program_assignments%rowtype;
  target_row public.program_workouts%rowtype;
  skipped_row public.program_workouts%rowtype;
  target_index integer;
  skipped_count integer := 0;
begin
  select assignment.* into run_row
  from public.program_assignments assignment
  where assignment.id = p_assignment_id
  for update;

  if not found or run_row.status <> 'active' then
    raise exception 'The active programme could not be found.';
  end if;

  select workout.* into target_row
  from public.program_workouts workout
  where workout.id = p_target_workout_id
    and workout.program_id = run_row.program_id;

  if not found then
    raise exception 'Choose a session in this programme.';
  end if;

  select count(*)::integer into target_index
  from public.program_workouts workout
  where workout.program_id = run_row.program_id
    and (workout.sequence_index, workout.id) < (target_row.sequence_index, target_row.id);

  if target_index <= run_row.current_workout_index then
    raise exception 'Choose a later unfinished session.';
  end if;

  if exists (
    select 1
    from public.suggested_workouts planned
    join public.program_workouts workout on workout.id = planned.program_workout_id
    where planned.program_assignment_id = run_row.id
      and workout.sequence_index >= run_row.current_workout_index
      and workout.sequence_index < target_row.sequence_index
      and planned.status = 'accepted'
  ) then
    raise exception 'Finish or discard your started programme workout before skipping ahead.';
  end if;

  for skipped_row in
    select workout.*
    from public.program_workouts workout
    where workout.program_id = run_row.program_id
      and workout.sequence_index >= run_row.current_workout_index
      and workout.sequence_index < target_row.sequence_index
    order by workout.sequence_index
  loop
    if exists (
      select 1 from public.suggested_workouts planned
      where planned.program_assignment_id = run_row.id
        and planned.program_workout_id = skipped_row.id
        and planned.status = 'completed'
    ) then
      raise exception 'A completed session cannot be skipped.';
    end if;

    update public.suggested_workouts planned
    set status = 'skipped'
    where planned.program_assignment_id = run_row.id
      and planned.program_workout_id = skipped_row.id
      and planned.status = 'pending';

    if not found and not exists (
      select 1 from public.suggested_workouts planned
      where planned.program_assignment_id = run_row.id
        and planned.program_workout_id = skipped_row.id
        and planned.status = 'skipped'
    ) then
      insert into public.suggested_workouts (
        person_id, program_assignment_id, program_workout_id, status, title, notes
      ) values (
        run_row.person_id, run_row.id, skipped_row.id, 'skipped', skipped_row.name,
        'Skipped when choosing a later programme session.'
      );
    end if;
    skipped_count := skipped_count + 1;
  end loop;

  update public.program_assignments
  set current_workout_index = target_index
  where id = run_row.id;

  return skipped_count;
end;
$$;

revoke all on function public.choose_next_programme_session(uuid, uuid) from public;
revoke all on function public.choose_next_programme_session(uuid, uuid) from anon;
grant execute on function public.choose_next_programme_session(uuid, uuid) to authenticated;
