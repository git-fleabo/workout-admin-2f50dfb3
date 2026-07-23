-- Add a broad, idempotent suspension-training catalogue for TRX and gymnastic rings.
-- Existing matching movements are refreshed, and every active person receives
-- the new movements as enabled, Gym-scoped library entries.
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
    -- TRX: upper body.
    ('Strength', 'TRX High Row', 'Pull', 'TRX', 'reps_only', '3', '8-15', 'preferred', 'pull', 'beginner', 'low', 'reps', 8, 15, false, 'Pull toward the upper chest with the elbows high; adjust foot position to scale difficulty.'),
    ('Strength', 'TRX Face Pull', 'Pull', 'TRX', 'reps_only', '3', '10-15', 'preferred', 'pull', 'beginner', 'low', 'reps', 10, 15, false, 'Finish with the hands beside the face and keep the ribs controlled.'),
    ('Strength', 'TRX Y Raise', 'Pull', 'TRX', 'reps_only', '3', '8-12', 'preferred', 'pull', 'intermediate', 'low', 'reps', 8, 12, false, 'Raise the arms into a Y without shrugging; use a shallow body angle first.'),
    ('Strength', 'TRX T Raise', 'Pull', 'TRX', 'reps_only', '3', '8-12', 'preferred', 'pull', 'intermediate', 'low', 'reps', 8, 12, false, 'Open the arms into a T while keeping a rigid body line.'),
    ('Strength', 'TRX Biceps Curl', 'Pull', 'TRX', 'reps_only', '3', '8-15', 'preferred', 'pull', 'beginner', 'low', 'reps', 8, 15, false, 'Keep the upper arms lifted and curl the handles toward the forehead.'),
    ('Strength', 'TRX Triceps Extension', 'Push', 'TRX', 'reps_only', '3', '8-15', 'preferred', 'push', 'beginner', 'low', 'reps', 8, 15, false, 'Keep the upper arms still and extend the elbows without losing body tension.'),

    -- TRX: lower body.
    ('Strength', 'TRX Squat', 'Lower Body', 'TRX', 'reps_only', '3', '10-20', 'preferred', 'squat', 'beginner', 'low', 'reps', 10, 20, false, 'Use the straps for balance while keeping pressure through the whole foot.'),
    ('Strength', 'TRX Assisted Split Squat', 'Lower Body', 'TRX', 'reps_only', '3', '8-12 / side', 'preferred', 'lunge', 'beginner', 'low', 'reps', 8, 12, true, 'Use only as much strap assistance as needed and track reps per side.'),
    ('Strength', 'TRX Reverse Lunge', 'Lower Body', 'TRX', 'reps_only', '3', '8-12 / side', 'preferred', 'lunge', 'beginner', 'low', 'reps', 8, 12, true, 'Step back under control and use the straps for balance rather than pulling.'),
    ('Strength', 'TRX Single-Leg Squat', 'Lower Body', 'TRX', 'reps_only', '3', '6-10 / side', 'available', 'squat', 'intermediate', 'low', 'reps', 6, 10, true, 'Use strap assistance to keep a controlled single-leg range and track each side.'),
    ('Strength', 'TRX Hamstring Curl', 'Posterior Chain', 'TRX', 'reps_only', '3', '8-15', 'preferred', 'hinge', 'intermediate', 'low', 'reps', 8, 15, false, 'Keep the hips lifted as the heels curl toward the body.'),
    ('Strength', 'TRX Hip Press', 'Posterior Chain', 'TRX', 'reps_only', '3', '10-15', 'preferred', 'hinge', 'beginner', 'low', 'reps', 10, 15, false, 'Drive through the suspended heels and pause at full hip extension.'),

    -- TRX: core and full-body.
    ('Strength', 'TRX Fallout', 'Core', 'TRX', 'reps_only', '3', '6-12', 'preferred', 'core', 'intermediate', 'low', 'reps', 6, 12, false, 'Reach the handles forward only as far as the trunk can stay braced.'),
    ('Strength', 'TRX Knee Tuck', 'Core', 'TRX', 'reps_only', '3', '8-15', 'preferred', 'core', 'intermediate', 'low', 'reps', 8, 15, false, 'From a strong plank, draw both knees in without lifting the hips excessively.'),
    ('Strength', 'TRX Pike', 'Core', 'TRX', 'reps_only', '3', '6-12', 'available', 'core', 'advanced', 'low', 'reps', 6, 12, false, 'Lift the hips over the shoulders with straight legs and a controlled return.'),
    ('Strength', 'TRX Mountain Climber', 'Core', 'TRX', 'reps_only', '3', '10-20 / side', 'preferred', 'core', 'intermediate', 'moderate', 'reps', 10, 20, true, 'Keep the shoulders stacked over the hands and alternate controlled knee drives.'),
    ('Strength', 'TRX Sprinter Start', 'Lower Body', 'TRX', 'reps_only', '3', '8-12 / side', 'preferred', 'lunge', 'intermediate', 'moderate', 'reps', 8, 12, true, 'Drive from the front leg into a strong forward lean and track reps per side.'),
    ('Strength', 'TRX Power Pull', 'Full Body', 'TRX', 'reps_only', '3', '6-10 / side', 'available', 'full_body', 'intermediate', 'moderate', 'reps', 6, 10, true, 'Rotate open under control, then pull back to the anchor with the working arm.'),

    -- Gymnastic rings: push and pull strength.
    ('Strength', 'Ring Row', 'Pull', 'Gymnastic rings', 'reps_only', '3', '8-15', 'preferred', 'pull', 'beginner', 'low', 'reps', 8, 15, false, 'Keep the rings neutral and adjust foot position to scale difficulty.'),
    ('Strength', 'Ring Archer Row', 'Pull', 'Gymnastic rings', 'reps_only', '3', '5-8 / side', 'available', 'pull', 'advanced', 'low', 'reps', 5, 8, true, 'Pull toward one ring while the opposite arm opens; track reps per side.'),
    ('Strength', 'Ring Pull-Up', 'Pull', 'Gymnastic rings', 'reps_only', '3', '5-10', 'available', 'pull', 'intermediate', 'low', 'reps', 5, 10, false, 'Allow the rings to rotate naturally and record assistance or added load in notes.'),
    ('Strength', 'Ring Chin-Up', 'Pull', 'Gymnastic rings', 'reps_only', '3', '5-10', 'available', 'pull', 'intermediate', 'low', 'reps', 5, 10, false, 'Finish with a comfortable supinated grip and record assistance or added load in notes.'),
    ('Strength', 'Ring Scapular Pull-Up', 'Pull', 'Gymnastic rings', 'reps_only', '3', '8-12', 'preferred', 'pull', 'beginner', 'low', 'reps', 8, 12, false, 'Keep the elbows straight and move only through controlled shoulder-blade elevation and depression.'),
    ('Strength', 'Ring Face Pull', 'Pull', 'Gymnastic rings', 'reps_only', '3', '10-15', 'preferred', 'pull', 'beginner', 'low', 'reps', 10, 15, false, 'Pull the rings toward the face and finish with controlled external rotation.'),
    ('Strength', 'Ring Biceps Curl', 'Pull', 'Gymnastic rings', 'reps_only', '3', '8-15', 'preferred', 'pull', 'intermediate', 'low', 'reps', 8, 15, false, 'Keep the upper arms lifted and curl the rings toward the forehead.'),
    ('Strength', 'Ring Push-Up', 'Push', 'Gymnastic rings', 'reps_only', '3', '8-15', 'preferred', 'push', 'intermediate', 'low', 'reps', 8, 15, false, 'Keep the rings close and stable while maintaining a rigid body line.'),
    ('Strength', 'Ring Archer Push-Up', 'Push', 'Gymnastic rings', 'reps_only', '3', '5-8 / side', 'available', 'push', 'advanced', 'low', 'reps', 5, 8, true, 'Lower toward one ring while the opposite arm opens; track reps per side.'),
    ('Strength', 'Ring Dip', 'Push', 'Gymnastic rings', 'reps_only', '3', '5-10', 'available', 'push', 'advanced', 'low', 'reps', 5, 10, false, 'Begin from a stable support and use assistance if ring control breaks down.'),
    ('Strength', 'Ring Chest Fly', 'Push', 'Gymnastic rings', 'reps_only', '3', '6-12', 'available', 'push', 'advanced', 'low', 'reps', 6, 12, false, 'Use a conservative body angle and keep a slight bend in the elbows.'),
    ('Strength', 'Ring Triceps Extension', 'Push', 'Gymnastic rings', 'reps_only', '3', '8-15', 'preferred', 'push', 'intermediate', 'low', 'reps', 8, 15, false, 'Keep the upper arms still and extend through the elbows with the rings controlled.'),
    ('Strength', 'Ring Rollout', 'Core', 'Gymnastic rings', 'reps_only', '3', '6-12', 'available', 'core', 'advanced', 'low', 'reps', 6, 12, false, 'Reach only as far as the trunk can stay braced, then pull the rings back under control.'),
    ('Strength', 'Ring Body Saw', 'Core', 'Gymnastic rings', 'reps_only', '3', '6-12', 'available', 'core', 'intermediate', 'low', 'reps', 6, 12, false, 'Maintain a strong plank while gliding the body backward and forward.'),

    -- Gymnastic rings: holds, grip and skill.
    ('Skills/Calisthenics', 'Ring Support Hold', 'Push', 'Gymnastic rings', 'hold', '3-4', '10-30 sec', 'available', 'skill', 'intermediate', 'low', 'seconds', 10, 30, false, 'Hold a tall support with straight elbows and the rings kept close to the body.'),
    ('Skills/Calisthenics', 'Ring L-Sit Hold', 'Core', 'Gymnastic rings', 'hold', '3-4', '5-20 sec', 'available', 'skill', 'advanced', 'low', 'seconds', 5, 20, false, 'Use a tuck or straight-leg position and track each controlled hold.'),
    ('Grip', 'Ring False Grip Hang', 'Grip', 'Gymnastic rings', 'grip_hold', '3-4', '10-30 sec', 'available', 'grip', 'advanced', 'low', 'seconds', 10, 30, false, 'Hold the false grip with the wrist over the ring and track each attempt separately.'),
    ('Skills/Calisthenics', 'Ring Skin the Cat', 'Full Body', 'Gymnastic rings', 'reps_only', '3', '3-6', 'excluded', 'skill', 'advanced', 'low', 'reps', 3, 6, false, 'Move slowly through a comfortable shoulder range and stop before losing control.')
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
select person.id, changed.id, true, 'gym'
from changed
cross join public.people person
where person.status = 'active'
on conflict (person_id, exercise_id) do update
set
  is_enabled = true,
  location_scope = 'gym',
  updated_at = now();
