update public.exercises exercise
set default_metric = case
  when activity.name = 'Climbing'
    or exercise.default_metric ilike '%boulder%'
    or exercise.default_metric ilike '%route%'
    or exercise.default_metric ilike '%grade%'
    then 'climbing'
  when exercise.name = 'Box Jumps' or exercise.default_metric ilike '%height%'
    then 'power'
  when exercise.name = 'ATG Squats'
    then 'weight_reps'
  when exercise.name in ('Farmer Carry', 'Suitcase Carry')
    then 'carry'
  when exercise.name in ('Front Split', 'Side Split', 'Pancake', 'Pike', 'Bridge', 'Shoulder Flexion')
    or exercise.default_metric ilike '%distance / hold%'
    then 'mobility_position'
  when activity.name = 'Grip' and exercise.default_metric ilike '%hold%'
    then 'grip_hold'
  when exercise.name in ('Plank', 'Front Lever', 'Back Lever', 'Handstand', 'Human Flag', 'L-Sit', 'Planche')
    or exercise.default_metric ilike '%hold%'
    then 'hold'
  when exercise.default_metric ilike '%load%' and exercise.default_metric ilike '%rep%'
    then 'weight_reps'
  when exercise.default_metric in ('Reps', 'Rep')
    then 'reps_only'
  when exercise.default_metric ilike '%round%'
    then 'conditioning'
  when exercise.default_metric ilike '%distance%' and exercise.default_metric ilike '%time%'
    then 'distance_time'
  when exercise.default_metric in ('Minutes', 'Duration', 'Time') and activity.name = 'Conditioning'
    then 'conditioning'
  when exercise.default_metric in ('Minutes', 'Duration', 'Time')
    then 'duration'
  when exercise.default_metric = 'Weight x reps'
    then 'weight_reps'
  else exercise.default_metric
end
from public.activity_types activity
where activity.id = exercise.activity_type_id
  and exercise.default_metric not in (
    'weight_reps',
    'reps_only',
    'hold',
    'grip_hold',
    'distance_time',
    'duration',
    'conditioning',
    'carry',
    'mobility_position',
    'power',
    'climbing'
  );
