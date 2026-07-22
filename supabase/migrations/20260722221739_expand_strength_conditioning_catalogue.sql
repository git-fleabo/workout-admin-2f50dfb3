-- Expand the atomic Strength and Conditioning catalogue with circuit-ready movements.
-- Existing names are left untouched, and newly inserted movements are enabled for active people.
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
  notes,
  location_scope
) as (
  values
    -- Strength: bodyweight and no-equipment foundations.
    ('Strength', 'Bodyweight Squat', 'Lower Body', 'Bodyweight', 'reps_only', '3', '12-20', 'preferred', 'squat', 'beginner', 'low', 'reps', 12, 20, false, 'Control the descent and keep the whole foot grounded.', 'both'),
    ('Strength', 'Walking Lunge', 'Lower Body', 'Bodyweight', 'reps_only', '3', '8-12 / side', 'preferred', 'lunge', 'beginner', 'low', 'reps', 8, 12, true, 'Use a comfortable stride and track reps per side.', 'both'),
    ('Strength', 'Reverse Lunge', 'Lower Body', 'Bodyweight', 'reps_only', '3', '8-12 / side', 'preferred', 'lunge', 'beginner', 'low', 'reps', 8, 12, true, 'Step back under control and track reps per side.', 'both'),
    ('Strength', 'Lateral Lunge', 'Lower Body', 'Bodyweight', 'reps_only', '3', '6-10 / side', 'preferred', 'lunge', 'intermediate', 'low', 'reps', 6, 10, true, 'Sit into the working hip and keep the other leg long.', 'both'),
    ('Strength', 'Step-Up', 'Lower Body', 'Bodyweight', 'reps_only', '3', '8-12 / side', 'preferred', 'lunge', 'beginner', 'low', 'reps', 8, 12, true, 'Use a stable step and minimise assistance from the trailing leg.', 'both'),
    ('Strength', 'Glute Bridge', 'Lower Body', 'Bodyweight', 'reps_only', '3', '12-20', 'preferred', 'hinge', 'beginner', 'low', 'reps', 12, 20, false, 'Pause at full hip extension without overextending the lower back.', 'both'),
    ('Strength', 'Single-Leg Glute Bridge', 'Lower Body', 'Bodyweight', 'reps_only', '3', '8-12 / side', 'preferred', 'hinge', 'intermediate', 'low', 'reps', 8, 12, true, 'Keep the pelvis level and track reps per side.', 'both'),
    ('Strength', 'Calf Raise', 'Lower Body', 'Bodyweight', 'reps_only', '3', '12-20', 'preferred', 'squat', 'beginner', 'low', 'reps', 12, 20, false, 'Use a full controlled range and pause at the top.', 'both'),
    ('Strength', 'Wall Sit', 'Lower Body', 'Bodyweight', 'hold', '3', '20-45 sec', 'preferred', 'squat', 'beginner', 'low', 'seconds', 20, 45, false, 'Track each hold separately.', 'both'),
    ('Strength', 'Pike Push-Up', 'Push', 'Bodyweight', 'reps_only', '3', '6-12', 'preferred', 'push', 'intermediate', 'low', 'reps', 6, 12, false, 'Keep the hips high and lower the head between the hands.', 'both'),
    ('Strength', 'Diamond Push-Up', 'Push', 'Bodyweight', 'reps_only', '3', '6-15', 'preferred', 'push', 'intermediate', 'low', 'reps', 6, 15, false, 'Use a close hand position while keeping the shoulders comfortable.', 'both'),
    ('Strength', 'Side Plank', 'Core', 'Bodyweight', 'hold', '3', '20-40 sec / side', 'preferred', 'core', 'beginner', 'low', 'seconds', 20, 40, true, 'Track each side as a separate hold.', 'both'),
    ('Strength', 'Dead Bug', 'Core', 'Bodyweight', 'reps_only', '3', '6-10 / side', 'preferred', 'core', 'beginner', 'low', 'reps', 6, 10, true, 'Keep the lower back gently braced against the floor.', 'both'),
    ('Strength', 'Bird Dog', 'Core', 'Bodyweight', 'reps_only', '3', '6-10 / side', 'preferred', 'core', 'beginner', 'low', 'reps', 6, 10, true, 'Reach long without rotating the pelvis.', 'both'),
    ('Strength', 'Hollow Body Hold', 'Core', 'Bodyweight', 'hold', '3', '15-30 sec', 'preferred', 'core', 'intermediate', 'low', 'seconds', 15, 30, false, 'Choose a tuck or straight-leg position that preserves the hollow shape.', 'both'),
    ('Strength', 'Superman Hold', 'Posterior Chain', 'Bodyweight', 'hold', '3', '15-30 sec', 'preferred', 'hinge', 'beginner', 'low', 'seconds', 15, 30, false, 'Lift only as high as comfortable and keep the neck neutral.', 'both'),
    ('Strength', 'V-Up', 'Core', 'Bodyweight', 'reps_only', '3', '8-15', 'preferred', 'core', 'intermediate', 'low', 'reps', 8, 15, false, 'Use a controlled trunk curl rather than momentum.', 'both'),

    -- Strength: barbells and plates.
    ('Strength', 'Front Squat', 'Lower Body', 'Barbell', 'weight_reps', '3-5', '3-8', 'available', 'squat', 'intermediate', 'low', 'reps', 5, 8, false, 'Track barbell load, reps and RPE.', 'gym'),
    ('Strength', 'Low Bar Squat', 'Lower Body', 'Barbell', 'weight_reps', '3-5', '3-8', 'available', 'squat', 'intermediate', 'low', 'reps', 5, 8, false, 'Track barbell load, reps and RPE.', 'gym'),
    ('Strength', 'Romanian Deadlift', 'Lower Body', 'Barbell', 'weight_reps', '3-4', '6-10', 'available', 'hinge', 'intermediate', 'low', 'reps', 6, 10, false, 'Keep the bar close and stop at the deepest controlled hinge.', 'gym'),
    ('Strength', 'Barbell Hip Thrust', 'Lower Body', 'Barbell / Bench', 'weight_reps', '3-4', '6-12', 'available', 'hinge', 'intermediate', 'low', 'reps', 8, 12, false, 'Pause at full hip extension and track barbell load.', 'gym'),
    ('Strength', 'Barbell Overhead Press', 'Push', 'Barbell', 'weight_reps', '3-5', '4-10', 'available', 'push', 'intermediate', 'low', 'reps', 6, 10, false, 'Press from a stable standing position and track RPE.', 'gym'),
    ('Strength', 'Barbell Bent-Over Row', 'Pull', 'Barbell', 'weight_reps', '3-4', '6-12', 'available', 'pull', 'intermediate', 'low', 'reps', 6, 12, false, 'Keep the torso position consistent across reps.', 'gym'),
    ('Strength', 'Incline Bench Press', 'Push', 'Barbell / Bench', 'weight_reps', '3-4', '6-12', 'available', 'push', 'intermediate', 'low', 'reps', 6, 12, false, 'Track barbell load, bench angle and RPE.', 'gym'),
    ('Strength', 'Barbell Good Morning', 'Posterior Chain', 'Barbell', 'weight_reps', '3', '6-10', 'available', 'hinge', 'advanced', 'low', 'reps', 6, 10, false, 'Use a conservative load and controlled hip hinge.', 'gym'),

    -- Strength: dumbbells and kettlebells.
    ('Strength', 'Dumbbell Bench Press', 'Push', 'Dumbbell / Bench', 'weight_reps', '3-4', '6-12', 'preferred', 'push', 'beginner', 'low', 'reps', 8, 12, false, 'Track the weight of one dumbbell, reps and RPE.', 'both'),
    ('Strength', 'Incline Dumbbell Press', 'Push', 'Dumbbell / Bench', 'weight_reps', '3-4', '8-12', 'preferred', 'push', 'intermediate', 'low', 'reps', 8, 12, false, 'Track the weight of one dumbbell and bench angle.', 'both'),
    ('Strength', 'One-Arm Dumbbell Row', 'Pull', 'Dumbbell / Bench', 'weight_reps', '3-4', '8-12 / side', 'preferred', 'pull', 'beginner', 'low', 'reps', 8, 12, true, 'Track the dumbbell load and reps per side.', 'both'),
    ('Strength', 'Dumbbell Romanian Deadlift', 'Lower Body', 'Dumbbell', 'weight_reps', '3-4', '8-12', 'preferred', 'hinge', 'beginner', 'low', 'reps', 8, 12, false, 'Keep the dumbbells close and hinge through the hips.', 'both'),
    ('Strength', 'Dumbbell Step-Up', 'Lower Body', 'Dumbbell / Step', 'weight_reps', '3', '8-12 / side', 'preferred', 'lunge', 'intermediate', 'low', 'reps', 8, 12, true, 'Use a stable step and track load plus reps per side.', 'both'),
    ('Strength', 'Dumbbell Reverse Lunge', 'Lower Body', 'Dumbbell', 'weight_reps', '3', '8-12 / side', 'preferred', 'lunge', 'intermediate', 'low', 'reps', 8, 12, true, 'Track the combined dumbbell load and reps per side.', 'both'),
    ('Strength', 'Dumbbell Lateral Raise', 'Push', 'Dumbbell', 'weight_reps', '3', '10-15', 'available', 'push', 'beginner', 'low', 'reps', 10, 15, false, 'Use controlled reps and avoid shrugging the shoulders.', 'both'),
    ('Strength', 'Dumbbell Floor Press', 'Push', 'Dumbbell', 'weight_reps', '3-4', '8-12', 'preferred', 'push', 'beginner', 'low', 'reps', 8, 12, false, 'Pause the upper arms lightly on the floor between reps.', 'both'),
    ('Strength', 'Kettlebell Romanian Deadlift', 'Lower Body', 'Kettlebell', 'weight_reps', '3', '8-15', 'preferred', 'hinge', 'beginner', 'low', 'reps', 8, 15, false, 'Use one or two kettlebells and track the total load.', 'both'),
    ('Strength', 'Kettlebell Strict Press', 'Push', 'Kettlebell', 'weight_reps', '3', '6-10 / side', 'preferred', 'push', 'intermediate', 'low', 'reps', 6, 10, true, 'Press without leg drive and track reps per side.', 'both'),

    -- Strength: cables, machines, bands, suspension and landmine.
    ('Strength', 'Seated Cable Row', 'Pull', 'Cable machine', 'weight_reps', '3-4', '8-12', 'preferred', 'pull', 'beginner', 'low', 'reps', 8, 12, false, 'Keep the torso stable and track the selected stack weight.', 'gym'),
    ('Strength', 'Cable Face Pull', 'Pull', 'Cable machine / Rope', 'weight_reps', '3', '10-15', 'preferred', 'pull', 'beginner', 'low', 'reps', 10, 15, false, 'Pull toward the face with controlled shoulder rotation.', 'gym'),
    ('Strength', 'Cable Chest Press', 'Push', 'Cable machine', 'weight_reps', '3', '8-12', 'preferred', 'push', 'beginner', 'low', 'reps', 8, 12, false, 'Use a split stance and keep the cable path controlled.', 'gym'),
    ('Strength', 'Cable Woodchop', 'Core', 'Cable machine', 'weight_reps', '3', '8-12 / side', 'preferred', 'core', 'intermediate', 'low', 'reps', 8, 12, true, 'Rotate through the trunk and hips under control.', 'gym'),
    ('Strength', 'Cable Pallof Press', 'Core', 'Cable machine', 'weight_reps', '3', '8-12 / side', 'preferred', 'core', 'beginner', 'low', 'reps', 8, 12, true, 'Resist rotation and pause with the arms extended.', 'gym'),
    ('Strength', 'Triceps Pushdown', 'Push', 'Cable machine', 'weight_reps', '3', '8-15', 'available', 'push', 'beginner', 'low', 'reps', 10, 15, false, 'Keep the upper arms still and use a full comfortable range.', 'gym'),
    ('Strength', 'Leg Press', 'Lower Body', 'Leg press machine', 'weight_reps', '3-4', '8-15', 'available', 'squat', 'beginner', 'low', 'reps', 10, 15, false, 'Track machine load, foot position and RPE.', 'gym'),
    ('Strength', 'Leg Extension', 'Lower Body', 'Leg extension machine', 'weight_reps', '3', '10-15', 'available', 'squat', 'beginner', 'low', 'reps', 10, 15, false, 'Use a controlled range and track the machine setting.', 'gym'),
    ('Strength', 'Seated Leg Curl', 'Lower Body', 'Leg curl machine', 'weight_reps', '3', '8-15', 'available', 'hinge', 'beginner', 'low', 'reps', 10, 15, false, 'Control both the curl and return.', 'gym'),
    ('Strength', 'Chest Press Machine', 'Push', 'Chest press machine', 'weight_reps', '3', '8-12', 'available', 'push', 'beginner', 'low', 'reps', 8, 12, false, 'Track machine load, seat setting and RPE.', 'gym'),
    ('Strength', 'Assisted Pull-Up Machine', 'Pull', 'Assisted pull-up machine', 'weight_reps', '3', '6-12', 'available', 'pull', 'beginner', 'low', 'reps', 6, 12, false, 'Record assistance weight; lower assistance is harder.', 'gym'),
    ('Strength', 'Band Row', 'Pull', 'Resistance band', 'reps_only', '3', '10-20', 'preferred', 'pull', 'beginner', 'low', 'reps', 10, 20, false, 'Record band colour or resistance in notes.', 'both'),
    ('Strength', 'Band Pull-Apart', 'Pull', 'Resistance band', 'reps_only', '3', '12-20', 'preferred', 'pull', 'beginner', 'low', 'reps', 12, 20, false, 'Keep the ribs down and record band resistance.', 'both'),
    ('Strength', 'Banded Good Morning', 'Posterior Chain', 'Resistance band', 'reps_only', '3', '10-20', 'preferred', 'hinge', 'beginner', 'low', 'reps', 10, 20, false, 'Hinge through the hips and keep the spine controlled.', 'both'),
    ('Strength', 'Banded Lateral Walk', 'Lower Body', 'Resistance band', 'reps_only', '3', '8-15 / side', 'preferred', 'lunge', 'beginner', 'low', 'reps', 8, 15, true, 'Keep band tension throughout and track steps per side.', 'both'),
    ('Strength', 'TRX Row', 'Pull', 'TRX', 'reps_only', '3', '8-15', 'preferred', 'pull', 'beginner', 'low', 'reps', 8, 15, false, 'Adjust foot position to scale difficulty.', 'gym'),
    ('Strength', 'TRX Chest Press', 'Push', 'TRX', 'reps_only', '3', '8-15', 'preferred', 'push', 'intermediate', 'low', 'reps', 8, 15, false, 'Maintain a rigid body line and adjust the angle to scale.', 'gym'),
    ('Strength', 'Landmine Press', 'Push', 'Landmine / Barbell', 'weight_reps', '3', '8-12 / side', 'preferred', 'push', 'intermediate', 'low', 'reps', 8, 12, true, 'Track added plate load and reps per side.', 'gym'),
    ('Strength', 'Landmine Row', 'Pull', 'Landmine / Barbell', 'weight_reps', '3', '8-12', 'preferred', 'pull', 'intermediate', 'low', 'reps', 8, 12, false, 'Keep the torso stable and track added plate load.', 'gym'),
    ('Strength', 'Landmine Squat', 'Lower Body', 'Landmine / Barbell', 'weight_reps', '3', '8-15', 'preferred', 'squat', 'beginner', 'low', 'reps', 8, 15, false, 'Hold the bar end securely and track added plate load.', 'gym'),

    -- Conditioning: no-equipment locomotion and full-body work.
    ('Conditioning', 'Burpee', 'Full Body', 'Bodyweight', 'reps_only', '3-5', '6-12', 'preferred', 'full_body', 'intermediate', 'high', 'reps', 6, 12, false, 'Scale the jump or step-back as needed.', 'both'),
    ('Conditioning', 'Squat Thrust', 'Full Body', 'Bodyweight', 'reps_only', '3-5', '8-15', 'preferred', 'full_body', 'beginner', 'moderate', 'reps', 8, 15, false, 'A low-impact burpee variation without the jump.', 'both'),
    ('Conditioning', 'Jumping Jack', 'Full Body', 'Bodyweight', 'reps_only', '3-5', '20-40', 'preferred', 'locomotion', 'beginner', 'moderate', 'reps', 20, 40, false, 'Use light, rhythmic contacts and scale to step jacks if needed.', 'both'),
    ('Conditioning', 'High Knees', 'Full Body', 'Bodyweight', 'duration', '4', '20-40 sec', 'preferred', 'locomotion', 'beginner', 'high', 'seconds', 20, 40, false, 'Track each timed interval and keep posture tall.', 'both'),
    ('Conditioning', 'Mountain Climber', 'Full Body', 'Bodyweight', 'duration', '4', '20-40 sec', 'preferred', 'full_body', 'beginner', 'moderate', 'seconds', 20, 40, false, 'Keep the shoulders over the hands during each interval.', 'both'),
    ('Conditioning', 'Bear Crawl', 'Full Body', 'Bodyweight', 'distance_time', '4', '10-20 m', 'preferred', 'locomotion', 'intermediate', 'low', 'metres', 10, 20, false, 'Move with opposite hand and foot while keeping the knees low.', 'both'),
    ('Conditioning', 'Crab Walk', 'Full Body', 'Bodyweight', 'distance_time', '4', '10-20 m', 'preferred', 'locomotion', 'beginner', 'low', 'metres', 10, 20, false, 'Keep the hips lifted and move under control.', 'both'),
    ('Conditioning', 'Inchworm', 'Full Body', 'Bodyweight', 'reps_only', '3-4', '6-10', 'preferred', 'full_body', 'beginner', 'low', 'reps', 6, 10, false, 'Walk the hands to a strong plank and return with control.', 'both'),
    ('Conditioning', 'Skater Hop', 'Lower Body', 'Bodyweight', 'power', '3-5', '6-10 / side', 'preferred', 'power', 'intermediate', 'high', 'reps', 6, 10, true, 'Stick each lateral landing before the next hop.', 'both'),
    ('Conditioning', 'Broad Jump', 'Lower Body', 'Bodyweight', 'power', '3-5', '3-6', 'preferred', 'power', 'intermediate', 'high', 'reps', 3, 6, false, 'Prioritise landing quality over distance.', 'both'),
    ('Conditioning', 'Shuttle Run', 'Full Body', 'Bodyweight', 'distance_time', '4-8', '20-40 m', 'preferred', 'locomotion', 'intermediate', 'high', 'metres', 20, 40, false, 'Track shuttle distance, interval time and RPE.', 'both'),

    -- Conditioning: portable and cardio equipment.
    ('Conditioning', 'Jump Rope', 'Full Body', 'Jump rope', 'duration', '4-6', '30-60 sec', 'preferred', 'locomotion', 'beginner', 'moderate', 'seconds', 30, 60, false, 'Track each interval; record single- or double-under style in notes.', 'both'),
    ('Conditioning', 'Battle Ropes', 'Full Body', 'Battle ropes', 'duration', '4-6', '20-40 sec', 'preferred', 'full_body', 'beginner', 'moderate', 'seconds', 20, 40, false, 'Track work intervals and rope pattern.', 'gym'),
    ('Conditioning', 'Air Bike', 'Full Body', 'Air bike', 'distance_time', '4-8', '20-60 sec', 'preferred', 'locomotion', 'beginner', 'moderate', 'seconds', 20, 60, false, 'Track interval time, calories or distance and RPE.', 'gym'),
    ('Conditioning', 'SkiErg', 'Full Body', 'SkiErg', 'distance_time', '4-8', '30-60 sec', 'preferred', 'locomotion', 'intermediate', 'moderate', 'seconds', 30, 60, false, 'Track interval time, distance and RPE.', 'gym'),
    ('Conditioning', 'Row Erg Sprint', 'Full Body', 'Rower', 'distance_time', '4-8', '20-60 sec', 'preferred', 'locomotion', 'intermediate', 'moderate', 'seconds', 20, 60, false, 'Track interval time, distance and stroke rate where useful.', 'gym'),
    ('Conditioning', 'Heavy Bag Punches', 'Full Body', 'Heavy bag / Gloves', 'duration', '4-8', '30-60 sec', 'preferred', 'full_body', 'intermediate', 'moderate', 'seconds', 30, 60, false, 'Track each work interval and combination focus.', 'gym'),

    -- Conditioning: loaded full-body and power movements.
    ('Conditioning', 'Dumbbell Thruster', 'Full Body', 'Dumbbell', 'weight_reps', '3-5', '6-12', 'preferred', 'full_body', 'intermediate', 'moderate', 'reps', 6, 12, false, 'Use a smooth squat-to-press and track total dumbbell load.', 'both'),
    ('Conditioning', 'Dumbbell Snatch', 'Full Body', 'Dumbbell', 'weight_reps', '3-5', '6-10 / side', 'preferred', 'power', 'intermediate', 'moderate', 'reps', 6, 10, true, 'Track load and reps per side.', 'both'),
    ('Conditioning', 'Devil Press', 'Full Body', 'Dumbbell', 'weight_reps', '3-5', '5-10', 'preferred', 'full_body', 'advanced', 'high', 'reps', 5, 10, false, 'Combine a controlled burpee with a two-dumbbell ground-to-overhead.', 'both'),
    ('Conditioning', 'Renegade Row', 'Full Body', 'Dumbbell', 'weight_reps', '3-4', '6-10 / side', 'preferred', 'full_body', 'advanced', 'low', 'reps', 6, 10, true, 'Keep the pelvis stable and track rows per side.', 'both'),
    ('Conditioning', 'Kettlebell High Pull', 'Full Body', 'Kettlebell', 'weight_reps', '3-5', '8-12', 'preferred', 'hinge', 'intermediate', 'moderate', 'reps', 8, 12, false, 'Drive from the hips and keep the kettlebell close.', 'both'),
    ('Conditioning', 'Kettlebell Push Press', 'Full Body', 'Kettlebell', 'weight_reps', '3-5', '6-10 / side', 'preferred', 'full_body', 'intermediate', 'moderate', 'reps', 6, 10, true, 'Use controlled leg drive and track reps per side.', 'both'),
    ('Conditioning', 'Kettlebell Thruster', 'Full Body', 'Kettlebell', 'weight_reps', '3-5', '6-10', 'preferred', 'full_body', 'intermediate', 'moderate', 'reps', 6, 10, false, 'Move smoothly from the squat into the press.', 'both'),
    ('Conditioning', 'Barbell Push Press', 'Full Body', 'Barbell', 'weight_reps', '3-5', '5-10', 'available', 'power', 'intermediate', 'moderate', 'reps', 5, 10, false, 'Use a shallow dip and drive while keeping the bar path controlled.', 'gym'),
    ('Conditioning', 'Barbell Thruster', 'Full Body', 'Barbell', 'weight_reps', '3-5', '5-10', 'available', 'full_body', 'advanced', 'moderate', 'reps', 5, 10, false, 'Choose a load that permits an unbroken squat-to-press rhythm.', 'gym'),
    ('Conditioning', 'Hang Power Clean', 'Full Body', 'Barbell', 'power', '4-6', '2-5', 'available', 'power', 'advanced', 'moderate', 'reps', 3, 5, false, 'Prioritise technique and bar speed over fatigue.', 'gym'),
    ('Conditioning', 'Power Clean', 'Full Body', 'Barbell', 'power', '4-6', '2-5', 'available', 'power', 'advanced', 'moderate', 'reps', 3, 5, false, 'Prioritise technique and bar speed over conditioning density.', 'gym'),
    ('Conditioning', 'Power Snatch', 'Full Body', 'Barbell', 'power', '4-6', '2-5', 'available', 'power', 'advanced', 'moderate', 'reps', 3, 5, false, 'Use only when technique is reliable under the planned fatigue.', 'gym'),
    ('Conditioning', 'Medicine Ball Slam', 'Full Body', 'Medicine ball', 'power', '3-5', '8-15', 'preferred', 'power', 'beginner', 'moderate', 'reps', 8, 15, false, 'Reach tall before each forceful slam and reset safely.', 'gym'),
    ('Conditioning', 'Wall Ball', 'Full Body', 'Medicine ball / Wall target', 'weight_reps', '3-5', '10-20', 'preferred', 'full_body', 'intermediate', 'moderate', 'reps', 10, 20, false, 'Track ball weight, target height and reps.', 'gym'),
    ('Conditioning', 'Medicine Ball Rotational Throw', 'Full Body', 'Medicine ball / Wall', 'power', '3-5', '6-10 / side', 'preferred', 'power', 'intermediate', 'moderate', 'reps', 6, 10, true, 'Rotate through the hips and track throws per side.', 'gym'),
    ('Conditioning', 'Sled Drag', 'Full Body', 'Sled', 'carry', '4-6', '20-40 m', 'preferred', 'locomotion', 'beginner', 'low', 'metres', 20, 40, false, 'Track sled load, distance and drag direction.', 'gym'),
    ('Conditioning', 'Sandbag Carry', 'Full Body', 'Sandbag', 'carry', '3-5', '20-40 m', 'preferred', 'carry', 'beginner', 'low', 'metres', 20, 40, false, 'Record bag weight, carry position and distance.', 'gym'),
    ('Conditioning', 'Sandbag Clean', 'Full Body', 'Sandbag', 'weight_reps', '3-5', '5-10', 'preferred', 'full_body', 'intermediate', 'moderate', 'reps', 5, 10, false, 'Reset the bag safely and track load plus reps.', 'gym'),
    ('Conditioning', 'Sandbag Shouldering', 'Full Body', 'Sandbag', 'weight_reps', '3-5', '4-8 / side', 'preferred', 'full_body', 'intermediate', 'moderate', 'reps', 4, 8, true, 'Alternate shoulders or track reps per side.', 'gym'),
    ('Conditioning', 'Sandbag Bear-Hug Squat', 'Lower Body', 'Sandbag', 'weight_reps', '3-5', '8-15', 'preferred', 'squat', 'beginner', 'low', 'reps', 8, 15, false, 'Keep the bag close to the torso throughout.', 'gym'),
    ('Conditioning', 'Tire Flip', 'Full Body', 'Tyre', 'weight_reps', '3-5', '3-8', 'available', 'full_body', 'advanced', 'moderate', 'reps', 3, 8, false, 'Use a suitable tyre and safe lifting position.', 'gym'),
    ('Conditioning', 'Plate Ground-to-Overhead', 'Full Body', 'Weight plate', 'weight_reps', '3-5', '8-15', 'preferred', 'full_body', 'intermediate', 'moderate', 'reps', 8, 15, false, 'Keep the plate close and finish in a stable overhead position.', 'gym'),
    ('Conditioning', 'Plate Overhead Carry', 'Full Body', 'Weight plate', 'carry', '3-5', '15-30 m', 'preferred', 'carry', 'intermediate', 'low', 'metres', 15, 30, false, 'Maintain a stacked overhead position and record plate load.', 'gym')
),
typed as (
  select desired.*, activity.id as activity_type_id
  from desired
  join public.activity_types activity on activity.name = desired.type_name
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
)
insert into public.person_exercises (person_id, exercise_id, is_enabled, location_scope)
select person.id, inserted.id, true, numbered.location_scope
from inserted
join numbered on lower(numbered.name) = lower(inserted.name)
cross join public.people person
where person.status = 'active'
on conflict (person_id, exercise_id) do nothing;
