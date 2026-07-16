-- Reusable percentage-based programme templates.
-- This is intentionally data-only: it does not change logging UI or existing logs.

alter table public.program_workout_entries
  add column if not exists is_optional boolean default false;

with desired_programs as (
  select *
  from (
    values
      (
        'Operator Style Strength Block',
        'Six-week, three-days-per-week percentage strength template with one required lift and two optional lifts per session.',
        6,
        3
      ),
      (
        'Fighter Style Strength Block',
        'Six-week, two-days-per-week percentage strength template with one required lift and three optional lifts per session.',
        6,
        2
      )
  ) as p(name, description, duration_weeks, sessions_per_week)
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
    name,
    description,
    true,
    'percentage_strength',
    duration_weeks,
    sessions_per_week,
    'minimum',
    'training_max',
    2.5
  from desired_programs
  where not exists (
    select 1
    from public.programs existing
    where existing.name = desired_programs.name
  )
  returning id
)
update public.programs p
set description = desired_programs.description,
    is_template = true,
    method_type = 'percentage_strength',
    duration_weeks = desired_programs.duration_weeks,
    sessions_per_week = desired_programs.sessions_per_week,
    default_set_choice = 'minimum',
    percent_base = 'training_max',
    rounding_increment = 2.5,
    updated_at = now()
from desired_programs
where p.name = desired_programs.name;

with target_programs as (
  select id, name
  from public.programs
  where name in ('Operator Style Strength Block', 'Fighter Style Strength Block')
),
workout_plan as (
  select
    'Operator Style Strength Block' as program_name,
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

  union all

  select
    'Fighter Style Strength Block' as program_name,
    week_number,
    session_number,
    case session_number
      when 1 then 1
      when 2 then 4
    end as day_number,
    ((week_number - 1) * 2 + session_number) as sequence_index
  from generate_series(1, 6) as week_number
  cross join generate_series(1, 2) as session_number
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
  target_programs.id,
  'Week ' || workout_plan.week_number || ' Session ' || workout_plan.session_number,
  workout_plan.sequence_index,
  workout_plan.week_number,
  workout_plan.day_number,
  workout_plan.session_number
from workout_plan
join target_programs on target_programs.name = workout_plan.program_name
on conflict (program_id, sequence_index) do update
set name = excluded.name,
    week_number = excluded.week_number,
    day_number = excluded.day_number,
    session_number = excluded.session_number,
    updated_at = now();

with target_programs as (
  select id, name
  from public.programs
  where name in ('Operator Style Strength Block', 'Fighter Style Strength Block')
),
prescription as (
  select *
  from (
    values
      ('Operator Style Strength Block', 1, 3, 5, 5, 5, 70::numeric),
      ('Operator Style Strength Block', 2, 3, 5, 5, 5, 80::numeric),
      ('Operator Style Strength Block', 3, 3, 4, 3, 3, 90::numeric),
      ('Operator Style Strength Block', 4, 3, 5, 5, 5, 75::numeric),
      ('Operator Style Strength Block', 5, 3, 5, 3, 3, 85::numeric),
      ('Operator Style Strength Block', 6, 3, 4, 1, 2, 95::numeric),
      ('Fighter Style Strength Block', 1, 3, 5, 5, 5, 75::numeric),
      ('Fighter Style Strength Block', 2, 3, 5, 5, 5, 80::numeric),
      ('Fighter Style Strength Block', 3, 3, 5, 3, 3, 90::numeric),
      ('Fighter Style Strength Block', 4, 3, 5, 5, 5, 75::numeric),
      ('Fighter Style Strength Block', 5, 3, 5, 5, 5, 80::numeric),
      ('Fighter Style Strength Block', 6, 3, 5, 3, 3, 90::numeric)
  ) as p(program_name, week_number, min_sets, max_sets, min_reps, max_reps, intensity_percent)
),
slots as (
  select *
  from (
    values
      ('Operator Style Strength Block', 'main_lift_1', 'Main Lift 1', 1, false),
      ('Operator Style Strength Block', 'main_lift_2', 'Main Lift 2', 2, true),
      ('Operator Style Strength Block', 'main_lift_3', 'Main Lift 3', 3, true),
      ('Fighter Style Strength Block', 'main_lift_1', 'Main Lift 1', 1, false),
      ('Fighter Style Strength Block', 'main_lift_2', 'Main Lift 2', 2, true),
      ('Fighter Style Strength Block', 'main_lift_3', 'Main Lift 3', 3, true),
      ('Fighter Style Strength Block', 'main_lift_4', 'Main Lift 4', 4, true)
  ) as s(program_name, slot_key, name, order_index, is_optional)
),
desired as (
  select
    pw.id as program_workout_id,
    slots.slot_key,
    slots.name,
    slots.order_index,
    case
      when slots.slot_key = 'main_lift_4' then 1
      else prescription.min_sets
    end as min_sets,
    case
      when slots.slot_key = 'main_lift_4' then 3
      else prescription.max_sets
    end as max_sets,
    prescription.min_reps,
    prescription.max_reps,
    prescription.intensity_percent,
    slots.is_optional
  from target_programs
  join public.program_workouts pw on pw.program_id = target_programs.id
  join prescription
    on prescription.program_name = target_programs.name
   and prescription.week_number = pw.week_number
  join slots on slots.program_name = target_programs.name
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
    is_optional = desired.is_optional,
    updated_at = now()
from desired
where e.program_workout_id = desired.program_workout_id
  and e.slot_key = desired.slot_key;

with target_programs as (
  select id, name
  from public.programs
  where name in ('Operator Style Strength Block', 'Fighter Style Strength Block')
),
prescription as (
  select *
  from (
    values
      ('Operator Style Strength Block', 1, 3, 5, 5, 5, 70::numeric),
      ('Operator Style Strength Block', 2, 3, 5, 5, 5, 80::numeric),
      ('Operator Style Strength Block', 3, 3, 4, 3, 3, 90::numeric),
      ('Operator Style Strength Block', 4, 3, 5, 5, 5, 75::numeric),
      ('Operator Style Strength Block', 5, 3, 5, 3, 3, 85::numeric),
      ('Operator Style Strength Block', 6, 3, 4, 1, 2, 95::numeric),
      ('Fighter Style Strength Block', 1, 3, 5, 5, 5, 75::numeric),
      ('Fighter Style Strength Block', 2, 3, 5, 5, 5, 80::numeric),
      ('Fighter Style Strength Block', 3, 3, 5, 3, 3, 90::numeric),
      ('Fighter Style Strength Block', 4, 3, 5, 5, 5, 75::numeric),
      ('Fighter Style Strength Block', 5, 3, 5, 5, 5, 80::numeric),
      ('Fighter Style Strength Block', 6, 3, 5, 3, 3, 90::numeric)
  ) as p(program_name, week_number, min_sets, max_sets, min_reps, max_reps, intensity_percent)
),
slots as (
  select *
  from (
    values
      ('Operator Style Strength Block', 'main_lift_1', 'Main Lift 1', 1, false),
      ('Operator Style Strength Block', 'main_lift_2', 'Main Lift 2', 2, true),
      ('Operator Style Strength Block', 'main_lift_3', 'Main Lift 3', 3, true),
      ('Fighter Style Strength Block', 'main_lift_1', 'Main Lift 1', 1, false),
      ('Fighter Style Strength Block', 'main_lift_2', 'Main Lift 2', 2, true),
      ('Fighter Style Strength Block', 'main_lift_3', 'Main Lift 3', 3, true),
      ('Fighter Style Strength Block', 'main_lift_4', 'Main Lift 4', 4, true)
  ) as s(program_name, slot_key, name, order_index, is_optional)
),
desired as (
  select
    pw.id as program_workout_id,
    slots.slot_key,
    slots.name,
    slots.order_index,
    case
      when slots.slot_key = 'main_lift_4' then 1
      else prescription.min_sets
    end as min_sets,
    case
      when slots.slot_key = 'main_lift_4' then 3
      else prescription.max_sets
    end as max_sets,
    prescription.min_reps,
    prescription.max_reps,
    prescription.intensity_percent,
    slots.is_optional
  from target_programs
  join public.program_workouts pw on pw.program_id = target_programs.id
  join prescription
    on prescription.program_name = target_programs.name
   and prescription.week_number = pw.week_number
  join slots on slots.program_name = target_programs.name
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
  rounding_increment,
  is_optional
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
  2.5,
  desired.is_optional
from desired
where not exists (
  select 1
  from public.program_workout_entries e
  where e.program_workout_id = desired.program_workout_id
    and e.slot_key = desired.slot_key
);
