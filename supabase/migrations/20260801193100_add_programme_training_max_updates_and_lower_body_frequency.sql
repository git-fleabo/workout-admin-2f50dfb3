create or replace function public.apply_programme_exercise_updates(
  p_assignment_id uuid,
  p_updates jsonb
)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  update_item jsonb;
  exercise_id_value uuid;
  training_max_value numeric;
  adjustment_value numeric;
  affected_rows integer;
  updated_count integer := 0;
begin
  if jsonb_typeof(p_updates) <> 'array' or jsonb_array_length(p_updates) = 0 then
    raise exception 'At least one programme exercise update is required.';
  end if;

  if not exists (
    select 1
    from public.program_assignments assignment
    where assignment.id = p_assignment_id
      and assignment.status in ('active', 'paused')
  ) then
    raise exception 'The active or paused programme assignment was not found.';
  end if;

  for update_item in
    select value from jsonb_array_elements(p_updates)
  loop
    exercise_id_value := nullif(update_item ->> 'exercise_id', '')::uuid;
    training_max_value := nullif(update_item ->> 'training_max', '')::numeric;
    adjustment_value := nullif(update_item ->> 'manual_adjustment_percent', '')::numeric;

    if exercise_id_value is null then
      raise exception 'Every programme exercise update requires an exercise id.';
    end if;
    if training_max_value is null or training_max_value < 0.5 or training_max_value > 1000 then
      raise exception 'Training maxes must be between 0.5 and 1000 kg.';
    end if;
    if adjustment_value is null or adjustment_value not in (-5, -2.5, 0, 2.5, 5) then
      raise exception 'Programme adjustments must use a supported 2.5-point step.';
    end if;

    update public.program_assignment_exercises exercise
    set training_max = training_max_value,
        manual_adjustment_percent = adjustment_value,
        manual_adjusted_at = case when adjustment_value = 0 then null else now() end,
        updated_at = now()
    where exercise.id = exercise_id_value
      and exercise.program_assignment_id = p_assignment_id;

    get diagnostics affected_rows = row_count;
    if affected_rows <> 1 then
      raise exception 'A programme exercise could not be updated.';
    end if;
    updated_count := updated_count + affected_rows;
  end loop;

  return updated_count;
end;
$$;

revoke all on function public.apply_programme_exercise_updates(uuid, jsonb) from public;
revoke all on function public.apply_programme_exercise_updates(uuid, jsonb) from anon;
grant execute on function public.apply_programme_exercise_updates(uuid, jsonb) to authenticated;

-- Keep Friday readable after adding a second lower-body exposure.
with target_program as (
  select id
  from public.programs
  where name = 'Adaptive Strength 12-Week Block'
    and method_type = 'adaptive_strength_12_week'
)
update public.program_workout_entries entry
set order_index = case
      when entry.slot_key = 'weighted_pull_up' then 4
      when entry.selection_role = 'pull' then 5
      else entry.order_index
    end,
    updated_at = now()
from public.program_workouts workout, target_program
where entry.program_workout_id = workout.id
  and workout.program_id = target_program.id
  and workout.session_number = 3
  and (entry.slot_key = 'weighted_pull_up' or entry.selection_role = 'pull');

with target_program as (
  select id
  from public.programs
  where name = 'Adaptive Strength 12-Week Block'
    and method_type = 'adaptive_strength_12_week'
),
wave as (
  select *
  from (values
    (1,  80::numeric, 5, 8.0::numeric),
    (2,  82.5,        5, 8.0),
    (3,  90,          3, 8.5),
    (4,  80,          5, 8.0),
    (5,  82.5,        5, 8.0),
    (6,  90,          3, 8.5),
    (7,  80,          5, 8.0),
    (8,  85,          5, 8.5),
    (9,  90,          3, 8.5),
    (10, 80,          5, 8.0),
    (11, 85,          5, 8.5),
    (12, 90,          3, 8.5)
  ) as values_table(week_number, base_percent, reps, rpe_cap)
),
friday_workouts as (
  select workout.id, workout.week_number
  from public.program_workouts workout
  join target_program on target_program.id = workout.program_id
  where workout.session_number = 3
)
insert into public.program_workout_entries (
  program_workout_id,
  name,
  slot_key,
  order_index,
  sets,
  reps,
  min_sets,
  max_sets,
  min_reps,
  max_reps,
  intensity_percent,
  intensity_min_percent,
  intensity_max_percent,
  percent_base,
  rounding_increment,
  rpe,
  rpe_cap,
  rest,
  is_optional,
  notes
)
select
  friday_workouts.id,
  case when friday_workouts.week_number % 2 = 1
    then 'High Bar Squat · second exposure'
    else 'Deadlift · second exposure'
  end,
  case when friday_workouts.week_number % 2 = 1 then 'high_bar_squat' else 'deadlift' end,
  3,
  '3',
  wave.reps::text,
  3,
  3,
  wave.reps,
  wave.reps,
  wave.base_percent,
  wave.base_percent,
  least(95::numeric, wave.base_percent + 5),
  'training_max',
  2.5,
  'Cap ' || wave.rpe_cap::text,
  wave.rpe_cap,
  case when wave.reps = 3 then '4-5 min' else '3-5 min' end,
  false,
  case when friday_workouts.week_number % 2 = 1
    then 'Second squat exposure this week. Keep all three sets crisp and stop below the cap if depth, position, or bar speed changes.'
    else 'Second deadlift exposure this week. Keep all three sets crisp; no grinders and no extra work beyond the prescription.'
  end
from friday_workouts
join wave using (week_number)
where not exists (
  select 1
  from public.program_workout_entries existing
  where existing.program_workout_id = friday_workouts.id
    and existing.slot_key = case
      when friday_workouts.week_number % 2 = 1 then 'high_bar_squat'
      else 'deadlift'
    end
);

with target_program as (
  select id
  from public.programs
  where name = 'Adaptive Strength 12-Week Block'
    and method_type = 'adaptive_strength_12_week'
)
update public.program_workouts workout
set description = workout.description || case
      when workout.week_number % 2 = 1 then ' Friday adds the second squat exposure.'
      else ' Friday adds the second deadlift exposure.'
    end,
    updated_at = now()
from target_program
where workout.program_id = target_program.id
  and workout.session_number = 3
  and workout.description not like '%second squat exposure%'
  and workout.description not like '%second deadlift exposure%';
