alter table public.exercises
  add column circuit_suitability text not null default 'available',
  add column circuit_pattern text not null default 'other',
  add column circuit_difficulty text not null default 'intermediate',
  add column circuit_impact text not null default 'low',
  add column circuit_dose_mode text not null default 'reps',
  add column circuit_dose_min numeric,
  add column circuit_dose_max numeric,
  add column circuit_dose_per_side boolean not null default false;

alter table public.exercises
  add constraint exercises_circuit_suitability_check
    check (circuit_suitability in ('preferred', 'available', 'excluded')),
  add constraint exercises_circuit_pattern_check
    check (
      circuit_pattern in (
        'push',
        'pull',
        'squat',
        'hinge',
        'lunge',
        'carry',
        'core',
        'locomotion',
        'mobility',
        'power',
        'grip',
        'full_body',
        'skill',
        'other'
      )
    ),
  add constraint exercises_circuit_difficulty_check
    check (circuit_difficulty in ('beginner', 'intermediate', 'advanced')),
  add constraint exercises_circuit_impact_check
    check (circuit_impact in ('low', 'moderate', 'high')),
  add constraint exercises_circuit_dose_mode_check
    check (circuit_dose_mode in ('reps', 'seconds', 'metres', 'rounds')),
  add constraint exercises_circuit_dose_min_check
    check (circuit_dose_min is null or circuit_dose_min > 0),
  add constraint exercises_circuit_dose_max_check
    check (circuit_dose_max is null or circuit_dose_max > 0),
  add constraint exercises_circuit_dose_range_check
    check (
      circuit_dose_min is null
      or circuit_dose_max is null
      or circuit_dose_max >= circuit_dose_min
    );

with classified as (
  select
    exercise.id,
    exercise.name,
    exercise.default_metric,
    coalesce(activity.slug, '') as activity_slug
  from public.exercises exercise
  left join public.activity_types activity on activity.id = exercise.activity_type_id
)
update public.exercises exercise
set
  circuit_suitability = case
    when classified.activity_slug in ('class', 'climbing', 'yoga', 'other')
      or classified.name in (
        'Intervals',
        'Mobility Circuit',
        'Stretch Session',
        'Kettlebell Complex',
        'Kettlebell EMOM',
        'Other'
      ) then 'excluded'
    when classified.name in (
      'Front Rack Reverse Lunge',
      'Goblet Squat',
      'Kettlebell Clean & Press',
      'Kettlebell Halo',
      'Plank',
      'Pull-Up',
      'Chin-Up',
      'Pushups',
      'Single-Arm Kettlebell Row',
      'Suitcase Carry',
      'TRX Body Saw',
      'Farmer Carry',
      'ATG Squats',
      'Box Jumps',
      'Kettlebell Clean',
      'Kettlebell Snatch',
      'Kettlebell Swing',
      'Kettlebell Windmill',
      'Sled Push/Pull'
    ) then 'preferred'
    else 'available'
  end,
  circuit_pattern = case
    when classified.name in (
      'Bench Press',
      'Seated DB Shoulder Press',
      '1-Arm Pushups',
      'Handstand Pushups',
      'Pushups'
    ) then 'push'
    when classified.name in (
      'Chin-Up',
      'Lat Pulldown',
      'Pull-Up',
      'Single-Arm Kettlebell Row',
      'Weighted Pull-Up'
    ) then 'pull'
    when classified.name in ('Goblet Squat', 'High Bar Squat', 'ATG Squats', 'Pistol Squat')
      then 'squat'
    when classified.name in (
      'Deadlift',
      'Kettlebell Clean',
      'Kettlebell Snatch',
      'Kettlebell Swing'
    ) then 'hinge'
    when classified.name in ('Bulgarian Split Squat', 'Front Rack Reverse Lunge') then 'lunge'
    when classified.name in ('Suitcase Carry', 'Farmer Carry') then 'carry'
    when classified.name in (
      'Hanging Leg Raise',
      'Kettlebell Halo',
      'Plank',
      'TRX Body Saw',
      'L-Sit',
      'Kettlebell Windmill'
    ) then 'core'
    when classified.name in ('Bike', 'Intervals', 'Jog', 'Row', 'Run', 'Sprint')
      then 'locomotion'
    when classified.activity_slug in ('mobility-flexibility', 'yoga') then 'mobility'
    when classified.name = 'Box Jumps' then 'power'
    when classified.activity_slug = 'grip' then 'grip'
    when classified.name in (
      'Kettlebell Clean & Press',
      'Turkish Get-Up',
      'Bar Muscle-Up',
      'Ring Muscle-Up',
      'Kettlebell Complex',
      'Kettlebell EMOM',
      'Sled Push/Pull'
    ) then 'full_body'
    when classified.activity_slug = 'skills-calisthenics' then 'skill'
    else 'other'
  end,
  circuit_difficulty = case
    when classified.name in (
      '1-Arm Pushups',
      'Back Lever',
      'Bar Muscle-Up',
      'Front Lever',
      'Handstand Pushups',
      'Human Flag',
      'Pistol Squat',
      'Planche',
      'Ring Muscle-Up',
      'Turkish Get-Up',
      'Kettlebell Snatch'
    ) then 'advanced'
    when classified.name in (
      'Bike',
      'Dead Hang',
      'Farmer Carry',
      'Goblet Squat',
      'Jog',
      'Kettlebell Halo',
      'Plank',
      'Pushups',
      'Row',
      'Run',
      'Suitcase Carry'
    ) or classified.activity_slug in ('mobility-flexibility', 'yoga') then 'beginner'
    else 'intermediate'
  end,
  circuit_impact = case
    when classified.name in ('Box Jumps', 'Sprint') then 'high'
    when classified.name in (
      'Bar Muscle-Up',
      'Bike',
      'Jog',
      'Kettlebell Clean',
      'Kettlebell Clean & Press',
      'Kettlebell Snatch',
      'Kettlebell Swing',
      'Ring Muscle-Up',
      'Row',
      'Run',
      'Sled Push/Pull'
    ) then 'moderate'
    else 'low'
  end,
  circuit_dose_mode = case
    when classified.name = 'Wrist Roller' then 'rounds'
    when classified.default_metric = 'carry' then 'metres'
    when classified.default_metric in (
      'hold',
      'grip_hold',
      'distance_time',
      'duration',
      'conditioning',
      'mobility_position',
      'climbing'
    ) then 'seconds'
    else 'reps'
  end,
  circuit_dose_min = case
    when classified.name = 'Turkish Get-Up' then 1
    when classified.name = 'Wrist Roller' then 1
    when classified.name = 'Box Jumps' then 3
    when classified.name = 'Plank' then 30
    when classified.name in ('Suitcase Carry', 'Farmer Carry') then 20
    when classified.default_metric in ('hold', 'grip_hold') then 15
    when classified.default_metric in (
      'distance_time',
      'duration',
      'conditioning',
      'mobility_position',
      'climbing'
    ) then 30
    when classified.name in ('Kettlebell Swing', 'Pushups') then 10
    else 6
  end,
  circuit_dose_max = case
    when classified.name = 'Turkish Get-Up' then 3
    when classified.name = 'Wrist Roller' then 3
    when classified.name = 'Box Jumps' then 5
    when classified.name = 'Plank' then 45
    when classified.name in ('Suitcase Carry', 'Farmer Carry') then 40
    when classified.default_metric in ('hold', 'grip_hold') then 30
    when classified.default_metric in (
      'distance_time',
      'duration',
      'conditioning',
      'mobility_position',
      'climbing'
    ) then 60
    when classified.name in ('Kettlebell Swing', 'Pushups') then 20
    else 10
  end,
  circuit_dose_per_side = classified.name in (
    '1-Arm Hang',
    'Bulgarian Split Squat',
    'Front Rack Reverse Lunge',
    'Kettlebell Clean',
    'Kettlebell Clean & Press',
    'Kettlebell Snatch',
    'Kettlebell Windmill',
    'Single-Arm Kettlebell Row',
    'Suitcase Carry',
    'Turkish Get-Up'
  )
from classified
where classified.id = exercise.id;

comment on column public.exercises.circuit_suitability is
  'Whether the deterministic circuit builder should prefer, allow, or exclude this movement.';
comment on column public.exercises.circuit_pattern is
  'Primary movement pattern used to balance generated circuits.';
comment on column public.exercises.circuit_difficulty is
  'Coarse skill/load complexity used by circuit intensity and readiness filters.';
comment on column public.exercises.circuit_impact is
  'Coarse impact level used by low-impact and recovery circuit filters.';
comment on column public.exercises.circuit_dose_mode is
  'Unit used for the default per-round circuit target.';
