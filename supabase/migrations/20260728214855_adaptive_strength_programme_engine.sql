-- Adaptive 12-week strength programming. This extends the existing programme
-- assignment path; completed workouts still use the canonical session tables.

alter table public.program_workout_entries
  add column if not exists intensity_min_percent numeric,
  add column if not exists intensity_max_percent numeric,
  add column if not exists rpe_cap numeric,
  add column if not exists selection_role text;

alter table public.program_workout_entries
  drop constraint if exists program_workout_entries_intensity_range_check,
  add constraint program_workout_entries_intensity_range_check check (
    (intensity_min_percent is null and intensity_max_percent is null)
    or (
      intensity_min_percent between 0 and 100
      and intensity_max_percent between intensity_min_percent and 100
    )
  ),
  drop constraint if exists program_workout_entries_rpe_cap_check,
  add constraint program_workout_entries_rpe_cap_check
    check (rpe_cap is null or rpe_cap between 1 and 10),
  drop constraint if exists program_workout_entries_selection_role_check,
  add constraint program_workout_entries_selection_role_check
    check (selection_role is null or selection_role in ('power', 'accessory', 'pull'));

alter table public.program_assignment_exercises
  add column if not exists is_enabled boolean not null default true,
  add column if not exists load_adjustment_percent numeric not null default 0,
  add column if not exists last_decision text;

alter table public.program_assignment_exercises
  drop constraint if exists program_assignment_exercises_load_adjustment_check,
  add constraint program_assignment_exercises_load_adjustment_check
    check (load_adjustment_percent between -10 and 5),
  drop constraint if exists program_assignment_exercises_last_decision_check,
  add constraint program_assignment_exercises_last_decision_check
    check (last_decision is null or last_decision in ('progress', 'repeat', 'regress'));

alter table public.program_assignments
  add column if not exists cycle_number integer not null default 1,
  add column if not exists previous_assignment_id uuid
    references public.program_assignments(id) on delete set null;

alter table public.program_assignments
  drop constraint if exists program_assignments_cycle_number_check,
  add constraint program_assignments_cycle_number_check check (cycle_number >= 1);

create table if not exists public.program_assignment_exercise_pools (
  id uuid primary key default gen_random_uuid(),
  program_assignment_id uuid not null
    references public.program_assignments(id) on delete cascade,
  role text not null check (role in ('power', 'accessory', 'pull')),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  exercise_name text not null,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (program_assignment_id, role, exercise_id)
);

create table if not exists public.program_workout_reviews (
  id uuid primary key default gen_random_uuid(),
  program_assignment_id uuid not null
    references public.program_assignments(id) on delete cascade,
  program_workout_id uuid not null references public.program_workouts(id) on delete cascade,
  program_assignment_exercise_id uuid not null
    references public.program_assignment_exercises(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  rpe numeric check (rpe is null or rpe between 1 and 10),
  technique text check (technique is null or technique in ('good', 'acceptable', 'poor')),
  pain numeric check (pain is null or pain between 0 and 10),
  decision text not null check (decision in ('progress', 'repeat', 'regress')),
  applied_adjustment_percent numeric not null default 0
    check (applied_adjustment_percent between -10 and 5),
  created_at timestamptz not null default now(),
  unique (program_assignment_id, program_workout_id, program_assignment_exercise_id)
);

create index if not exists program_assignments_previous_assignment_idx
  on public.program_assignments (previous_assignment_id);
create index if not exists program_assignment_exercise_pools_assignment_idx
  on public.program_assignment_exercise_pools (program_assignment_id);
create index if not exists program_assignment_exercise_pools_exercise_idx
  on public.program_assignment_exercise_pools (exercise_id);
create index if not exists program_workout_reviews_assignment_idx
  on public.program_workout_reviews (program_assignment_id, created_at desc);
create index if not exists program_workout_reviews_workout_idx
  on public.program_workout_reviews (program_workout_id);
create index if not exists program_workout_reviews_session_idx
  on public.program_workout_reviews (session_id);
create index if not exists program_workout_reviews_assignment_exercise_idx
  on public.program_workout_reviews (program_assignment_exercise_id);

alter table public.program_assignment_exercise_pools enable row level security;
alter table public.program_workout_reviews enable row level security;

grant select, insert, update, delete
  on public.program_assignment_exercise_pools to authenticated;
grant select, insert, update, delete
  on public.program_workout_reviews to authenticated;

drop policy if exists program_assignment_exercise_pools_managed
  on public.program_assignment_exercise_pools;
create policy program_assignment_exercise_pools_managed
  on public.program_assignment_exercise_pools
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.program_assignments assignment
      where assignment.id = program_assignment_id
        and app_private.person_is_accessible(assignment.person_id)
    )
  )
  with check (
    exists (
      select 1
      from public.program_assignments assignment
      where assignment.id = program_assignment_id
        and app_private.person_is_accessible(assignment.person_id)
    )
  );

drop policy if exists program_workout_reviews_managed on public.program_workout_reviews;
create policy program_workout_reviews_managed
  on public.program_workout_reviews
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.program_assignments assignment
      where assignment.id = program_assignment_id
        and app_private.person_is_accessible(assignment.person_id)
    )
  )
  with check (
    exists (
      select 1
      from public.program_assignments assignment
      where assignment.id = program_assignment_id
        and app_private.person_is_accessible(assignment.person_id)
    )
  );

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
  'Adaptive Strength 12-Week Block',
  'Three-day strength block prioritising repeatable maximal-strength progress, conservative lower-body loading, selectable power/accessory work, and RPE/technique/pain-based adjustments.',
  true,
  'adaptive_strength_12_week',
  12,
  3,
  'minimum',
  'training_max',
  2.5
where not exists (
  select 1 from public.programs where name = 'Adaptive Strength 12-Week Block'
);

update public.programs
set description = 'Three-day strength block prioritising repeatable maximal-strength progress, conservative lower-body loading, selectable power/accessory work, and RPE/technique/pain-based adjustments.',
    is_template = true,
    method_type = 'adaptive_strength_12_week',
    duration_weeks = 12,
    sessions_per_week = 3,
    default_set_choice = 'minimum',
    percent_base = 'training_max',
    rounding_increment = 2.5,
    updated_at = now()
where name = 'Adaptive Strength 12-Week Block';

with target as (
  select id from public.programs where name = 'Adaptive Strength 12-Week Block'
),
desired as (
  select
    week_number,
    session_number,
    ((week_number - 1) * 3 + session_number) as sequence_index,
    case session_number when 1 then 1 when 2 then 3 else 5 end as day_number,
    case session_number
      when 1 then 'Monday · Max strength'
      when 2 then 'Wednesday · Force production'
      else 'Friday · Speed and athleticism'
    end as name,
    case
      when week_number <= 4 then 'Build phase: crisp technique and repeatable volume.'
      when week_number <= 8 then 'Strength phase: more load, fewer reps, no grinders.'
      when week_number <= 11 then 'Peak phase: heavy but submaximal, with strict RPE caps.'
      else 'Deload and review: reduce fatigue and assess the next cycle.'
    end as description
  from generate_series(1, 12) week_number
  cross join generate_series(1, 3) session_number
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
select target.id, desired.name, desired.sequence_index, desired.week_number,
       desired.day_number, desired.session_number, desired.description
from target cross join desired
on conflict (program_id, sequence_index) do update
set name = excluded.name,
    week_number = excluded.week_number,
    day_number = excluded.day_number,
    session_number = excluded.session_number,
    description = excluded.description,
    updated_at = now();

-- Re-seeding this protected template is deterministic. Assignment mappings and
-- completed workout history are separate and are not modified.
delete from public.program_workout_entries
where program_workout_id in (
  select workout.id
  from public.program_workouts workout
  join public.programs program on program.id = workout.program_id
  where program.name = 'Adaptive Strength 12-Week Block'
);

with target_workouts as (
  select workout.id, workout.week_number, workout.session_number
  from public.program_workouts workout
  join public.programs program on program.id = workout.program_id
  where program.name = 'Adaptive Strength 12-Week Block'
),
week_loads as (
  select *
  from (values
    (1,  70::numeric,72.5::numeric,4,5,7.5::numeric, 65::numeric,67.5::numeric,3,5,7.0::numeric, 60::numeric,62.5::numeric,3,5,7.0::numeric, 65::numeric,67.5::numeric,3,6,7.5::numeric, 60::numeric,62.5::numeric,6,3,7.0::numeric, 50::numeric,55::numeric,3,5,7.0::numeric),
    (2,72.5,75,5,4,7.5, 67.5,70,3,5,7.0, 62.5,65,3,5,7.0, 67.5,70,3,6,7.5, 60,65,6,3,7.0, 50,57.5,3,5,7.0),
    (3,75,77.5,5,4,8.0, 70,72.5,4,4,7.5, 65,67.5,3,4,7.0, 70,72.5,4,5,8.0, 62.5,67.5,6,3,7.0, 55,60,3,4,7.0),
    (4,65,70,3,5,7.0, 60,65,2,5,6.5, 55,60,2,5,6.5, 60,65,2,6,7.0, 55,60,4,3,6.5, 50,55,2,5,6.5),
    (5,77.5,80,5,3,8.0, 72.5,75,4,4,7.5, 67.5,70,3,4,7.0, 72.5,75,4,5,8.0, 65,67.5,6,3,7.0, 57.5,62.5,3,4,7.0),
    (6,80,82.5,5,3,8.0, 75,77.5,4,3,7.5, 70,72.5,3,3,7.5, 75,77.5,4,4,8.0, 65,70,6,3,7.0, 60,65,3,4,7.0),
    (7,82.5,85,4,3,8.0, 77.5,80,4,3,7.5, 72.5,75,3,3,7.5, 77.5,80,4,4,8.0, 67.5,70,6,3,7.0, 62.5,67.5,3,3,7.0),
    (8,72.5,77.5,3,4,7.5, 65,70,3,4,7.0, 60,65,2,4,7.0, 67.5,72.5,3,5,7.5, 57.5,62.5,4,3,6.5, 55,60,2,4,6.5),
    (9,85,87.5,4,2,8.5, 77.5,80,3,3,7.5, 72.5,75,3,3,7.5, 80,82.5,4,3,8.0, 67.5,72.5,6,3,7.0, 65,70,3,3,7.0),
    (10,87.5,90,3,2,8.5, 80,82.5,3,2,8.0, 75,77.5,3,2,7.5, 82.5,85,3,3,8.0, 70,72.5,5,3,7.0, 67.5,72.5,3,3,7.0),
    (11,90,92.5,3,1,8.5, 80,82.5,3,2,8.0, 75,77.5,2,2,7.5, 82.5,85,3,2,8.0, 65,70,4,3,7.0, 70,75,3,2,7.5),
    (12,60,65,2,5,6.5, 55,60,2,5,6.0, 50,55,2,5,6.0, 55,60,2,6,6.5, 50,55,3,3,6.0, 45,50,2,5,6.0)
  ) as loads(
    week_number,
    bench_min,bench_max,bench_sets,bench_reps,bench_rpe,
    squat_min,squat_max,squat_sets,squat_reps,squat_rpe,
    deadlift_min,deadlift_max,deadlift_sets,deadlift_reps,deadlift_rpe,
    db_press_min,db_press_max,db_press_sets,db_press_reps,db_press_rpe,
    speed_bench_min,speed_bench_max,speed_bench_sets,speed_bench_reps,speed_bench_rpe,
    pull_min,pull_max,pull_sets,pull_reps,pull_rpe
  )
),
main_entries as (
  select target_workouts.id as program_workout_id, entry.*
  from target_workouts
  join week_loads using (week_number)
  cross join lateral (
    select 'bench_press'::text, 'Bench Press'::text, 2, bench_sets, bench_reps,
           bench_min, bench_max, bench_rpe, false,
           'Use the lower end by default. Move within the range only while reps remain crisp.'::text
    where target_workouts.session_number = 1
    union all
    select 'high_bar_squat', 'High Bar Squat', 3, squat_sets, squat_reps,
           squat_min, squat_max, squat_rpe, false,
           'No grinders. Stop below the cap if depth, position, or bar speed changes.'
    where target_workouts.session_number = 1
    union all
    select 'deadlift', 'Deadlift', 2, deadlift_sets, deadlift_reps,
           deadlift_min, deadlift_max, deadlift_rpe, false,
           'Keep setup and bar speed crisp; the upper end is never mandatory.'
    where target_workouts.session_number = 2
    union all
    select 'seated_dumbbell_press', 'Seated Dumbbell Press', 3, db_press_sets, db_press_reps,
           db_press_min, db_press_max, db_press_rpe, false,
           'Training max and prescribed load are per dumbbell.'
    where target_workouts.session_number = 2
    union all
    select 'bench_press', 'Speed Bench Press', 2, speed_bench_sets, speed_bench_reps,
           speed_bench_min, speed_bench_max, speed_bench_rpe, false,
           'Every rep should move quickly; reduce load when speed drops.'
    where target_workouts.session_number = 3
    union all
    select 'weighted_pull_up', 'Weighted Pull-Up', 3, pull_sets, pull_reps,
           pull_min, pull_max, pull_rpe, true,
           'Disabled at assignment creation. Reintroduce only by explicit user choice when appropriate.'
    where target_workouts.session_number = 3
  ) as entry(slot_key, name, order_index, sets, reps, intensity_min, intensity_max, rpe_cap, is_optional, notes)
)
insert into public.program_workout_entries (
  program_workout_id, name, slot_key, order_index,
  sets, reps, min_sets, max_sets, min_reps, max_reps,
  intensity_percent, intensity_min_percent, intensity_max_percent,
  percent_base, rounding_increment, rpe, rpe_cap, rest, is_optional, notes
)
select
  program_workout_id, name, slot_key, order_index,
  sets::text, reps::text, sets, sets, reps, reps,
  intensity_min, intensity_min, intensity_max,
  'training_max', 2.5, 'Cap ' || rpe_cap::text, rpe_cap,
  case when reps <= 2 then '3-5 min' else '2-4 min' end,
  is_optional, notes
from main_entries;

with target_workouts as (
  select workout.id, workout.session_number
  from public.program_workouts workout
  join public.programs program on program.id = workout.program_id
  where program.name = 'Adaptive Strength 12-Week Block'
)
insert into public.program_workout_entries (
  program_workout_id, name, order_index, sets, reps, min_sets, max_sets,
  min_reps, max_reps, rpe, rpe_cap, rest, is_optional, selection_role, notes
)
select id, 'Choose a power movement', 1, '3', '3', 3, 3, 3, 3,
       'Crisp only', 7, 'Full recovery', true, 'power',
       'Choose from the assignment power pool. Stop when height, distance, or speed drops.'
from target_workouts
union all
select id,
       case when session_number = 3 then 'Choose a pain-free pull movement'
            else 'Choose an accessory movement' end,
       4, '2', case when session_number = 3 then '6' else '8' end,
       2, 2, case when session_number = 3 then 6 else 8 end,
       case when session_number = 3 then 6 else 8 end,
       'Easy to moderate', 7, 'As needed', true,
       case when session_number = 3 then 'pull' else 'accessory' end,
       'Optional and selected from the existing Library. This is not medical rehabilitation advice.'
from target_workouts;
