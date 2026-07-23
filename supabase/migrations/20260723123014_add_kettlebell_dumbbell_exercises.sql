-- Add the approved kettlebell and dumbbell catalogue expansion.
-- Existing matching names are refreshed, every active person receives enabled
-- Both-scoped library entries, and structured equipment requirements are rebuilt.
with desired(
  type_name,
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
  notes
) as (
  values
    -- Kettlebell: strength, unilateral control, carries and core.
    ('Strength', 'Double Kettlebell Front Squat', 'Lower Body', 'Kettlebell', 'weight_reps', '3-4', '6-10', 'preferred', 'squat', 'intermediate', 'low', 'reps', 6, 10, false, 'Track the combined kettlebell load and keep both bells secure in the front rack.'),
    ('Strength', 'Kettlebell Single-Leg Romanian Deadlift', 'Lower Body', 'Kettlebell', 'weight_reps', '3', '6-10 / side', 'preferred', 'hinge', 'intermediate', 'low', 'reps', 6, 10, true, 'Keep the pelvis level and track load plus reps per side.'),
    ('Strength', 'Kettlebell Floor Press', 'Push', 'Kettlebell', 'weight_reps', '3-4', '8-12 / side', 'preferred', 'push', 'beginner', 'low', 'reps', 8, 12, true, 'Use a controlled pause on the floor and track the kettlebell load per side.'),
    ('Strength', 'Kettlebell Gorilla Row', 'Pull', 'Kettlebell', 'weight_reps', '3-4', '6-10 / side', 'preferred', 'pull', 'intermediate', 'low', 'reps', 6, 10, true, 'Hold a stable hinge while alternating rows and track reps per side.'),
    ('Strength', 'Kettlebell Overhead Carry', 'Carry', 'Kettlebell', 'carry', '3', '20-40 m / side', 'preferred', 'carry', 'intermediate', 'low', 'metres', 20, 40, true, 'Keep the arm stacked overhead and track load, distance and each side.'),
    ('Strength', 'Kettlebell Front-Rack Carry', 'Carry', 'Kettlebell', 'carry', '3', '20-40 m / side', 'preferred', 'carry', 'beginner', 'low', 'metres', 20, 40, true, 'Use a tall front-rack position and track each side when carrying one bell.'),
    ('Strength', 'Kettlebell Bottoms-Up Press', 'Push', 'Kettlebell', 'weight_reps', '3', '5-8 / side', 'available', 'push', 'advanced', 'low', 'reps', 5, 8, true, 'Use a light bell, keep the handle stacked and stop before grip control is lost.'),
    ('Strength', 'Kettlebell Bottoms-Up Carry', 'Carry', 'Kettlebell', 'carry', '3', '15-30 m / side', 'available', 'carry', 'advanced', 'low', 'metres', 15, 30, true, 'Use a conservative load and track controlled distance per side.'),
    ('Strength', 'Kettlebell Split Squat', 'Lower Body', 'Kettlebell', 'weight_reps', '3', '8-12 / side', 'preferred', 'lunge', 'intermediate', 'low', 'reps', 8, 12, true, 'Hold the bell in goblet or front-rack position and track reps per side.'),
    ('Strength', 'Kettlebell Sumo Deadlift', 'Lower Body', 'Kettlebell', 'weight_reps', '3-4', '8-12', 'preferred', 'hinge', 'beginner', 'low', 'reps', 8, 12, false, 'Keep the bell centred between the feet and finish with controlled hip extension.'),
    ('Strength', 'Kettlebell Cossack Squat', 'Lower Body', 'Kettlebell', 'weight_reps', '3', '5-8 / side', 'available', 'lunge', 'intermediate', 'low', 'reps', 5, 8, true, 'Use the bell as a counterbalance and work only through a controlled range.'),
    ('Conditioning', 'Kettlebell Clean & Jerk', 'Full Body', 'Kettlebell', 'weight_reps', '4-6', '3-6 / side', 'available', 'full_body', 'advanced', 'moderate', 'reps', 3, 6, true, 'Use reliable clean-and-jerk technique; repeated cycles may be logged as long-cycle work.'),
    ('Strength', 'Kettlebell Plank Drag', 'Core', 'Kettlebell', 'weight_reps', '3', '6-10 / side', 'preferred', 'core', 'intermediate', 'low', 'reps', 6, 10, true, 'Resist trunk rotation while dragging the bell across and track reps per side.'),
    ('Conditioning', 'Kettlebell Figure Eight', 'Core', 'Kettlebell', 'weight_reps', '3-4', '8-12', 'preferred', 'core', 'intermediate', 'low', 'reps', 8, 12, false, 'Pass the bell smoothly between the legs while keeping the hinge and trunk controlled.'),
    ('Strength', 'Kettlebell Dead-Bug Pullover', 'Core', 'Kettlebell', 'weight_reps', '3', '6-10', 'preferred', 'core', 'intermediate', 'low', 'reps', 6, 10, false, 'Keep the lower back controlled while moving the bell through a comfortable overhead range.'),

    -- Dumbbell: pulling, pressing, single-leg strength and direct arm work.
    ('Strength', 'Chest-Supported Dumbbell Row', 'Pull', 'Dumbbell / Bench', 'weight_reps', '3-4', '8-12', 'preferred', 'pull', 'beginner', 'low', 'reps', 8, 12, false, 'Support the chest on an incline bench and track the weight of one dumbbell.'),
    ('Strength', 'Arnold Press', 'Push', 'Dumbbell', 'weight_reps', '3', '8-12', 'preferred', 'push', 'intermediate', 'low', 'reps', 8, 12, false, 'Rotate smoothly through a comfortable shoulder range and track one-dumbbell load.'),
    ('Strength', 'Dumbbell Single-Leg Romanian Deadlift', 'Lower Body', 'Dumbbell', 'weight_reps', '3', '8-12 / side', 'preferred', 'hinge', 'intermediate', 'low', 'reps', 8, 12, true, 'Keep the pelvis level and track load plus reps per side.'),
    ('Conditioning', 'Dumbbell Clean & Press', 'Full Body', 'Dumbbell', 'weight_reps', '3-5', '6-10 / side', 'preferred', 'full_body', 'intermediate', 'moderate', 'reps', 6, 10, true, 'Use a controlled clean and press, tracking load and reps per side.'),
    ('Strength', 'Dumbbell Rear-Delt Fly', 'Pull', 'Dumbbell', 'weight_reps', '3', '10-15', 'available', 'pull', 'beginner', 'low', 'reps', 10, 15, false, 'Use a light load and controlled shoulder-blade movement without shrugging.'),
    ('Strength', 'Dumbbell Bent-Over Row', 'Pull', 'Dumbbell', 'weight_reps', '3-4', '8-12', 'preferred', 'pull', 'beginner', 'low', 'reps', 8, 12, false, 'Hold a consistent hinge position and track the weight of one dumbbell.'),
    ('Strength', 'Dumbbell Z Press', 'Push', 'Dumbbell', 'weight_reps', '3', '6-10', 'available', 'push', 'intermediate', 'low', 'reps', 6, 10, false, 'Sit tall with the legs extended and press only while trunk position stays controlled.'),
    ('Strength', 'Dumbbell Squeeze Press', 'Push', 'Dumbbell', 'weight_reps', '3', '8-12', 'preferred', 'push', 'beginner', 'low', 'reps', 8, 12, false, 'Press the dumbbells together throughout and use a bench or floor setup.'),
    ('Strength', 'Dumbbell Chest Fly', 'Push', 'Dumbbell', 'weight_reps', '3', '8-12', 'available', 'push', 'intermediate', 'low', 'reps', 8, 12, false, 'Use a bench or floor and stop at a comfortable shoulder range.'),
    ('Strength', 'Dumbbell Pullover', 'Pull', 'Dumbbell', 'weight_reps', '3', '8-12', 'available', 'pull', 'intermediate', 'low', 'reps', 8, 12, false, 'Keep the ribs controlled and move only through a comfortable overhead range.'),
    ('Strength', 'Dumbbell Biceps Curl', 'Pull', 'Dumbbell', 'weight_reps', '3', '8-15', 'available', 'pull', 'beginner', 'low', 'reps', 10, 15, false, 'Keep the upper arms still and track the weight of one dumbbell.'),
    ('Strength', 'Dumbbell Hammer Curl', 'Pull', 'Dumbbell', 'weight_reps', '3', '8-15', 'available', 'pull', 'beginner', 'low', 'reps', 10, 15, false, 'Use a neutral grip and controlled range without swinging.'),
    ('Strength', 'Dumbbell Overhead Triceps Extension', 'Push', 'Dumbbell', 'weight_reps', '3', '8-15', 'available', 'push', 'beginner', 'low', 'reps', 10, 15, false, 'Keep the upper arms stable and use a comfortable overhead range.'),
    ('Strength', 'Dumbbell Skull Crusher', 'Push', 'Dumbbell', 'weight_reps', '3', '8-12', 'available', 'push', 'intermediate', 'low', 'reps', 8, 12, false, 'Lower with control toward a comfortable position and keep the upper arms stable.'),
    ('Strength', 'Dumbbell Hip Thrust', 'Lower Body', 'Dumbbell / Bench', 'weight_reps', '3-4', '8-15', 'preferred', 'hinge', 'beginner', 'low', 'reps', 10, 15, false, 'Support the upper back on a stable bench and pause at controlled hip extension.')
),
typed as (
  select desired.*, activity.id as activity_type_id
  from desired
  join public.activity_types activity on activity.name = desired.type_name
),
updated as (
  update public.exercises exercise
  set
    activity_type_id = typed.activity_type_id,
    focus_area = typed.focus_area,
    equipment = typed.equipment,
    default_metric = typed.default_metric,
    suggested_sets = typed.suggested_sets,
    suggested_reps = typed.suggested_reps,
    circuit_suitability = typed.circuit_suitability,
    circuit_pattern = typed.circuit_pattern,
    circuit_difficulty = typed.circuit_difficulty,
    circuit_impact = typed.circuit_impact,
    circuit_dose_mode = typed.circuit_dose_mode,
    circuit_dose_min = typed.circuit_dose_min,
    circuit_dose_max = typed.circuit_dose_max,
    circuit_dose_per_side = typed.circuit_dose_per_side,
    notes = typed.notes,
    is_active = true,
    updated_at = now()
  from typed
  where lower(exercise.name) = lower(typed.name)
  returning exercise.id, exercise.name
),
numbered as (
  select
    typed.*,
    (select coalesce(max(source_row), 4) from public.exercises where source_sheet = 'Exercise Library')
      + row_number() over (order by typed.type_name, typed.name) as next_source_row
  from typed
  where not exists (
    select 1
    from public.exercises existing
    where lower(existing.name) = lower(typed.name)
  )
),
inserted as (
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
    source_sheet,
    source_row
  )
  select
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
    true,
    'Exercise Library',
    next_source_row
  from numbered
  returning id, name
),
changed as (
  select id, name from updated
  union all
  select id, name from inserted
)
insert into public.person_exercises (person_id, exercise_id, is_enabled, location_scope)
select person.id, changed.id, true, 'both'
from changed
cross join public.people person
where person.status = 'active'
on conflict (person_id, exercise_id) do update
set
  is_enabled = true,
  location_scope = 'both',
  updated_at = now();

-- Deadlift is a barbell movement in this catalogue. Its structured requirement
-- was already Barbell-only in production; update the legacy display snapshot too.
update public.exercises
set
  equipment = 'Barbell',
  updated_at = now()
where lower(name) = 'deadlift';

with desired_names(name) as (
  values
    ('Double Kettlebell Front Squat'),
    ('Kettlebell Single-Leg Romanian Deadlift'),
    ('Kettlebell Floor Press'),
    ('Kettlebell Gorilla Row'),
    ('Kettlebell Overhead Carry'),
    ('Kettlebell Front-Rack Carry'),
    ('Kettlebell Bottoms-Up Press'),
    ('Kettlebell Bottoms-Up Carry'),
    ('Kettlebell Split Squat'),
    ('Kettlebell Sumo Deadlift'),
    ('Kettlebell Cossack Squat'),
    ('Kettlebell Clean & Jerk'),
    ('Kettlebell Plank Drag'),
    ('Kettlebell Figure Eight'),
    ('Kettlebell Dead-Bug Pullover'),
    ('Chest-Supported Dumbbell Row'),
    ('Arnold Press'),
    ('Dumbbell Single-Leg Romanian Deadlift'),
    ('Dumbbell Clean & Press'),
    ('Dumbbell Rear-Delt Fly'),
    ('Dumbbell Bent-Over Row'),
    ('Dumbbell Z Press'),
    ('Dumbbell Squeeze Press'),
    ('Dumbbell Chest Fly'),
    ('Dumbbell Pullover'),
    ('Dumbbell Biceps Curl'),
    ('Dumbbell Hammer Curl'),
    ('Dumbbell Overhead Triceps Extension'),
    ('Dumbbell Skull Crusher'),
    ('Dumbbell Hip Thrust'),
    ('Deadlift')
)
delete from public.exercise_equipment_items link
using public.exercises exercise, desired_names desired
where link.exercise_id = exercise.id
  and lower(exercise.name) = lower(desired.name);

with desired_equipment(exercise_name, equipment_name) as (
  values
    ('Double Kettlebell Front Squat', 'Kettlebell'),
    ('Kettlebell Single-Leg Romanian Deadlift', 'Kettlebell'),
    ('Kettlebell Floor Press', 'Kettlebell'),
    ('Kettlebell Gorilla Row', 'Kettlebell'),
    ('Kettlebell Overhead Carry', 'Kettlebell'),
    ('Kettlebell Front-Rack Carry', 'Kettlebell'),
    ('Kettlebell Bottoms-Up Press', 'Kettlebell'),
    ('Kettlebell Bottoms-Up Carry', 'Kettlebell'),
    ('Kettlebell Split Squat', 'Kettlebell'),
    ('Kettlebell Sumo Deadlift', 'Kettlebell'),
    ('Kettlebell Cossack Squat', 'Kettlebell'),
    ('Kettlebell Clean & Jerk', 'Kettlebell'),
    ('Kettlebell Plank Drag', 'Kettlebell'),
    ('Kettlebell Figure Eight', 'Kettlebell'),
    ('Kettlebell Dead-Bug Pullover', 'Kettlebell'),
    ('Chest-Supported Dumbbell Row', 'Dumbbell'),
    ('Chest-Supported Dumbbell Row', 'Bench'),
    ('Arnold Press', 'Dumbbell'),
    ('Dumbbell Single-Leg Romanian Deadlift', 'Dumbbell'),
    ('Dumbbell Clean & Press', 'Dumbbell'),
    ('Dumbbell Rear-Delt Fly', 'Dumbbell'),
    ('Dumbbell Bent-Over Row', 'Dumbbell'),
    ('Dumbbell Z Press', 'Dumbbell'),
    ('Dumbbell Squeeze Press', 'Dumbbell'),
    ('Dumbbell Chest Fly', 'Dumbbell'),
    ('Dumbbell Pullover', 'Dumbbell'),
    ('Dumbbell Biceps Curl', 'Dumbbell'),
    ('Dumbbell Hammer Curl', 'Dumbbell'),
    ('Dumbbell Overhead Triceps Extension', 'Dumbbell'),
    ('Dumbbell Skull Crusher', 'Dumbbell'),
    ('Dumbbell Hip Thrust', 'Dumbbell'),
    ('Dumbbell Hip Thrust', 'Bench'),
    ('Deadlift', 'Barbell')
)
insert into public.exercise_equipment_items (exercise_id, equipment_item_id)
select distinct exercise.id, equipment.id
from desired_equipment desired
join public.exercises exercise on lower(exercise.name) = lower(desired.exercise_name)
join public.equipment_items equipment
  on lower(equipment.name) = lower(desired.equipment_name)
  and equipment.is_active
join public.people person
  on person.id = equipment.person_id
  and person.status = 'active'
on conflict (exercise_id, equipment_item_id) do nothing;
