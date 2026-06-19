-- Training platform schema draft.
--
-- Purpose:
-- - Replace the current Google Sheets data source for the main admin app.
-- - Preserve current app behavior for Noam first.
-- - Support separate simplified apps for friends/clients later.
--
-- Notes:
-- - RLS is enabled on public tables. Normal app screens should use
--   Supabase Auth and publishable-key access. Service-role access is for
--   local/admin-only verification jobs, never browser code.
-- - source_* columns are for spreadsheet migration traceability. They are
--   optional and can be ignored by the app after verification.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create schema if not exists app_private;
revoke all on schema app_private from public;

create or replace function app_private.current_person_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.people p
  where p.auth_user_id = (select auth.uid())
  limit 1;
$$;

create or replace function app_private.person_is_managed(target_person_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_people ap
    where ap.admin_person_id = app_private.current_person_id()
      and ap.managed_person_id = target_person_id
  );
$$;

create or replace function app_private.person_is_accessible(target_person_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_person_id = app_private.current_person_id()
    or app_private.person_is_managed(target_person_id);
$$;

create or replace function app_private.current_person_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_people ap
    where ap.admin_person_id = app_private.current_person_id()
      and ap.role = 'admin'
  );
$$;

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  display_name text not null,
  email text,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'archived')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger people_set_updated_at
before update on public.people
for each row execute function public.set_updated_at();

create table if not exists public.admin_people (
  id uuid primary key default gen_random_uuid(),
  admin_person_id uuid not null references public.people(id) on delete cascade,
  managed_person_id uuid not null references public.people(id) on delete cascade,
  role text not null default 'admin'
    check (role in ('admin', 'coach')),
  created_at timestamptz not null default now(),
  unique (admin_person_id, managed_person_id)
);

create table if not exists public.app_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger app_profiles_set_updated_at
before update on public.app_profiles
for each row execute function public.set_updated_at();

create table if not exists public.person_app_profiles (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  app_profile_id uuid not null references public.app_profiles(id) on delete cascade,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (person_id, app_profile_id)
);

create table if not exists public.activity_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  activity_type_id uuid references public.activity_types(id) on delete set null,
  name text not null,
  focus_area text,
  equipment text,
  default_metric text,
  suggested_sets text,
  suggested_reps text,
  notes text,
  is_active boolean not null default true,
  source_sheet text,
  source_row integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_sheet, source_row)
);

create trigger exercises_set_updated_at
before update on public.exercises
for each row execute function public.set_updated_at();

create table if not exists public.exercise_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique
);

create table if not exists public.exercise_tag_links (
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  tag_id uuid not null references public.exercise_tags(id) on delete cascade,
  primary key (exercise_id, tag_id)
);

create table if not exists public.person_exercises (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  is_enabled boolean not null default true,
  custom_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id, exercise_id)
);

create trigger person_exercises_set_updated_at
before update on public.person_exercises
for each row execute function public.set_updated_at();

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  activity_type_id uuid references public.activity_types(id) on delete set null,
  session_date date not null,
  title text,
  source text not null default 'manual',
  completed boolean not null default true,
  duration_minutes numeric,
  intensity text,
  rpe numeric,
  notes text,
  source_sheet text,
  source_row integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_sheet, source_row)
);

create trigger sessions_set_updated_at
before update on public.sessions
for each row execute function public.set_updated_at();

create table if not exists public.session_entries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null,
  activity_type_id uuid references public.activity_types(id) on delete set null,
  entry_kind text,
  name text not null,
  progression_level text,
  order_index integer not null default 0,
  completed boolean not null default true,
  notes text,
  source_sheet text,
  source_row integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_sheet, source_row)
);

create trigger session_entries_set_updated_at
before update on public.session_entries
for each row execute function public.set_updated_at();

create table if not exists public.entry_sets (
  id uuid primary key default gen_random_uuid(),
  session_entry_id uuid not null references public.session_entries(id) on delete cascade,
  set_number integer,
  reps numeric,
  weight numeric,
  duration_seconds numeric,
  distance numeric,
  distance_unit text,
  rpe numeric,
  rest_seconds integer,
  rest_time text,
  assistance_type text,
  assistance_detail text,
  quality text,
  completed boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.entry_metrics (
  id uuid primary key default gen_random_uuid(),
  session_entry_id uuid not null references public.session_entries(id) on delete cascade,
  metric_key text not null,
  metric_value numeric,
  metric_text text,
  metric_unit text,
  created_at timestamptz not null default now()
);

create table if not exists public.one_rm_tests (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  test_date date not null,
  exercise_id uuid references public.exercises(id) on delete set null,
  exercise_name text not null,
  source text,
  load_type text,
  bodyweight_used boolean not null default false,
  bodyweight_contribution text,
  external_weight numeric,
  reps numeric,
  rpe numeric,
  formula text,
  estimated_total numeric,
  estimated_external numeric,
  is_pr boolean not null default false,
  notes text,
  source_sheet text,
  source_row integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_sheet, source_row)
);

create trigger one_rm_tests_set_updated_at
before update on public.one_rm_tests
for each row execute function public.set_updated_at();

create table if not exists public.bodyweight_logs (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  logged_date date not null,
  bodyweight numeric not null,
  notes text,
  source_sheet text,
  source_row integer,
  created_at timestamptz not null default now(),
  unique (source_sheet, source_row)
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  goal text not null,
  metric text,
  target text,
  period text,
  notes text,
  status text not null default 'active'
    check (status in ('active', 'paused', 'complete', 'archived')),
  source_sheet text,
  source_row integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_sheet, source_row)
);

create table if not exists public.goal_checkins (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  checked_date date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  unique (goal_id, checked_date)
);

create trigger goals_set_updated_at
before update on public.goals
for each row execute function public.set_updated_at();

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by_person_id uuid references public.people(id) on delete set null,
  is_template boolean not null default true,
  method_type text,
  duration_weeks integer,
  sessions_per_week integer,
  default_set_choice text,
  percent_base text,
  rounding_increment numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger programs_set_updated_at
before update on public.programs
for each row execute function public.set_updated_at();

create table if not exists public.program_workouts (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  name text not null,
  sequence_index integer not null default 0,
  week_number integer,
  day_number integer,
  session_number integer,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, sequence_index)
);

create trigger program_workouts_set_updated_at
before update on public.program_workouts
for each row execute function public.set_updated_at();

create table if not exists public.program_workout_entries (
  id uuid primary key default gen_random_uuid(),
  program_workout_id uuid not null references public.program_workouts(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null,
  name text not null,
  slot_key text,
  order_index integer not null default 0,
  sets text,
  reps text,
  min_sets integer,
  max_sets integer,
  min_reps integer,
  max_reps integer,
  intensity_percent numeric,
  percent_base text,
  rounding_increment numeric,
  is_optional boolean default false,
  weight text,
  duration text,
  rpe text,
  rest text,
  progression_level text,
  assistance_type text,
  assistance_detail text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger program_workout_entries_set_updated_at
before update on public.program_workout_entries
for each row execute function public.set_updated_at();

create table if not exists public.program_assignments (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  assigned_by_person_id uuid references public.people(id) on delete set null,
  status text not null default 'active'
    check (status in ('active', 'paused', 'complete', 'archived')),
  current_workout_index integer not null default 0,
  started_on date,
  completed_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger program_assignments_set_updated_at
before update on public.program_assignments
for each row execute function public.set_updated_at();

create table if not exists public.program_assignment_exercises (
  id uuid primary key default gen_random_uuid(),
  program_assignment_id uuid not null references public.program_assignments(id) on delete cascade,
  slot_key text not null,
  exercise_id uuid references public.exercises(id),
  exercise_name text not null,
  training_max numeric,
  one_rm_test_id uuid references public.one_rm_tests(id),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (program_assignment_id, slot_key)
);

create trigger program_assignment_exercises_set_updated_at
before update on public.program_assignment_exercises
for each row execute function public.set_updated_at();

create table if not exists public.suggested_workouts (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  program_assignment_id uuid references public.program_assignments(id) on delete set null,
  program_workout_id uuid references public.program_workouts(id) on delete set null,
  suggested_for date,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'completed', 'skipped', 'archived')),
  title text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger suggested_workouts_set_updated_at
before update on public.suggested_workouts
for each row execute function public.set_updated_at();

insert into public.activity_types (name, slug, sort_order)
values
  ('Strength', 'strength', 10),
  ('Cardio', 'cardio', 20),
  ('Yoga', 'yoga', 30),
  ('Stretching', 'stretching', 40),
  ('Mobility', 'mobility', 50),
  ('Sport', 'sport', 60),
  ('Skills/Calisthenics', 'skills-calisthenics', 70),
  ('Grip', 'grip', 80),
  ('Climbing', 'climbing', 90),
  ('Bouldering', 'bouldering', 95),
  ('Conditioning', 'conditioning', 100),
  ('Power', 'power', 110),
  ('Run', 'run', 120),
  ('Class', 'class', 130),
  ('Other', 'other', 999)
on conflict (slug) do update
set name = excluded.name,
    sort_order = excluded.sort_order;

insert into public.app_profiles (name, slug, description, config)
values
  (
    'Full Training Admin',
    'full-training-admin',
    'Full dashboard, logging, library, goals, PRs, climbing, strength tests, and bodyweight tracking.',
    '{"features":["dashboard","log","library","goals","prs","climbing","one_rm","bodyweight"]}'::jsonb
  ),
  (
    'Simple Workout Logger',
    'simple-workout-logger',
    'Simplified app profile for logging assigned workouts and basic progress.',
    '{"features":["suggested_workout","log","history"]}'::jsonb
  ),
  (
    'Runs And Classes',
    'runs-and-classes',
    'Simplified app profile for runs, classes, duration, effort, and notes.',
    '{"features":["run","class","history"]}'::jsonb
  )
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    config = excluded.config,
    updated_at = now();

create index if not exists admin_people_admin_idx
  on public.admin_people (admin_person_id);

create index if not exists admin_people_managed_idx
  on public.admin_people (managed_person_id);

create index if not exists exercises_activity_type_idx
  on public.exercises (activity_type_id);

create index if not exists exercise_tag_links_tag_idx
  on public.exercise_tag_links (tag_id);

create index if not exists person_app_profiles_app_profile_idx
  on public.person_app_profiles (app_profile_id);

create index if not exists person_exercises_person_enabled_idx
  on public.person_exercises (person_id, is_enabled);

create index if not exists person_exercises_exercise_idx
  on public.person_exercises (exercise_id);

create index if not exists sessions_person_date_idx
  on public.sessions (person_id, session_date desc);

create index if not exists sessions_activity_type_idx
  on public.sessions (activity_type_id);

create index if not exists sessions_source_idx
  on public.sessions (source_sheet, source_row);

create index if not exists session_entries_session_idx
  on public.session_entries (session_id, order_index);

create index if not exists session_entries_exercise_idx
  on public.session_entries (exercise_id);

create index if not exists session_entries_activity_type_idx
  on public.session_entries (activity_type_id);

create index if not exists entry_sets_entry_idx
  on public.entry_sets (session_entry_id, set_number);

create index if not exists entry_metrics_entry_key_idx
  on public.entry_metrics (session_entry_id, metric_key);

create index if not exists one_rm_tests_person_date_idx
  on public.one_rm_tests (person_id, test_date desc);

create index if not exists one_rm_tests_exercise_idx
  on public.one_rm_tests (exercise_id);

create index if not exists bodyweight_logs_person_date_idx
  on public.bodyweight_logs (person_id, logged_date desc);

create index if not exists goals_person_status_idx
  on public.goals (person_id, status);

create index if not exists goal_checkins_person_date_idx
  on public.goal_checkins (person_id, checked_date desc);

create index if not exists goal_checkins_goal_date_idx
  on public.goal_checkins (goal_id, checked_date desc);

create index if not exists programs_created_by_person_idx
  on public.programs (created_by_person_id);

create index if not exists program_assignments_program_idx
  on public.program_assignments (program_id);

create index if not exists program_assignments_assigned_by_person_idx
  on public.program_assignments (assigned_by_person_id);

create index if not exists program_assignments_person_status_idx
  on public.program_assignments (person_id, status);

create index if not exists program_assignment_exercises_assignment_idx
  on public.program_assignment_exercises (program_assignment_id);

create index if not exists program_assignment_exercises_exercise_idx
  on public.program_assignment_exercises (exercise_id);

create index if not exists program_assignment_exercises_one_rm_test_idx
  on public.program_assignment_exercises (one_rm_test_id);

create index if not exists program_workout_entries_program_workout_idx
  on public.program_workout_entries (program_workout_id);

create index if not exists program_workout_entries_exercise_idx
  on public.program_workout_entries (exercise_id);

create index if not exists suggested_workouts_person_status_idx
  on public.suggested_workouts (person_id, status, suggested_for);

create index if not exists suggested_workouts_program_assignment_idx
  on public.suggested_workouts (program_assignment_id);

create index if not exists suggested_workouts_program_workout_idx
  on public.suggested_workouts (program_workout_id);

alter table public.people enable row level security;
alter table public.admin_people enable row level security;
alter table public.app_profiles enable row level security;
alter table public.person_app_profiles enable row level security;
alter table public.activity_types enable row level security;
alter table public.exercises enable row level security;
alter table public.exercise_tags enable row level security;
alter table public.exercise_tag_links enable row level security;
alter table public.person_exercises enable row level security;
alter table public.sessions enable row level security;
alter table public.session_entries enable row level security;
alter table public.entry_sets enable row level security;
alter table public.entry_metrics enable row level security;
alter table public.one_rm_tests enable row level security;
alter table public.bodyweight_logs enable row level security;
alter table public.goals enable row level security;
alter table public.goal_checkins enable row level security;
alter table public.programs enable row level security;
alter table public.program_workouts enable row level security;
alter table public.program_workout_entries enable row level security;
alter table public.program_assignments enable row level security;
alter table public.program_assignment_exercises enable row level security;
alter table public.suggested_workouts enable row level security;

grant usage on schema public to authenticated;

grant select on
  public.people,
  public.admin_people,
  public.app_profiles,
  public.person_app_profiles,
  public.activity_types,
  public.exercises,
  public.exercise_tags,
  public.exercise_tag_links,
  public.person_exercises,
  public.sessions,
  public.session_entries,
  public.entry_sets,
  public.entry_metrics,
  public.one_rm_tests,
  public.bodyweight_logs,
  public.goals,
  public.goal_checkins,
  public.programs,
  public.program_workouts,
  public.program_workout_entries,
  public.program_assignments,
  public.program_assignment_exercises,
  public.suggested_workouts
to authenticated;

grant insert, update, delete on public.goals to authenticated;
grant insert, delete on public.goal_checkins to authenticated;
grant insert, update on public.activity_types to authenticated;
grant insert, update on public.exercises to authenticated;
grant insert, update, delete on public.person_exercises to authenticated;
grant insert on public.sessions to authenticated;
grant insert on public.session_entries to authenticated;
grant insert on public.entry_sets to authenticated;
grant insert on public.entry_metrics to authenticated;
grant insert on public.one_rm_tests to authenticated;
grant insert, update, delete on public.program_assignment_exercises to authenticated;
grant insert on public.bodyweight_logs to authenticated;
grant delete on public.sessions to authenticated;
grant delete on public.one_rm_tests to authenticated;
grant delete on public.bodyweight_logs to authenticated;
grant update (auth_user_id) on public.people to authenticated;
grant usage on schema app_private to authenticated;
grant execute on function app_private.current_person_id() to authenticated;
grant execute on function app_private.person_is_managed(uuid) to authenticated;
grant execute on function app_private.person_is_accessible(uuid) to authenticated;
grant execute on function app_private.current_person_is_admin() to authenticated;

create policy people_select_accessible
  on public.people
  for select
  to authenticated
  using (
    auth_user_id = (select auth.uid())
    or (auth_user_id is null and display_name = 'Noam')
    or app_private.person_is_managed(id)
  );

create policy people_claim_unclaimed_noam
  on public.people
  for update
  to authenticated
  using (auth_user_id is null and display_name = 'Noam')
  with check (auth_user_id = (select auth.uid()));

create policy admin_people_select_for_admin
  on public.admin_people
  for select
  to authenticated
  using (admin_person_id = app_private.current_person_id());

create policy app_profiles_select_authenticated
  on public.app_profiles
  for select
  to authenticated
  using (true);

create policy activity_types_select_authenticated
  on public.activity_types
  for select
  to authenticated
  using (true);

create policy activity_types_insert_admin
  on public.activity_types
  for insert
  to authenticated
  with check (app_private.current_person_is_admin());

create policy activity_types_update_admin
  on public.activity_types
  for update
  to authenticated
  using (app_private.current_person_is_admin())
  with check (app_private.current_person_is_admin());

create policy exercises_select_authenticated
  on public.exercises
  for select
  to authenticated
  using (true);

create policy exercises_insert_admin
  on public.exercises
  for insert
  to authenticated
  with check (app_private.current_person_is_admin());

create policy exercises_update_admin
  on public.exercises
  for update
  to authenticated
  using (app_private.current_person_is_admin())
  with check (app_private.current_person_is_admin());

create policy exercise_tags_select_authenticated
  on public.exercise_tags
  for select
  to authenticated
  using (true);

create policy exercise_tag_links_select_authenticated
  on public.exercise_tag_links
  for select
  to authenticated
  using (true);

create policy person_exercises_select_managed
  on public.person_exercises
  for select
  to authenticated
  using (app_private.person_is_accessible(person_id));

create policy person_exercises_insert_managed
  on public.person_exercises
  for insert
  to authenticated
  with check (app_private.person_is_accessible(person_id));

create policy person_exercises_update_managed
  on public.person_exercises
  for update
  to authenticated
  using (app_private.person_is_accessible(person_id))
  with check (app_private.person_is_accessible(person_id));

create policy person_exercises_delete_managed
  on public.person_exercises
  for delete
  to authenticated
  using (app_private.person_is_accessible(person_id));

create policy sessions_select_managed
  on public.sessions
  for select
  to authenticated
  using (app_private.person_is_accessible(person_id));

create policy sessions_insert_managed
  on public.sessions
  for insert
  to authenticated
  with check (app_private.person_is_accessible(person_id));

create policy sessions_delete_managed
  on public.sessions
  for delete
  to authenticated
  using (app_private.person_is_accessible(person_id));

create policy session_entries_select_managed
  on public.session_entries
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.sessions s
      where s.id = session_id
        and app_private.person_is_accessible(s.person_id)
    )
  );

create policy session_entries_insert_managed
  on public.session_entries
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.sessions s
      where s.id = session_id
        and app_private.person_is_accessible(s.person_id)
    )
  );

create policy entry_sets_select_managed
  on public.entry_sets
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.session_entries se
      join public.sessions s on s.id = se.session_id
      where se.id = session_entry_id
        and app_private.person_is_accessible(s.person_id)
    )
  );

create policy entry_sets_insert_managed
  on public.entry_sets
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.session_entries se
      join public.sessions s on s.id = se.session_id
      where se.id = session_entry_id
        and app_private.person_is_accessible(s.person_id)
    )
  );

create policy entry_metrics_select_managed
  on public.entry_metrics
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.session_entries se
      join public.sessions s on s.id = se.session_id
      where se.id = session_entry_id
        and app_private.person_is_accessible(s.person_id)
    )
  );

create policy entry_metrics_insert_managed
  on public.entry_metrics
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.session_entries se
      join public.sessions s on s.id = se.session_id
      where se.id = session_entry_id
        and app_private.person_is_accessible(s.person_id)
    )
  );

create policy one_rm_tests_select_managed
  on public.one_rm_tests
  for select
  to authenticated
  using (app_private.person_is_accessible(person_id));

create policy one_rm_tests_insert_managed
  on public.one_rm_tests
  for insert
  to authenticated
  with check (app_private.person_is_accessible(person_id));

create policy one_rm_tests_delete_managed
  on public.one_rm_tests
  for delete
  to authenticated
  using (app_private.person_is_accessible(person_id));

create policy bodyweight_logs_select_managed
  on public.bodyweight_logs
  for select
  to authenticated
  using (app_private.person_is_accessible(person_id));

create policy bodyweight_logs_insert_managed
  on public.bodyweight_logs
  for insert
  to authenticated
  with check (app_private.person_is_accessible(person_id));

create policy bodyweight_logs_delete_managed
  on public.bodyweight_logs
  for delete
  to authenticated
  using (app_private.person_is_accessible(person_id));

create policy goals_select_managed
  on public.goals
  for select
  to authenticated
  using (app_private.person_is_accessible(person_id));

create policy goals_insert_managed
  on public.goals
  for insert
  to authenticated
  with check (app_private.person_is_accessible(person_id));

create policy goals_update_managed
  on public.goals
  for update
  to authenticated
  using (app_private.person_is_accessible(person_id))
  with check (app_private.person_is_accessible(person_id));

create policy goals_delete_managed
  on public.goals
  for delete
  to authenticated
  using (app_private.person_is_accessible(person_id));

create policy goal_checkins_select_managed
  on public.goal_checkins
  for select
  to authenticated
  using (app_private.person_is_accessible(person_id));

create policy goal_checkins_insert_managed
  on public.goal_checkins
  for insert
  to authenticated
  with check (
    app_private.person_is_accessible(person_id)
    and exists (
      select 1
      from public.goals g
      where g.id = goal_id
        and g.person_id = goal_checkins.person_id
        and app_private.person_is_accessible(g.person_id)
    )
  );

create policy goal_checkins_delete_managed
  on public.goal_checkins
  for delete
  to authenticated
  using (app_private.person_is_accessible(person_id));

create policy programs_select_templates_authenticated
  on public.programs
  for select
  to authenticated
  using (is_template = true);

create policy program_workouts_select_template_authenticated
  on public.program_workouts
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.programs p
      where p.id = public.program_workouts.program_id
        and p.is_template = true
    )
  );

create policy program_workout_entries_select_template_authenticated
  on public.program_workout_entries
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.program_workouts pw
      join public.programs p on p.id = pw.program_id
      where pw.id = public.program_workout_entries.program_workout_id
        and p.is_template = true
    )
  );

create policy program_assignment_exercises_select_managed
  on public.program_assignment_exercises
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.program_assignments pa
      where pa.id = program_assignment_id
        and app_private.person_is_accessible(pa.person_id)
    )
  );

create policy program_assignment_exercises_insert_managed
  on public.program_assignment_exercises
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.program_assignments pa
      where pa.id = program_assignment_id
        and app_private.person_is_accessible(pa.person_id)
    )
  );

create policy program_assignment_exercises_update_managed
  on public.program_assignment_exercises
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.program_assignments pa
      where pa.id = program_assignment_id
        and app_private.person_is_accessible(pa.person_id)
    )
  )
  with check (
    exists (
      select 1
      from public.program_assignments pa
      where pa.id = program_assignment_id
        and app_private.person_is_accessible(pa.person_id)
    )
  );

create policy program_assignment_exercises_delete_managed
  on public.program_assignment_exercises
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.program_assignments pa
      where pa.id = program_assignment_id
        and app_private.person_is_accessible(pa.person_id)
    )
  );
