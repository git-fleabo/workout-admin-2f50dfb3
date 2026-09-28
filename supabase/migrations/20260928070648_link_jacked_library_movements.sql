-- Replace imported JACKED labels with canonical Library exercises and remove
-- corrective placeholders/sessions from the programme calendar.

begin;

do $$
begin
  if not exists (
    select 1 from public.activity_types where name = 'Strength'
  ) then
    raise exception 'Strength activity type is required before linking JACKED movements';
  end if;
end
$$;

with desired_exercises (
  name,
  focus_area,
  equipment,
  default_metric,
  suggested_sets,
  suggested_reps,
  circuit_pattern,
  circuit_difficulty,
  circuit_impact,
  circuit_dose_per_side
) as (
  values
    ('Alternating Dumbbell Curl', 'Pull', 'Dumbbell', 'weight_reps', '3', '8-15', 'pull', 'beginner', 'low', true),
    ('Alternating Dumbbell Front Raise', 'Push', 'Dumbbell', 'weight_reps', '3', '8-15', 'push', 'beginner', 'low', true),
    ('Alternating Dumbbell UCV Raise', 'Push', 'Dumbbell', 'weight_reps', '3', '8-15', 'push', 'intermediate', 'low', true),
    ('Alternating Dumbbell Reverse Lunge', 'Lower Body', 'Dumbbell', 'weight_reps', '3', '8-12 / side', 'lunge', 'beginner', 'low', true),
    ('Bench Dip', 'Push', 'Bench / Bodyweight', 'reps_only', '3', '8-15', 'push', 'beginner', 'low', false),
    ('Cobra Push-Up', 'Push', 'Bodyweight', 'reps_only', '3', '8-15', 'push', 'intermediate', 'low', false),
    ('Dumbbell Abduction Row', 'Pull', 'Dumbbell', 'weight_reps', '3', '8-15', 'pull', 'intermediate', 'low', true),
    ('Alternating Dumbbell Gorilla Row', 'Pull', 'Dumbbell', 'weight_reps', '3-4', '8-12 / side', 'pull', 'intermediate', 'low', true),
    ('Inverted Chin-Up', 'Pull', 'Pull-up bar / Bodyweight', 'reps_only', '3', '6-12', 'pull', 'intermediate', 'low', false),
    ('Alternating Dumbbell Reverse Sprinter Lunge', 'Lower Body', 'Dumbbell', 'weight_reps', '3', '8-12 / side', 'lunge', 'intermediate', 'low', true),
    ('Alternating Dumbbell Step-Up', 'Lower Body', 'Dumbbell / Bench', 'weight_reps', '3', '8-12 / side', 'lunge', 'intermediate', 'low', true),
    ('Dumbbell Bench Front Squat', 'Lower Body', 'Dumbbell / Bench', 'weight_reps', '3', '8-12', 'squat', 'intermediate', 'low', false),
    ('Dumbbell Cheat Lateral Raise', 'Push', 'Dumbbell', 'weight_reps', '3', '8-15', 'push', 'intermediate', 'low', true),
    ('Dumbbell Cossack Squat', 'Lower Body', 'Dumbbell', 'weight_reps', '3', '6-10 / side', 'squat', 'intermediate', 'low', true),
    ('Dumbbell Cross-Body Hammer Curl', 'Pull', 'Dumbbell', 'weight_reps', '3', '8-15 / side', 'pull', 'beginner', 'low', true),
    ('Close-Grip Inverted Row Hold', 'Pull', 'Pull-up bar / Bodyweight', 'hold', '3', '20-40 sec', 'pull', 'intermediate', 'low', false),
    ('Dumbbell Drag Curl', 'Pull', 'Dumbbell', 'weight_reps', '3', '8-15', 'pull', 'intermediate', 'low', false),
    ('Inverted Chin Curl Hold', 'Pull', 'Pull-up bar / Bodyweight', 'hold', '3', '20-40 sec', 'pull', 'intermediate', 'low', false),
    ('Dumbbell Floor Fly', 'Push', 'Dumbbell', 'weight_reps', '3', '8-15', 'push', 'beginner', 'low', false),
    ('Dumbbell Haney Shrug', 'Pull', 'Dumbbell', 'weight_reps', '3', '8-15', 'pull', 'intermediate', 'low', false),
    ('Inverted Face Pull', 'Pull', 'Pull-up bar / Bodyweight', 'reps_only', '3', '8-15', 'pull', 'intermediate', 'low', false),
    ('Dumbbell High Pull', 'Pull', 'Dumbbell', 'weight_reps', '3', '6-12', 'pull', 'intermediate', 'moderate', false),
    ('Dumbbell JM Press', 'Push', 'Dumbbell / Bench', 'weight_reps', '3', '8-15', 'push', 'intermediate', 'low', false),
    ('Dumbbell Triceps Kickback', 'Push', 'Dumbbell', 'weight_reps', '3', '8-15 / side', 'push', 'beginner', 'low', true),
    ('Dumbbell Leaning Step-Up', 'Lower Body', 'Dumbbell / Bench', 'weight_reps', '3', '8-12 / side', 'lunge', 'intermediate', 'low', true),
    ('Dumbbell No-Money Curl', 'Pull', 'Dumbbell', 'weight_reps', '3', '8-15', 'pull', 'intermediate', 'low', false),
    ('Dumbbell Overhead Press', 'Push', 'Dumbbell', 'weight_reps', '3-4', '6-12', 'push', 'beginner', 'low', false),
    ('Dumbbell Plyometric Step-Up', 'Lower Body', 'Dumbbell / Bench', 'weight_reps', '3', '6-10 / side', 'power', 'advanced', 'high', true),
    ('Dumbbell Power High Pull', 'Full Body', 'Dumbbell', 'weight_reps', '3', '6-10', 'power', 'advanced', 'high', false),
    ('Dumbbell Press-Out', 'Push', 'Dumbbell', 'weight_reps', '3', '8-15', 'push', 'beginner', 'low', false),
    ('Dumbbell Rear-Delt Row', 'Pull', 'Dumbbell', 'weight_reps', '3', '8-15', 'pull', 'intermediate', 'low', false),
    ('Dumbbell Rocket Squat', 'Lower Body', 'Dumbbell', 'weight_reps', '3', '8-15', 'squat', 'intermediate', 'moderate', false),
    ('Dumbbell Single-Leg RDL Calf Raise', 'Lower Body', 'Dumbbell', 'weight_reps', '3', '8-12 / side', 'hinge', 'intermediate', 'low', true),
    ('Dumbbell Spider Curl', 'Pull', 'Dumbbell / Bench', 'weight_reps', '3', '8-15', 'pull', 'intermediate', 'low', false),
    ('Dumbbell Static Creeping Lunge', 'Lower Body', 'Dumbbell', 'weight_reps', '3', '8-12 / side', 'lunge', 'intermediate', 'low', true),
    ('Dumbbell Straight-Bar Curl', 'Pull', 'Dumbbell', 'weight_reps', '3', '8-15', 'pull', 'intermediate', 'low', false),
    ('Dumbbell Swing', 'Full Body', 'Dumbbell', 'weight_reps', '3', '10-20', 'hinge', 'intermediate', 'moderate', false),
    ('Dumbbell Tripod Row', 'Pull', 'Dumbbell / Bench', 'weight_reps', '3-4', '8-12 / side', 'pull', 'beginner', 'low', true),
    ('Dumbbell Underhand Bench Press', 'Push', 'Dumbbell / Bench', 'weight_reps', '3-4', '8-12', 'push', 'intermediate', 'low', false),
    ('Dumbbell Urlacher Curl', 'Pull', 'Dumbbell', 'weight_reps', '3', '8-15', 'pull', 'intermediate', 'low', false),
    ('Double-Dumbbell Frog Press', 'Lower Body', 'Dumbbell', 'weight_reps', '3', '8-15', 'hinge', 'intermediate', 'low', false),
    ('Double-Dumbbell Pullover', 'Pull', 'Dumbbell / Bench', 'weight_reps', '3-4', '8-12', 'pull', 'intermediate', 'low', false),
    ('Sliding Bodyweight Pulldown', 'Pull', 'Bodyweight', 'reps_only', '3', '8-15', 'pull', 'intermediate', 'low', false),
    ('Elbows-Tucked Dumbbell Bench Press', 'Push', 'Dumbbell / Bench', 'weight_reps', '3', '8-15', 'push', 'intermediate', 'low', false),
    ('Lying Dumbbell Triceps Extension', 'Push', 'Dumbbell / Bench', 'weight_reps', '3', '8-15', 'push', 'beginner', 'low', false),
    ('Modified Dumbbell Bradford Press', 'Push', 'Dumbbell', 'weight_reps', '3', '8-15', 'push', 'intermediate', 'low', false),
    ('Single-Dumbbell Press-Out', 'Push', 'Dumbbell', 'weight_reps', '3', '8-15', 'push', 'beginner', 'low', false),
    ('Weighted Chin-Up', 'Pull', 'Pull-up bar / Added weight', 'weight_reps', '3', '3-8', 'pull', 'intermediate', 'low', false),
    ('Weighted Dip', 'Push', 'Dip bars / Added weight', 'weight_reps', '3', '3-8', 'push', 'intermediate', 'low', false)
),
strength as (
  select id from public.activity_types where name = 'Strength'
)
insert into public.exercises (
  activity_type_id,
  name,
  focus_area,
  equipment,
  default_metric,
  suggested_sets,
  suggested_reps,
  circuit_suitability,
  circuit_pattern,
  circuit_difficulty,
  circuit_impact,
  circuit_dose_mode,
  circuit_dose_min,
  circuit_dose_max,
  circuit_dose_per_side,
  notes,
  is_active,
  source_sheet
)
select
  strength.id,
  desired.name,
  desired.focus_area,
  desired.equipment,
  desired.default_metric,
  desired.suggested_sets,
  desired.suggested_reps,
  'excluded',
  desired.circuit_pattern,
  desired.circuit_difficulty,
  desired.circuit_impact,
  case when desired.default_metric = 'hold' then 'seconds' else 'reps' end,
  null,
  null,
  desired.circuit_dose_per_side,
  'JACKED programme movement retained as a distinct Library variation.',
  true,
  'JACKED Library'
from desired_exercises desired
cross join strength
where not exists (
  select 1
  from public.exercises existing
  where existing.activity_type_id = strength.id
    and lower(btrim(existing.name)) = lower(btrim(desired.name))
);

create temporary table jacked_assignment_positions on commit drop as
select
  assignment.id as assignment_id,
  coalesce(
    (
      select next_workout.id
      from public.program_workouts next_workout
      where next_workout.program_id = assignment.program_id
        and next_workout.sequence_index >= assignment.current_workout_index
        and next_workout.name not ilike 'Corrective %'
      order by next_workout.sequence_index
      limit 1
    ),
    (
      select previous_workout.id
      from public.program_workouts previous_workout
      where previous_workout.program_id = assignment.program_id
        and previous_workout.name not ilike 'Corrective %'
      order by previous_workout.sequence_index desc
      limit 1
    )
  ) as target_workout_id
from public.program_assignments assignment
join public.programs programme on programme.id = assignment.program_id
where programme.method_type = 'jacked_dumbbell';

delete from public.program_workout_entries entry
using public.program_workouts workout, public.programs programme
where entry.program_workout_id = workout.id
  and workout.program_id = programme.id
  and programme.method_type = 'jacked_dumbbell'
  and entry.name in ('CORRECTIVE', 'CORRECTIVES · 2 MOVEMENTS');

delete from public.program_workouts workout
using public.programs programme
where workout.program_id = programme.id
  and programme.method_type = 'jacked_dumbbell'
  and workout.name ilike 'Corrective %';

with movement_map (source_name, canonical_name) as (
  values
    ('ALTERNATING DB CURLS', 'Alternating Dumbbell Curl'),
    ('ALTERNATING DB FRONT RAISES', 'Alternating Dumbbell Front Raise'),
    ('ALTERNATING DB UCV RAISES', 'Alternating Dumbbell UCV Raise'),
    ('ALTERNATING REVERSE DB LUNGES', 'Alternating Dumbbell Reverse Lunge'),
    ('BENCH DIPS', 'Bench Dip'),
    ('COBRA PUSHUPS', 'Cobra Push-Up'),
    ('DB ABDUCTION ROWS', 'Dumbbell Abduction Row'),
    ('DB ALT. GORILLA ROWS', 'Alternating Dumbbell Gorilla Row'),
    ('DB ALT. GORILLA ROWS · PULLUP BAR SWAP', 'Inverted Chin-Up'),
    ('DB ALT. REVERSE SPRINTER LUNGES', 'Alternating Dumbbell Reverse Sprinter Lunge'),
    ('DB ALT. STEP UPS', 'Alternating Dumbbell Step-Up'),
    ('DB BENCH FRONT SQUATS', 'Dumbbell Bench Front Squat'),
    ('DB BENCH PRESS', 'Dumbbell Bench Press'),
    ('DB BULGARIAN SPLIT SQUATS', 'Bulgarian Split Squat'),
    ('DB CHEAT LATERALS', 'Dumbbell Cheat Lateral Raise'),
    ('DB CHEST SUPPORTED ROWS', 'Chest-Supported Dumbbell Row'),
    ('DB COSSACK SQUATS', 'Dumbbell Cossack Squat'),
    ('DB CROSS BODY HAMMER CURLS', 'Dumbbell Cross-Body Hammer Curl'),
    ('DB CROSS BODY HAMMER CURLS · PULLUP BAR SWAP', 'Close-Grip Inverted Row Hold'),
    ('DB DRAG CURLS', 'Dumbbell Drag Curl'),
    ('DB DRAG CURLS · PULLUP BAR SWAP', 'Inverted Chin Curl Hold'),
    ('DB FLOOR FLY', 'Dumbbell Floor Fly'),
    ('DB FLOOR FLYS', 'Dumbbell Floor Fly'),
    ('DB FLOOR PRESS', 'Dumbbell Floor Press'),
    ('DB GOBLET SQUATS', 'Goblet Squat'),
    ('DB HAMMER CURLS', 'Dumbbell Hammer Curl'),
    ('DB HAMMER CURLS · PULLUP BAR SWAP', 'Close-Grip Inverted Row Hold'),
    ('DB HANEY SHRUGS', 'Dumbbell Haney Shrug'),
    ('DB HANEY SHRUGS · PULLUP BAR SWAP', 'Inverted Face Pull'),
    ('DB HIGH PULLS', 'Dumbbell High Pull'),
    ('DB HIP THRUSTS', 'Dumbbell Hip Thrust'),
    ('DB INCLINE BENCH PRESS', 'Incline Dumbbell Press'),
    ('DB JM PRESS', 'Dumbbell JM Press'),
    ('DB KICKBACKS', 'Dumbbell Triceps Kickback'),
    ('DB LEANING STEP UPS', 'Dumbbell Leaning Step-Up'),
    ('DB NO MONEY CURLS', 'Dumbbell No-Money Curl'),
    ('DB OHP', 'Dumbbell Overhead Press'),
    ('DB OVERHEAD EXTENSIONS', 'Dumbbell Overhead Triceps Extension'),
    ('DB PLYO STEP UPS', 'Dumbbell Plyometric Step-Up'),
    ('DB POWER HIGH PULL', 'Dumbbell Power High Pull'),
    ('DB PRESS OUTS', 'Dumbbell Press-Out'),
    ('DB RDLS', 'Dumbbell Romanian Deadlift'),
    ('DB REAR DELT ROWS', 'Dumbbell Rear-Delt Row'),
    ('DB RENEGADE ROWS', 'Renegade Row'),
    ('DB ROCKET SQUATS', 'Dumbbell Rocket Squat'),
    ('DB ROWS', 'Dumbbell Bent-Over Row'),
    ('DB SIDE LATERAL RAISES', 'Dumbbell Lateral Raise'),
    ('DB SINGLE LEG RDL CALF RAISES', 'Dumbbell Single-Leg RDL Calf Raise'),
    ('DB SKULL CRUSHERS', 'Dumbbell Skull Crusher'),
    ('DB SPIDER CURLS', 'Dumbbell Spider Curl'),
    ('DB STATIC CREEPING LUNGES', 'Dumbbell Static Creeping Lunge'),
    ('DB STEP UPS', 'Dumbbell Step-Up'),
    ('DB STRAIGHT BAR CURLS', 'Dumbbell Straight-Bar Curl'),
    ('DB SWINGS', 'Dumbbell Swing'),
    ('DB THRUSTERS', 'Dumbbell Thruster'),
    ('DB TRIPOD ROWS', 'Dumbbell Tripod Row'),
    ('DB UNDERHAND BENCH PRESS', 'Dumbbell Underhand Bench Press'),
    ('DB URLACHERS', 'Dumbbell Urlacher Curl'),
    ('DOUBLE DB FROG PRESS', 'Double-Dumbbell Frog Press'),
    ('DOUBLE DB PULLOVERS', 'Double-Dumbbell Pullover'),
    ('DOUBLE DB PULLOVERS · PULLUP BAR SWAP', 'Sliding Bodyweight Pulldown'),
    ('ELBOWS TUCKED DB BENCH PRESS', 'Elbows-Tucked Dumbbell Bench Press'),
    ('FLOOR FLYS', 'Dumbbell Floor Fly'),
    ('INCLINE DB BENCH PRESS', 'Incline Dumbbell Press'),
    ('LYING DB TRICEP EXTENSIONS', 'Lying Dumbbell Triceps Extension'),
    ('MODIFIED BRADFORD PRESS', 'Modified Dumbbell Bradford Press'),
    ('MODIFIED DB BRADFORD PRESS', 'Modified Dumbbell Bradford Press'),
    ('PUSHUPS', 'Pushups'),
    ('SINGLE DB PRESS OUTS', 'Single-Dumbbell Press-Out'),
    ('WEIGHTED CHINS', 'Weighted Chin-Up'),
    ('WEIGHTED DIPS', 'Weighted Dip'),
    ('WEIGHTED PULLUPS', 'Weighted Pull-Up')
),
resolved as (
  select
    movement.source_name,
    exercise.id as exercise_id,
    exercise.name as canonical_name
  from movement_map movement
  join lateral (
    select candidate.id, candidate.name
    from public.exercises candidate
    where lower(btrim(candidate.name)) = lower(btrim(movement.canonical_name))
    order by candidate.is_active desc, candidate.created_at, candidate.id
    limit 1
  ) exercise on true
)
update public.program_workout_entries entry
set exercise_id = resolved.exercise_id,
    name = resolved.canonical_name,
    updated_at = now()
from public.program_workouts workout,
     public.programs programme,
     resolved
where entry.program_workout_id = workout.id
  and workout.program_id = programme.id
  and programme.method_type = 'jacked_dumbbell'
  and entry.name = resolved.source_name;

with movement_map (source_name, canonical_name) as (
  values
    ('ALTERNATING DB CURLS', 'Alternating Dumbbell Curl'),
    ('ALTERNATING DB FRONT RAISES', 'Alternating Dumbbell Front Raise'),
    ('ALTERNATING DB UCV RAISES', 'Alternating Dumbbell UCV Raise'),
    ('ALTERNATING REVERSE DB LUNGES', 'Alternating Dumbbell Reverse Lunge'),
    ('BENCH DIPS', 'Bench Dip'),
    ('COBRA PUSHUPS', 'Cobra Push-Up'),
    ('DB ABDUCTION ROWS', 'Dumbbell Abduction Row'),
    ('DB ALT. GORILLA ROWS', 'Alternating Dumbbell Gorilla Row'),
    ('DB ALT. GORILLA ROWS · PULLUP BAR SWAP', 'Inverted Chin-Up'),
    ('DB ALT. REVERSE SPRINTER LUNGES', 'Alternating Dumbbell Reverse Sprinter Lunge'),
    ('DB ALT. STEP UPS', 'Alternating Dumbbell Step-Up'),
    ('DB BENCH FRONT SQUATS', 'Dumbbell Bench Front Squat'),
    ('DB BENCH PRESS', 'Dumbbell Bench Press'),
    ('DB BULGARIAN SPLIT SQUATS', 'Bulgarian Split Squat'),
    ('DB CHEAT LATERALS', 'Dumbbell Cheat Lateral Raise'),
    ('DB CHEST SUPPORTED ROWS', 'Chest-Supported Dumbbell Row'),
    ('DB COSSACK SQUATS', 'Dumbbell Cossack Squat'),
    ('DB CROSS BODY HAMMER CURLS', 'Dumbbell Cross-Body Hammer Curl'),
    ('DB CROSS BODY HAMMER CURLS · PULLUP BAR SWAP', 'Close-Grip Inverted Row Hold'),
    ('DB DRAG CURLS', 'Dumbbell Drag Curl'),
    ('DB DRAG CURLS · PULLUP BAR SWAP', 'Inverted Chin Curl Hold'),
    ('DB FLOOR FLY', 'Dumbbell Floor Fly'),
    ('DB FLOOR FLYS', 'Dumbbell Floor Fly'),
    ('DB FLOOR PRESS', 'Dumbbell Floor Press'),
    ('DB GOBLET SQUATS', 'Goblet Squat'),
    ('DB HAMMER CURLS', 'Dumbbell Hammer Curl'),
    ('DB HAMMER CURLS · PULLUP BAR SWAP', 'Close-Grip Inverted Row Hold'),
    ('DB HANEY SHRUGS', 'Dumbbell Haney Shrug'),
    ('DB HANEY SHRUGS · PULLUP BAR SWAP', 'Inverted Face Pull'),
    ('DB HIGH PULLS', 'Dumbbell High Pull'),
    ('DB HIP THRUSTS', 'Dumbbell Hip Thrust'),
    ('DB INCLINE BENCH PRESS', 'Incline Dumbbell Press'),
    ('DB JM PRESS', 'Dumbbell JM Press'),
    ('DB KICKBACKS', 'Dumbbell Triceps Kickback'),
    ('DB LEANING STEP UPS', 'Dumbbell Leaning Step-Up'),
    ('DB NO MONEY CURLS', 'Dumbbell No-Money Curl'),
    ('DB OHP', 'Dumbbell Overhead Press'),
    ('DB OVERHEAD EXTENSIONS', 'Dumbbell Overhead Triceps Extension'),
    ('DB PLYO STEP UPS', 'Dumbbell Plyometric Step-Up'),
    ('DB POWER HIGH PULL', 'Dumbbell Power High Pull'),
    ('DB PRESS OUTS', 'Dumbbell Press-Out'),
    ('DB RDLS', 'Dumbbell Romanian Deadlift'),
    ('DB REAR DELT ROWS', 'Dumbbell Rear-Delt Row'),
    ('DB RENEGADE ROWS', 'Renegade Row'),
    ('DB ROCKET SQUATS', 'Dumbbell Rocket Squat'),
    ('DB ROWS', 'Dumbbell Bent-Over Row'),
    ('DB SIDE LATERAL RAISES', 'Dumbbell Lateral Raise'),
    ('DB SINGLE LEG RDL CALF RAISES', 'Dumbbell Single-Leg RDL Calf Raise'),
    ('DB SKULL CRUSHERS', 'Dumbbell Skull Crusher'),
    ('DB SPIDER CURLS', 'Dumbbell Spider Curl'),
    ('DB STATIC CREEPING LUNGES', 'Dumbbell Static Creeping Lunge'),
    ('DB STEP UPS', 'Dumbbell Step-Up'),
    ('DB STRAIGHT BAR CURLS', 'Dumbbell Straight-Bar Curl'),
    ('DB SWINGS', 'Dumbbell Swing'),
    ('DB THRUSTERS', 'Dumbbell Thruster'),
    ('DB TRIPOD ROWS', 'Dumbbell Tripod Row'),
    ('DB UNDERHAND BENCH PRESS', 'Dumbbell Underhand Bench Press'),
    ('DB URLACHERS', 'Dumbbell Urlacher Curl'),
    ('DOUBLE DB FROG PRESS', 'Double-Dumbbell Frog Press'),
    ('DOUBLE DB PULLOVERS', 'Double-Dumbbell Pullover'),
    ('DOUBLE DB PULLOVERS · PULLUP BAR SWAP', 'Sliding Bodyweight Pulldown'),
    ('ELBOWS TUCKED DB BENCH PRESS', 'Elbows-Tucked Dumbbell Bench Press'),
    ('FLOOR FLYS', 'Dumbbell Floor Fly'),
    ('INCLINE DB BENCH PRESS', 'Incline Dumbbell Press'),
    ('LYING DB TRICEP EXTENSIONS', 'Lying Dumbbell Triceps Extension'),
    ('MODIFIED BRADFORD PRESS', 'Modified Dumbbell Bradford Press'),
    ('MODIFIED DB BRADFORD PRESS', 'Modified Dumbbell Bradford Press'),
    ('PUSHUPS', 'Pushups'),
    ('SINGLE DB PRESS OUTS', 'Single-Dumbbell Press-Out'),
    ('WEIGHTED CHINS', 'Weighted Chin-Up'),
    ('WEIGHTED DIPS', 'Weighted Dip'),
    ('WEIGHTED PULLUPS', 'Weighted Pull-Up')
),
resolved as (
  select movement.source_name, exercise.id as exercise_id, exercise.activity_type_id
  from movement_map movement
  join lateral (
    select candidate.id, candidate.activity_type_id
    from public.exercises candidate
    where lower(btrim(candidate.name)) = lower(btrim(movement.canonical_name))
    order by candidate.is_active desc, candidate.created_at, candidate.id
    limit 1
  ) exercise on true
)
insert into public.exercise_aliases (
  alias_name,
  exercise_id,
  activity_type_id,
  status,
  reason
)
select
  resolved.source_name,
  resolved.exercise_id,
  resolved.activity_type_id,
  'reviewed',
  'Imported JACKED programme label mapped to its canonical Library exercise.'
from resolved
on conflict do nothing;

update public.programs
set description = 'Twelve-week dumbbell programme with single-muscle, push/pull/legs, total-body and challenge phases. Loads and volume are autoregulated from the source programme''s ignitor-set paths and box scores.',
    updated_at = now()
where method_type = 'jacked_dumbbell';

update public.program_workouts workout
set sequence_index = workout.sequence_index + 1000,
    updated_at = now()
from public.programs programme
where workout.program_id = programme.id
  and programme.method_type = 'jacked_dumbbell';

with numbered as (
  select
    workout.id,
    row_number() over (
      partition by workout.program_id
      order by workout.week_number, workout.day_number, workout.id
    )::integer - 1 as sequence_index,
    row_number() over (
      partition by workout.program_id, workout.week_number
      order by workout.day_number, workout.id
    )::integer as session_number
  from public.program_workouts workout
  join public.programs programme on programme.id = workout.program_id
  where programme.method_type = 'jacked_dumbbell'
)
update public.program_workouts workout
set sequence_index = numbered.sequence_index,
    session_number = numbered.session_number,
    updated_at = now()
from numbered
where workout.id = numbered.id;

update public.program_assignments assignment
set current_workout_index = workout.sequence_index,
    updated_at = now()
from jacked_assignment_positions saved
join public.program_workouts workout on workout.id = saved.target_workout_id
where assignment.id = saved.assignment_id;

update public.program_assignments assignment
set current_workout_index = least(
      assignment.current_workout_index,
      (
        select count(*)::integer
        from public.program_workouts workout
        where workout.program_id = assignment.program_id
      )
    ),
    updated_at = now()
from public.programs programme
where assignment.program_id = programme.id
  and programme.method_type = 'jacked_dumbbell';

do $$
declare
  unlinked_count integer;
  unlinked_names text;
  mismatched_name_count integer;
  corrective_count integer;
  workout_count integer;
  entry_count integer;
begin
  select count(*), string_agg(distinct entry.name, ', ' order by entry.name)
  into unlinked_count, unlinked_names
  from public.program_workout_entries entry
  join public.program_workouts workout on workout.id = entry.program_workout_id
  join public.programs programme on programme.id = workout.program_id
  where programme.method_type = 'jacked_dumbbell'
    and entry.exercise_id is null;

  select count(*)
  into mismatched_name_count
  from public.program_workout_entries entry
  join public.program_workouts workout on workout.id = entry.program_workout_id
  join public.programs programme on programme.id = workout.program_id
  join public.exercises exercise on exercise.id = entry.exercise_id
  where programme.method_type = 'jacked_dumbbell'
    and entry.name <> exercise.name;

  select count(*)
  into corrective_count
  from public.programs programme
  left join public.program_workouts workout on workout.program_id = programme.id
  left join public.program_workout_entries entry on entry.program_workout_id = workout.id
  where programme.method_type = 'jacked_dumbbell'
    and (
      workout.name ilike '%corrective%'
      or coalesce(workout.description, '') ilike '%corrective%'
      or coalesce(entry.name, '') ilike '%corrective%'
      or coalesce(entry.notes, '') ilike '%corrective%'
    );

  select count(*), coalesce(sum(entry_total), 0)::integer
  into workout_count, entry_count
  from (
    select workout.id, count(entry.id)::integer as entry_total
    from public.program_workouts workout
    join public.programs programme on programme.id = workout.program_id
    left join public.program_workout_entries entry on entry.program_workout_id = workout.id
    where programme.method_type = 'jacked_dumbbell'
    group by workout.id
  ) counts;

  if unlinked_count <> 0 then
    raise exception 'JACKED still has % programme entries without a Library exercise: %', unlinked_count, unlinked_names;
  end if;
  if mismatched_name_count <> 0 then
    raise exception 'JACKED still has % programme entries whose names differ from the Library', mismatched_name_count;
  end if;
  if corrective_count <> 0 then
    raise exception 'JACKED still has % corrective references', corrective_count;
  end if;
  if workout_count <> 58 or entry_count <> 288 then
    raise exception 'Unexpected JACKED size after cleanup: % workouts and % entries', workout_count, entry_count;
  end if;
end
$$;

commit;
