-- Import the 12-week JACKED dumbbell calendar as a direct programme template.
-- The source uses dynamic ignitor-set paths and box scores, so work sets load as
-- editable rows and retain a concise reminder to follow the licensed source prescription.

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
  'JACKED Dumbbell Programme',
  'Twelve-week dumbbell programme with single-muscle, push/pull/legs, total-body, corrective and challenge phases. Loads and volume are autoregulated from the source programme''s ignitor-set paths and box scores.',
  true,
  'jacked_dumbbell',
  12,
  6,
  'minimum',
  null,
  null
where not exists (
  select 1 from public.programs where name = 'JACKED Dumbbell Programme'
);

update public.programs
set description = 'Twelve-week dumbbell programme with single-muscle, push/pull/legs, total-body, corrective and challenge phases. Loads and volume are autoregulated from the source programme''s ignitor-set paths and box scores.',
    is_template = true,
    method_type = 'jacked_dumbbell',
    duration_weeks = 12,
    sessions_per_week = 6,
    default_set_choice = 'minimum',
    percent_base = null,
    rounding_increment = null,
    updated_at = now()
where name = 'JACKED Dumbbell Programme';

with desired_workouts (week_number, day_number, name, phase_name, template_key) as (
  values
    (1, 1, 'Chest A', 'Phase 1', 'p1_chest_a'),
    (1, 2, 'Back A', 'Phase 1', 'p1_back_a'),
    (1, 3, 'Triceps A', 'Phase 1', 'p1_triceps_a'),
    (1, 4, 'Legs A', 'Phase 1', 'p1_legs_a'),
    (1, 5, 'Shoulders A', 'Phase 1', 'p1_shoulders_a'),
    (1, 6, 'Biceps A', 'Phase 1', 'p1_biceps_a'),
    (2, 1, 'Chest B', 'Phase 1', 'p1_chest_b'),
    (2, 2, 'Back B', 'Phase 1', 'p1_back_b'),
    (2, 3, 'Triceps B', 'Phase 1', 'p1_triceps_b'),
    (2, 4, 'Legs B', 'Phase 1', 'p1_legs_b'),
    (2, 5, 'Shoulders B', 'Phase 1', 'p1_shoulders_b'),
    (2, 6, 'Biceps B', 'Phase 1', 'p1_biceps_b'),
    (3, 1, 'Chest A · Beat Your Totals', 'Phase 1', 'p1_chest_a'),
    (3, 2, 'Back A · Beat Your Totals', 'Phase 1', 'p1_back_a'),
    (3, 3, 'Triceps A · Beat Your Totals', 'Phase 1', 'p1_triceps_a'),
    (3, 4, 'Legs A · Beat Your Totals', 'Phase 1', 'p1_legs_a'),
    (3, 5, 'Shoulders A · Beat Your Totals', 'Phase 1', 'p1_shoulders_a'),
    (3, 6, 'Biceps A · Beat Your Totals', 'Phase 1', 'p1_biceps_a'),
    (4, 1, 'Chest B · Beat Your Totals', 'Phase 1', 'p1_chest_b'),
    (4, 2, 'Back B · Beat Your Totals', 'Phase 1', 'p1_back_b'),
    (4, 3, 'Triceps B · Beat Your Totals', 'Phase 1', 'p1_triceps_b'),
    (4, 4, 'Legs B · Beat Your Totals', 'Phase 1', 'p1_legs_b'),
    (4, 5, 'Shoulders B · Beat Your Totals', 'Phase 1', 'p1_shoulders_b'),
    (4, 6, 'Biceps B · Beat Your Totals', 'Phase 1', 'p1_biceps_b'),
    (5, 1, 'Pull A', 'Phase 2', 'p2_pull_a'),
    (5, 2, 'Push A', 'Phase 2', 'p2_push_a'),
    (5, 3, 'Legs A', 'Phase 2', 'p2_legs_a'),
    (5, 5, 'Pull B', 'Phase 2', 'p2_pull_b'),
    (5, 6, 'Push B', 'Phase 2', 'p2_push_b'),
    (5, 7, 'Legs B', 'Phase 2', 'p2_legs_b'),
    (6, 2, 'Pull C', 'Phase 2', 'p2_pull_c'),
    (6, 3, 'Push C', 'Phase 2', 'p2_push_c'),
    (6, 4, 'Legs C', 'Phase 2', 'p2_legs_c'),
    (6, 6, 'Pull A', 'Phase 2', 'p2_pull_a'),
    (6, 7, 'Push A', 'Phase 2', 'p2_push_a'),
    (7, 1, 'Legs A', 'Phase 2', 'p2_legs_a'),
    (7, 3, 'Pull B', 'Phase 2', 'p2_pull_b'),
    (7, 4, 'Push B', 'Phase 2', 'p2_push_b'),
    (7, 5, 'Legs B', 'Phase 2', 'p2_legs_b'),
    (7, 7, 'Pull C', 'Phase 2', 'p2_pull_c'),
    (8, 1, 'Push C', 'Phase 2', 'p2_push_c'),
    (8, 2, 'Legs C', 'Phase 2', 'p2_legs_c'),
    (8, 4, 'JACKED Classic Pull Challenge', 'Phase 2', 'challenge_pull'),
    (8, 5, 'JACKED Classic Push Challenge', 'Phase 2', 'challenge_push'),
    (8, 6, 'JACKED Classic Legs Challenge', 'Phase 2', 'challenge_legs'),
    (9, 1, 'Total Body A', 'Phase 3', 'p3_total_a'),
    (9, 2, 'Corrective A', 'Phase 3', 'p3_corrective_a'),
    (9, 3, 'Total Body B', 'Phase 3', 'p3_total_b'),
    (9, 4, 'Corrective B', 'Phase 3', 'p3_corrective_b'),
    (9, 5, 'Total Body A', 'Phase 3', 'p3_total_a'),
    (10, 1, 'Total Body B', 'Phase 3', 'p3_total_b'),
    (10, 2, 'Corrective B', 'Phase 3', 'p3_corrective_b'),
    (10, 3, 'Total Body A', 'Phase 3', 'p3_total_a'),
    (10, 4, 'Corrective A', 'Phase 3', 'p3_corrective_a'),
    (10, 5, 'Total Body B', 'Phase 3', 'p3_total_b'),
    (11, 1, 'Total Body C', 'Phase 3', 'p3_total_c'),
    (11, 2, 'Corrective C', 'Phase 3', 'p3_corrective_c'),
    (11, 3, 'Total Body D', 'Phase 3', 'p3_total_d'),
    (11, 4, 'Corrective D', 'Phase 3', 'p3_corrective_d'),
    (11, 5, 'Total Body C', 'Phase 3', 'p3_total_c'),
    (12, 1, 'Total Body D', 'Phase 3', 'p3_total_d'),
    (12, 2, 'Corrective D', 'Phase 3', 'p3_corrective_d'),
    (12, 3, 'Total Body C', 'Phase 3', 'p3_total_c'),
    (12, 4, 'Corrective C', 'Phase 3', 'p3_corrective_c'),
    (12, 5, 'Total Body D', 'Phase 3', 'p3_total_d'),
    (12, 7, 'The "10 By" 400 Challenge', 'Phase 3', 'challenge_400')
),
numbered as (
  select
    desired_workouts.*,
    row_number() over (order by week_number, day_number)::integer - 1 as sequence_index,
    row_number() over (partition by week_number order by day_number)::integer as session_number
  from desired_workouts
),
target as (
  select id from public.programs where name = 'JACKED Dumbbell Programme'
)
insert into public.program_workouts (
  program_id,
  name,
  sequence_index,
  week_number,
  day_number,
  session_number,
  description
)
select
  target.id,
  numbered.name,
  numbered.sequence_index,
  numbered.week_number,
  numbered.day_number,
  numbered.session_number,
  case
    when numbered.name like '%Challenge%' then numbered.phase_name || ' challenge day. Use the source challenge prescription and record each completed set.'
    when numbered.name like 'Corrective %' then numbered.phase_name || ' corrective session. Prioritise controlled, high-quality repetitions.'
    when numbered.name like '%Beat Your Totals%' then numbered.phase_name || ' repeat session. Beat the prior box-score totals without sacrificing form.'
    else numbered.phase_name || ' session. Use the source ignitor-set path, box score and Back to JACKED rules.'
  end
from target cross join numbered
on conflict (program_id, sequence_index) do update
set name = excluded.name,
    week_number = excluded.week_number,
    day_number = excluded.day_number,
    session_number = excluded.session_number,
    description = excluded.description,
    updated_at = now();

with movement_templates (template_key, order_index, name, is_optional) as (
  values
    ('p1_chest_a', 1, 'DB BENCH PRESS', false),
    ('p1_chest_a', 2, 'DB INCLINE BENCH PRESS', false),
    ('p1_chest_a', 3, 'DB FLOOR FLYS', false),
    ('p1_chest_a', 4, 'PUSHUPS', false),
    ('p1_chest_a', 5, 'CORRECTIVE', false),
    ('p1_back_a', 1, 'DB ROWS', false),
    ('p1_back_a', 2, 'WEIGHTED PULLUPS', true),
    ('p1_back_a', 3, 'DB TRIPOD ROWS', false),
    ('p1_back_a', 4, 'DB URLACHERS', false),
    ('p1_back_a', 5, 'CORRECTIVE', false),
    ('p1_triceps_a', 1, 'LYING DB TRICEP EXTENSIONS', false),
    ('p1_triceps_a', 2, 'DB JM PRESS', false),
    ('p1_triceps_a', 3, 'DB KICKBACKS', false),
    ('p1_triceps_a', 4, 'COBRA PUSHUPS', false),
    ('p1_triceps_a', 5, 'CORRECTIVE', false),
    ('p1_legs_a', 1, 'DB BULGARIAN SPLIT SQUATS', false),
    ('p1_legs_a', 2, 'DB HIP THRUSTS', false),
    ('p1_legs_a', 3, 'DB STEP UPS', false),
    ('p1_legs_a', 4, 'DB ALT. REVERSE SPRINTER LUNGES', false),
    ('p1_legs_a', 5, 'CORRECTIVE', false),
    ('p1_shoulders_a', 1, 'DB OHP', false),
    ('p1_shoulders_a', 2, 'DB SIDE LATERAL RAISES', false),
    ('p1_shoulders_a', 3, 'ALTERNATING DB FRONT RAISES', false),
    ('p1_shoulders_a', 4, 'DB ABDUCTION ROWS', false),
    ('p1_shoulders_a', 5, 'CORRECTIVE', false),
    ('p1_biceps_a', 1, 'DB STRAIGHT BAR CURLS', false),
    ('p1_biceps_a', 2, 'WEIGHTED CHINS', true),
    ('p1_biceps_a', 3, 'DB HAMMER CURLS', false),
    ('p1_biceps_a', 4, 'DB NO MONEY CURLS', false),
    ('p1_biceps_a', 5, 'CORRECTIVE', false),
    ('p1_chest_b', 1, 'WEIGHTED DIPS', true),
    ('p1_chest_b', 2, 'DB UNDERHAND BENCH PRESS', false),
    ('p1_chest_b', 3, 'DB FLOOR PRESS', false),
    ('p1_chest_b', 4, 'ALTERNATING DB UCV RAISES', false),
    ('p1_chest_b', 5, 'CORRECTIVE', false),
    ('p1_back_b', 1, 'DB CHEST SUPPORTED ROWS', false),
    ('p1_back_b', 2, 'DB ALT. GORILLA ROWS', false),
    ('p1_back_b', 3, 'DOUBLE DB PULLOVERS', false),
    ('p1_back_b', 4, 'DB HIGH PULLS', false),
    ('p1_back_b', 5, 'CORRECTIVE', false),
    ('p1_triceps_b', 1, 'ELBOWS TUCKED DB BENCH PRESS', false),
    ('p1_triceps_b', 2, 'DB SKULL CRUSHERS', false),
    ('p1_triceps_b', 3, 'DB OVERHEAD EXTENSIONS', false),
    ('p1_triceps_b', 4, 'BENCH DIPS', false),
    ('p1_triceps_b', 5, 'CORRECTIVE', false),
    ('p1_legs_b', 1, 'ALTERNATING REVERSE DB LUNGES', false),
    ('p1_legs_b', 2, 'DB RDLS', false),
    ('p1_legs_b', 3, 'DB GOBLET SQUATS', false),
    ('p1_legs_b', 4, 'DOUBLE DB FROG PRESS', false),
    ('p1_legs_b', 5, 'CORRECTIVE', false),
    ('p1_shoulders_b', 1, 'DB CHEAT LATERALS', false),
    ('p1_shoulders_b', 2, 'MODIFIED DB BRADFORD PRESS', false),
    ('p1_shoulders_b', 3, 'SINGLE DB PRESS OUTS', false),
    ('p1_shoulders_b', 4, 'DB REAR DELT ROWS', false),
    ('p1_shoulders_b', 5, 'CORRECTIVE', false),
    ('p1_biceps_b', 1, 'ALTERNATING DB CURLS', false),
    ('p1_biceps_b', 2, 'DB DRAG CURLS', false),
    ('p1_biceps_b', 3, 'DB CROSS BODY HAMMER CURLS', false),
    ('p1_biceps_b', 4, 'DB SPIDER CURLS', false),
    ('p1_biceps_b', 5, 'CORRECTIVE', false),
    ('p2_pull_a', 1, 'DB ROWS', false),
    ('p2_pull_a', 2, 'DB STRAIGHT BAR CURLS', false),
    ('p2_pull_a', 3, 'DB HIGH PULLS', false),
    ('p2_pull_a', 4, 'DOUBLE DB PULLOVERS', false),
    ('p2_pull_a', 5, 'DB NO MONEY CURLS', false),
    ('p2_pull_a', 6, 'CORRECTIVES · 2 MOVEMENTS', false),
    ('p2_push_a', 1, 'DB BENCH PRESS', false),
    ('p2_push_a', 2, 'LYING DB TRICEP EXTENSIONS', false),
    ('p2_push_a', 3, 'MODIFIED BRADFORD PRESS', false),
    ('p2_push_a', 4, 'FLOOR FLYS', false),
    ('p2_push_a', 5, 'ALTERNATING DB UCV RAISES', false),
    ('p2_push_a', 6, 'CORRECTIVES · 2 MOVEMENTS', false),
    ('p2_legs_a', 1, 'DB BULGARIAN SPLIT SQUATS', false),
    ('p2_legs_a', 2, 'DB LEANING STEP UPS', false),
    ('p2_legs_a', 3, 'DB STATIC CREEPING LUNGES', false),
    ('p2_legs_a', 4, 'DB BENCH FRONT SQUATS', false),
    ('p2_legs_a', 5, 'DB SWINGS', false),
    ('p2_legs_a', 6, 'CORRECTIVES · 2 MOVEMENTS', false),
    ('p2_pull_b', 1, 'DB ALT. GORILLA ROWS', false),
    ('p2_pull_b', 2, 'DB HAMMER CURLS', false),
    ('p2_pull_b', 3, 'DB SPIDER CURLS', false),
    ('p2_pull_b', 4, 'DB CHEST SUPPORTED ROWS', false),
    ('p2_pull_b', 5, 'CORRECTIVES · 2 MOVEMENTS', false),
    ('p2_push_b', 1, 'DB INCLINE BENCH PRESS', false),
    ('p2_push_b', 2, 'ALTERNATING DB FRONT RAISES', false),
    ('p2_push_b', 3, 'DB SIDE LATERAL RAISES', false),
    ('p2_push_b', 4, 'DB OVERHEAD EXTENSIONS', false),
    ('p2_push_b', 5, 'DB KICKBACKS', false),
    ('p2_push_b', 6, 'CORRECTIVES · 2 MOVEMENTS', false),
    ('p2_legs_b', 1, 'DB RDLS', false),
    ('p2_legs_b', 2, 'DB ROCKET SQUATS', false),
    ('p2_legs_b', 3, 'DOUBLE DB FROG PRESS', false),
    ('p2_legs_b', 4, 'DB ALT. REVERSE SPRINTER LUNGES', false),
    ('p2_legs_b', 5, 'DB PLYO STEP UPS', false),
    ('p2_legs_b', 6, 'CORRECTIVES · 2 MOVEMENTS', false),
    ('p2_pull_c', 1, 'DB HANEY SHRUGS', false),
    ('p2_pull_c', 2, 'DB DRAG CURLS', false),
    ('p2_pull_c', 3, 'DB TRIPOD ROWS', false),
    ('p2_pull_c', 4, 'DB URLACHERS', false),
    ('p2_pull_c', 5, 'CORRECTIVES · 2 MOVEMENTS', false),
    ('p2_push_c', 1, 'DB OHP', false),
    ('p2_push_c', 2, 'WEIGHTED DIPS', true),
    ('p2_push_c', 3, 'DB JM PRESS', false),
    ('p2_push_c', 4, 'DB UNDERHAND BENCH PRESS', false),
    ('p2_push_c', 5, 'DB PRESS OUTS', false),
    ('p2_push_c', 6, 'CORRECTIVES · 2 MOVEMENTS', false),
    ('p2_legs_c', 1, 'ALTERNATING REVERSE DB LUNGES', false),
    ('p2_legs_c', 2, 'DB HIP THRUSTS', false),
    ('p2_legs_c', 3, 'DB SINGLE LEG RDL CALF RAISES', false),
    ('p2_legs_c', 4, 'DB COSSACK SQUATS', false),
    ('p2_legs_c', 5, 'DB GOBLET SQUATS', false),
    ('p2_legs_c', 6, 'CORRECTIVES · 2 MOVEMENTS', false),
    ('challenge_pull', 1, 'DB CHEST SUPPORTED ROWS', false),
    ('challenge_pull', 2, 'DB URLACHERS', false),
    ('challenge_pull', 3, 'DB HANEY SHRUGS', false),
    ('challenge_pull', 4, 'DB NO MONEY CURLS', false),
    ('challenge_push', 1, 'DB BENCH PRESS', false),
    ('challenge_push', 2, 'DB SIDE LATERAL RAISES', false),
    ('challenge_push', 3, 'LYING DB TRICEP EXTENSIONS', false),
    ('challenge_push', 4, 'DB OHP', false),
    ('challenge_legs', 1, 'ALTERNATING REVERSE DB LUNGES', false),
    ('challenge_legs', 2, 'DB HIP THRUSTS', false),
    ('challenge_legs', 3, 'DB ROCKET SQUATS', false),
    ('challenge_legs', 4, 'DB RDLS', false),
    ('p3_total_a', 1, 'DB ROWS', false),
    ('p3_total_a', 2, 'DB OHP', false),
    ('p3_total_a', 3, 'DB DRAG CURLS', false),
    ('p3_total_a', 4, 'DB DRAG CURLS · PULLUP BAR SWAP', true),
    ('p3_total_a', 5, 'DB KICKBACKS', false),
    ('p3_total_a', 6, 'DB STATIC CREEPING LUNGES', false),
    ('p3_total_a', 7, 'DB HIP THRUSTS', false),
    ('p3_corrective_a', 1, 'DOORWAY FACE PULLS', false),
    ('p3_corrective_a', 2, 'HANGING SCAP PULLS', true),
    ('p3_corrective_a', 3, 'SINGLE ARM SCAPULAR PUSHUPS', false),
    ('p3_corrective_a', 4, 'BOTTOMED OUT SQUAT REACHES', false),
    ('p3_total_b', 1, 'DB ALT. GORILLA ROWS', false),
    ('p3_total_b', 2, 'DB ALT. GORILLA ROWS · PULLUP BAR SWAP', true),
    ('p3_total_b', 3, 'DB FLOOR FLY', false),
    ('p3_total_b', 4, 'DB CROSS BODY HAMMER CURLS', false),
    ('p3_total_b', 5, 'DB CROSS BODY HAMMER CURLS · PULLUP BAR SWAP', true),
    ('p3_total_b', 6, 'LYING DB TRICEP EXTENSIONS', false),
    ('p3_total_b', 7, 'DB ALT. STEP UPS', false),
    ('p3_total_b', 8, 'DB RDLS', false),
    ('p3_corrective_b', 1, 'PRONE W RAISES', false),
    ('p3_corrective_b', 2, 'T-SPINE ROTATIONS', false),
    ('p3_corrective_b', 3, 'JANE FONDAS', false),
    ('p3_total_c', 1, 'DOUBLE DB PULLOVERS', false),
    ('p3_total_c', 2, 'DOUBLE DB PULLOVERS · PULLUP BAR SWAP', true),
    ('p3_total_c', 3, 'DB CHEAT LATERALS', false),
    ('p3_total_c', 4, 'DB STRAIGHT BAR CURLS', false),
    ('p3_total_c', 5, 'DB JM PRESS', false),
    ('p3_total_c', 6, 'ALTERNATING REVERSE DB LUNGES', false),
    ('p3_total_c', 7, 'DB LEANING STEP UPS', false),
    ('p3_corrective_c', 1, 'BRIDGE AND REACH OVERS', false),
    ('p3_corrective_c', 2, 'ER WALL SLIDES', false),
    ('p3_corrective_c', 3, 'ANGELS AND DEVILS', false),
    ('p3_corrective_c', 4, 'LEG SWINGS', false),
    ('p3_total_d', 1, 'DB HANEY SHRUGS', false),
    ('p3_total_d', 2, 'DB HANEY SHRUGS · PULLUP BAR SWAP', true),
    ('p3_total_d', 3, 'INCLINE DB BENCH PRESS', false),
    ('p3_total_d', 4, 'DB HAMMER CURLS', false),
    ('p3_total_d', 5, 'DB HAMMER CURLS · PULLUP BAR SWAP', true),
    ('p3_total_d', 6, 'DB OVERHEAD EXTENSIONS', false),
    ('p3_total_d', 7, 'DB BULGARIAN SPLIT SQUATS', false),
    ('p3_total_d', 8, 'DB ALT. REVERSE SPRINTER LUNGES', false),
    ('p3_corrective_d', 1, 'INCHWORMS', false),
    ('p3_corrective_d', 2, 'LUNGE AND REACH', false),
    ('p3_corrective_d', 3, 'SUPERMAN PRESS OUTS', false),
    ('p3_corrective_d', 4, 'HIP DROPS', false),
    ('challenge_400', 1, 'DB THRUSTERS', false),
    ('challenge_400', 2, 'DB RENEGADE ROWS', false),
    ('challenge_400', 3, 'DB FLOOR PRESS', false),
    ('challenge_400', 4, 'DB POWER HIGH PULL', false)
),
desired_workouts (week_number, day_number, template_key) as (
  values
    (1,1,'p1_chest_a'), (1,2,'p1_back_a'), (1,3,'p1_triceps_a'), (1,4,'p1_legs_a'), (1,5,'p1_shoulders_a'), (1,6,'p1_biceps_a'),
    (2,1,'p1_chest_b'), (2,2,'p1_back_b'), (2,3,'p1_triceps_b'), (2,4,'p1_legs_b'), (2,5,'p1_shoulders_b'), (2,6,'p1_biceps_b'),
    (3,1,'p1_chest_a'), (3,2,'p1_back_a'), (3,3,'p1_triceps_a'), (3,4,'p1_legs_a'), (3,5,'p1_shoulders_a'), (3,6,'p1_biceps_a'),
    (4,1,'p1_chest_b'), (4,2,'p1_back_b'), (4,3,'p1_triceps_b'), (4,4,'p1_legs_b'), (4,5,'p1_shoulders_b'), (4,6,'p1_biceps_b'),
    (5,1,'p2_pull_a'), (5,2,'p2_push_a'), (5,3,'p2_legs_a'), (5,5,'p2_pull_b'), (5,6,'p2_push_b'), (5,7,'p2_legs_b'),
    (6,2,'p2_pull_c'), (6,3,'p2_push_c'), (6,4,'p2_legs_c'), (6,6,'p2_pull_a'), (6,7,'p2_push_a'),
    (7,1,'p2_legs_a'), (7,3,'p2_pull_b'), (7,4,'p2_push_b'), (7,5,'p2_legs_b'), (7,7,'p2_pull_c'),
    (8,1,'p2_push_c'), (8,2,'p2_legs_c'), (8,4,'challenge_pull'), (8,5,'challenge_push'), (8,6,'challenge_legs'),
    (9,1,'p3_total_a'), (9,2,'p3_corrective_a'), (9,3,'p3_total_b'), (9,4,'p3_corrective_b'), (9,5,'p3_total_a'),
    (10,1,'p3_total_b'), (10,2,'p3_corrective_b'), (10,3,'p3_total_a'), (10,4,'p3_corrective_a'), (10,5,'p3_total_b'),
    (11,1,'p3_total_c'), (11,2,'p3_corrective_c'), (11,3,'p3_total_d'), (11,4,'p3_corrective_d'), (11,5,'p3_total_c'),
    (12,1,'p3_total_d'), (12,2,'p3_corrective_d'), (12,3,'p3_total_c'), (12,4,'p3_corrective_c'), (12,5,'p3_total_d'), (12,7,'challenge_400')
),
target as (
  select id from public.programs where name = 'JACKED Dumbbell Programme'
),
desired_entries as (
  select
    workout.id as program_workout_id,
    movement.order_index,
    movement.name,
    movement.is_optional,
    workout.week_number,
    workout.name as workout_name
  from target
  join public.program_workouts workout on workout.program_id = target.id
  join desired_workouts desired
    on desired.week_number = workout.week_number
   and desired.day_number = workout.day_number
  join movement_templates movement on movement.template_key = desired.template_key
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
  is_optional,
  weight,
  rest,
  notes
)
select
  desired.program_workout_id,
  desired.name,
  null,
  desired.order_index,
  'As needed',
  case
    when desired.workout_name like 'Corrective %' or desired.name like 'CORRECTIVE%' then 'Quality reps'
    when desired.workout_name like '%Challenge%' then 'Challenge prescription'
    else 'Path-specific box score'
  end,
  1,
  1,
  null,
  null,
  desired.is_optional,
  case
    when desired.workout_name like 'Corrective %' or desired.name like 'CORRECTIVE%' then 'Bodyweight or light dumbbell as prescribed'
    else 'Choose via the source ignitor set'
  end,
  case
    when desired.workout_name like 'Corrective %' or desired.name like 'CORRECTIVE%' then 'As needed for high-quality execution'
    else '60–90 seconds unless the source path specifies otherwise'
  end,
  case
    when desired.is_optional then 'Optional equipment substitution. Use this instead of the paired dumbbell movement when appropriate.'
    when desired.workout_name like 'Corrective %' or desired.name like 'CORRECTIVE%' then 'Use controlled repetitions and the exact source-programme execution cues.'
    when desired.workout_name like '%Challenge%' then 'Follow the source challenge order and scoring. Add or remove logger rows to match the completed work.'
    else 'Use the source programme''s ignitor-set path, box score, Back to JACKED rule and protector/lifeline protocol. Add or remove logger rows as needed and record actual reps and dumbbell load.'
  end
from desired_entries desired
where not exists (
  select 1
  from public.program_workout_entries existing
  where existing.program_workout_id = desired.program_workout_id
    and existing.order_index = desired.order_index
);
