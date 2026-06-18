-- Reusable percentage-based programme template.
-- This is intentionally data-only: it does not change logging UI or existing logs.

with existing as (
  select id
  from public.programs
  where name = 'Operator Style Strength Block'
  order by created_at
  limit 1
),
inserted as (
  insert into public.programs (
    name,
    description,
    is_template,
    method_type,
    duration_weeks,
    sessions_per_week,
    default_set_choice,
    percent_base,
    rounding_increment
  )
  select
    'Operator Style Strength Block',
    'Six-week, three-days-per-week percentage strength template with three main lift slots per session.',
    true,
    'percentage_strength',
    6,
    3,
    'minimum',
    'training_max',
    2.5
  where not exists (select 1 from existing)
  returning id
),
target_program as (
  select id from inserted
  union all
  select id from existing
  limit 1
)
update public.programs p
set description = 'Six-week, three-days-per-week percentage strength template with three main lift slots per session.',
    is_template = true,
    method_type = 'percentage_strength',
    duration_weeks = 6,
    sessions_per_week = 3,
    default_set_choice = 'minimum',
    percent_base = 'training_max',
    rounding_increment = 2.5,
    updated_at = now()
from target_program
where p.id = target_program.id;

with target_program as (
  select id
  from public.programs
  where name = 'Operator Style Strength Block'
  order by created_at
  limit 1
),
workout_plan as (
  select
    week_number,
    session_number,
    case session_number
      when 1 then 1
      when 2 then 3
      when 3 then 5
    end as day_number,
    ((week_number - 1) * 3 + session_number) as sequence_index
  from generate_series(1, 6) as week_number
  cross join generate_series(1, 3) as session_number
)
insert into public.program_workouts (
  program_id,
  name,
  sequence_index,
  week_number,
  day_number,
  session_number
)
select
  target_program.id,
  'Week ' || workout_plan.week_number || ' Session ' || workout_plan.session_number,
  workout_plan.sequence_index,
  workout_plan.week_number,
  workout_plan.day_number,
  workout_plan.session_number
from target_program
cross join workout_plan
on conflict (program_id, sequence_index) do update
set name = excluded.name,
    week_number = excluded.week_number,
    day_number = excluded.day_number,
    session_number = excluded.session_number,
    updated_at = now();

with target_program as (
  select id
  from public.programs
  where name = 'Operator Style Strength Block'
  order by created_at
  limit 1
),
prescription as (
  select *
  from (
    values
      (1, 3, 5, 5, 5, 70::numeric),
      (2, 3, 5, 5, 5, 80::numeric),
      (3, 3, 4, 3, 3, 90::numeric),
      (4, 3, 5, 5, 5, 75::numeric),
      (5, 3, 5, 3, 3, 85::numeric),
      (6, 3, 4, 1, 2, 95::numeric)
  ) as p(week_number, min_sets, max_sets, min_reps, max_reps, intensity_percent)
),
slots as (
  select *
  from (
    values
      ('main_lift_1', 'Main Lift 1', 1),
      ('main_lift_2', 'Main Lift 2', 2),
      ('main_lift_3', 'Main Lift 3', 3)
  ) as s(slot_key, name, order_index)
),
desired as (
  select
    pw.id as program_workout_id,
    slots.slot_key,
    slots.name,
    slots.order_index,
    prescription.min_sets,
    prescription.max_sets,
    prescription.min_reps,
    prescription.max_reps,
    prescription.intensity_percent
  from target_program
  join public.program_workouts pw on pw.program_id = target_program.id
  join prescription on prescription.week_number = pw.week_number
  cross join slots
)
update public.program_workout_entries e
set name = desired.name,
    order_index = desired.order_index,
    min_sets = desired.min_sets,
    max_sets = desired.max_sets,
    min_reps = desired.min_reps,
    max_reps = desired.max_reps,
    intensity_percent = desired.intensity_percent,
    percent_base = 'training_max',
    rounding_increment = 2.5,
    updated_at = now()
from desired
where e.program_workout_id = desired.program_workout_id
  and e.slot_key = desired.slot_key;

with target_program as (
  select id
  from public.programs
  where name = 'Operator Style Strength Block'
  order by created_at
  limit 1
),
prescription as (
  select *
  from (
    values
      (1, 3, 5, 5, 5, 70::numeric),
      (2, 3, 5, 5, 5, 80::numeric),
      (3, 3, 4, 3, 3, 90::numeric),
      (4, 3, 5, 5, 5, 75::numeric),
      (5, 3, 5, 3, 3, 85::numeric),
      (6, 3, 4, 1, 2, 95::numeric)
  ) as p(week_number, min_sets, max_sets, min_reps, max_reps, intensity_percent)
),
slots as (
  select *
  from (
    values
      ('main_lift_1', 'Main Lift 1', 1),
      ('main_lift_2', 'Main Lift 2', 2),
      ('main_lift_3', 'Main Lift 3', 3)
  ) as s(slot_key, name, order_index)
),
desired as (
  select
    pw.id as program_workout_id,
    slots.slot_key,
    slots.name,
    slots.order_index,
    prescription.min_sets,
    prescription.max_sets,
    prescription.min_reps,
    prescription.max_reps,
    prescription.intensity_percent
  from target_program
  join public.program_workouts pw on pw.program_id = target_program.id
  join prescription on prescription.week_number = pw.week_number
  cross join slots
)
insert into public.program_workout_entries (
  program_workout_id,
  slot_key,
  name,
  order_index,
  min_sets,
  max_sets,
  min_reps,
  max_reps,
  intensity_percent,
  percent_base,
  rounding_increment
)
select
  desired.program_workout_id,
  desired.slot_key,
  desired.name,
  desired.order_index,
  desired.min_sets,
  desired.max_sets,
  desired.min_reps,
  desired.max_reps,
  desired.intensity_percent,
  'training_max',
  2.5
from desired
where not exists (
  select 1
  from public.program_workout_entries e
  where e.program_workout_id = desired.program_workout_id
    and e.slot_key = desired.slot_key
);
