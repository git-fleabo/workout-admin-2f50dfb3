-- Raise the protected 12-week template to an Operator-inspired loading pattern.
-- Existing assignments keep their training maxes, mappings, dates, reviews, and
-- completed history; only the shared template for upcoming sessions is changed.

update public.programs
set description = 'Three-day, Operator-inspired strength block using two six-week waves. Base work never falls below 80% of the training max: 80-85% weeks use sets of five and 90% weeks use triples. RPE, technique, pain, and manual review can still reduce or increase future sessions when needed.',
    default_set_choice = 'maximum',
    updated_at = now()
where name = 'Adaptive Strength 12-Week Block'
  and method_type = 'adaptive_strength_12_week';

with target_program as (
  select id
  from public.programs
  where name = 'Adaptive Strength 12-Week Block'
    and method_type = 'adaptive_strength_12_week'
),
wave as (
  select *
  from (values
    (1,  80::numeric, 5, 8.0::numeric, 'Wave 1 · volume'),
    (2,  82.5,        5, 8.0,          'Wave 1 · build'),
    (3,  90,          3, 8.5,          'Wave 1 · heavy triples'),
    (4,  80,          5, 8.0,          'Wave 1 · volume'),
    (5,  82.5,        5, 8.0,          'Wave 1 · build'),
    (6,  90,          3, 8.5,          'Wave 1 · heavy triples'),
    (7,  80,          5, 8.0,          'Wave 2 · volume'),
    (8,  85,          5, 8.5,          'Wave 2 · build'),
    (9,  90,          3, 8.5,          'Wave 2 · heavy triples'),
    (10, 80,          5, 8.0,          'Wave 2 · volume'),
    (11, 85,          5, 8.5,          'Wave 2 · build'),
    (12, 90,          3, 8.5,          'Wave 2 · heavy triples')
  ) as values_table(week_number, base_percent, reps, rpe_cap, phase_label)
)
update public.program_workouts workout
set name = case workout.session_number
      when 1 then 'Monday · Strength A'
      when 2 then 'Wednesday · Strength B'
      else 'Friday · Bench and athleticism'
    end,
    description = wave.phase_label || ': ' ||
      case
        when wave.reps = 3 then '3-4 sets of 3 at 90%; heavy, crisp, and never a grinder.'
        else '3-5 sets of 5 at ' || wave.base_percent::text || '%; complete the prescribed upper set target while staying under the RPE cap.'
      end,
    updated_at = now()
from target_program, wave
where workout.program_id = target_program.id
  and workout.week_number = wave.week_number;

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
prescriptions as (
  select
    entry.id,
    workout.session_number,
    entry.slot_key,
    wave.base_percent,
    wave.reps,
    wave.rpe_cap,
    case
      when entry.slot_key = 'deadlift' then case when wave.reps = 3 then 3 else 4 end
      when workout.session_number = 3 then case when wave.reps = 3 then 3 else 4 end
      when wave.reps = 3 then 4
      when wave.base_percent = 80 then 5
      else 4
    end as max_sets
  from public.program_workout_entries entry
  join public.program_workouts workout on workout.id = entry.program_workout_id
  join target_program on target_program.id = workout.program_id
  join wave on wave.week_number = workout.week_number
  where entry.slot_key is not null
)
update public.program_workout_entries entry
set name = case
      when prescriptions.session_number = 3 and prescriptions.slot_key = 'bench_press'
        then 'Bench Press · second exposure'
      else entry.name
    end,
    sets = '3-' || prescriptions.max_sets::text,
    reps = prescriptions.reps::text,
    min_sets = 3,
    max_sets = prescriptions.max_sets,
    min_reps = prescriptions.reps,
    max_reps = prescriptions.reps,
    intensity_percent = prescriptions.base_percent,
    intensity_min_percent = prescriptions.base_percent,
    intensity_max_percent = least(95::numeric, prescriptions.base_percent + 5),
    percent_base = 'training_max',
    rpe = 'Cap ' || prescriptions.rpe_cap::text,
    rpe_cap = prescriptions.rpe_cap,
    rest = case when prescriptions.reps = 3 then '4-5 min' else '3-5 min' end,
    notes = case prescriptions.slot_key
      when 'bench_press' then
        case when prescriptions.session_number = 3
          then 'Second bench exposure. Keep every rep technically clean; stop adding sets when the RPE cap is reached.'
          else 'Complete the upper set target while reps remain crisp. Stop adding sets when the RPE cap is reached.'
        end
      when 'high_bar_squat' then 'The training max remains deliberately conservative. Complete the upper set target only while depth, position, and bar speed stay consistent.'
      when 'deadlift' then 'The training max remains deliberately conservative. Deadlift volume is capped one set lower to manage fatigue; no grinders.'
      when 'seated_dumbbell_press' then 'Training max and prescribed load are per dumbbell. Stop adding sets when the RPE cap is reached.'
      when 'weighted_pull_up' then 'Optional and disabled by default. Reintroduce only by explicit choice and stop at the RPE cap.'
      else entry.notes
    end,
    updated_at = now()
from prescriptions
where entry.id = prescriptions.id;

