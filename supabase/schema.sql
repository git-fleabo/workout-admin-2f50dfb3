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
  position_measurement_guide text
    check (
      position_measurement_guide is null
      or position_measurement_guide in ('foam_cork_blocks')
    ),
  position_measurement_label text,
  position_measurement_direction text
    check (
      position_measurement_direction is null
      or position_measurement_direction in ('lower', 'higher', 'neutral')
    ),
  circuit_suitability text not null default 'available'
    check (circuit_suitability in ('preferred', 'available', 'excluded')),
  circuit_pattern text not null default 'other'
    check (
      circuit_pattern in (
        'push', 'pull', 'squat', 'hinge', 'lunge', 'carry', 'core', 'locomotion',
        'mobility', 'power', 'grip', 'full_body', 'skill', 'other'
      )
    ),
  circuit_difficulty text not null default 'intermediate'
    check (circuit_difficulty in ('beginner', 'intermediate', 'advanced')),
  circuit_impact text not null default 'low'
    check (circuit_impact in ('low', 'moderate', 'high')),
  circuit_dose_mode text not null default 'reps'
    check (circuit_dose_mode in ('reps', 'seconds', 'metres', 'rounds')),
  circuit_dose_min numeric check (circuit_dose_min is null or circuit_dose_min > 0),
  circuit_dose_max numeric check (circuit_dose_max is null or circuit_dose_max > 0),
  circuit_dose_per_side boolean not null default false,
  notes text,
  is_active boolean not null default true,
  source_sheet text,
  source_row integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_sheet, source_row),
  check (
    circuit_dose_min is null
    or circuit_dose_max is null
    or circuit_dose_max >= circuit_dose_min
  )
);

create trigger exercises_set_updated_at
before update on public.exercises
for each row execute function public.set_updated_at();

create table if not exists public.exercise_aliases (
  id uuid primary key default gen_random_uuid(),
  alias_name text not null,
  normalized_alias text generated always as (
    regexp_replace(lower(btrim(alias_name)), '[^a-z0-9]+', '', 'g')
  ) stored,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  activity_type_id uuid references public.activity_types(id) on delete cascade,
  status text not null default 'reviewed'
    check (status in ('reviewed', 'deprecated', 'manual_review')),
  reason text,
  reviewed_by uuid references public.people(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(btrim(alias_name)) > 0),
  check (length(normalized_alias) > 0)
);

create unique index if not exists exercise_aliases_global_uidx
  on public.exercise_aliases (normalized_alias)
  where activity_type_id is null and status = 'reviewed';

create unique index if not exists exercise_aliases_activity_uidx
  on public.exercise_aliases (normalized_alias, activity_type_id)
  where activity_type_id is not null and status = 'reviewed';

create index if not exists exercise_aliases_exercise_idx
  on public.exercise_aliases (exercise_id);

create index if not exists exercise_aliases_activity_type_idx
  on public.exercise_aliases (activity_type_id)
  where activity_type_id is not null;

create index if not exists exercise_aliases_reviewed_by_idx
  on public.exercise_aliases (reviewed_by)
  where reviewed_by is not null;

create trigger exercise_aliases_set_updated_at
before update on public.exercise_aliases
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
  location_scope text not null default 'both'
    check (location_scope in ('home', 'gym', 'both')),
  is_quick_log boolean not null default false,
  quick_log_order integer,
  custom_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id, exercise_id),
  check (
    (is_quick_log and quick_log_order is not null and quick_log_order >= 0)
    or (not is_quick_log and quick_log_order is null)
  )
);

create unique index if not exists person_exercises_quick_log_order_uidx
  on public.person_exercises (person_id, quick_log_order)
  where is_quick_log;

create trigger person_exercises_set_updated_at
before update on public.person_exercises
for each row execute function public.set_updated_at();

create table if not exists public.training_locations (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  name text not null,
  kind text not null default 'other'
    check (kind in ('home', 'gym', 'other')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id, name)
);

create trigger training_locations_set_updated_at
before update on public.training_locations
for each row execute function public.set_updated_at();

create table if not exists public.equipment_items (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  name text not null,
  category text not null default 'accessory'
    check (category in ('free_weights', 'fixed_equipment', 'cardio', 'functional', 'accessory')),
  circuit_group text not null default 'specialist'
    check (
      circuit_group in (
        'mat', 'kettlebell', 'dumbbell', 'barbell', 'bar_rings',
        'cardio_machine', 'cable_machine', 'specialist'
      )
    ),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists equipment_items_person_name_unique
  on public.equipment_items (person_id, lower(name));
create index if not exists equipment_items_person_active_idx
  on public.equipment_items (person_id, is_active, sort_order, name);

create trigger equipment_items_set_updated_at
before update on public.equipment_items
for each row execute function public.set_updated_at();

create table if not exists public.exercise_equipment_items (
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  equipment_item_id uuid not null references public.equipment_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (exercise_id, equipment_item_id)
);

create index if not exists exercise_equipment_items_equipment_idx
  on public.exercise_equipment_items (equipment_item_id, exercise_id);

create table if not exists public.training_location_equipment (
  location_id uuid not null references public.training_locations(id) on delete cascade,
  equipment_item_id uuid not null references public.equipment_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (location_id, equipment_item_id)
);

create index if not exists training_location_equipment_item_idx
  on public.training_location_equipment (equipment_item_id, location_id);

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
  training_location_id uuid references public.training_locations(id) on delete set null,
  source_sheet text,
  source_row integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_sheet, source_row),
  check (not completed or activity_type_id is not null)
);

create trigger sessions_set_updated_at
before update on public.sessions
for each row execute function public.set_updated_at();

create index if not exists sessions_training_location_idx
  on public.sessions (training_location_id);

create table if not exists public.session_entries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null,
  activity_type_id uuid not null references public.activity_types(id) on delete set null,
  entry_kind text,
  name text not null,
  progression_level text,
  grade text,
  grade_system text check (grade_system is null or grade_system in ('V-scale', 'Font', 'French', 'YDS')),
  send_type text check (send_type is null or send_type in ('attempt', 'flash', 'onsight', 'redpoint')),
  is_project boolean default false,
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
  data_shape text not null default 'individual'
    check (data_shape in ('individual', 'aggregate', 'unknown')),
  aggregate_set_count integer,
  load_semantics text not null default 'unknown'
    check (
      load_semantics in (
        'total_external_load',
        'per_implement_load',
        'combined_implement_load',
        'added_bodyweight_load',
        'assistance',
        'bodyweight_contribution',
        'none',
        'unknown'
      )
    ),
  volume_status text not null default 'unknown'
    check (volume_status in ('exact', 'ambiguous', 'not_applicable', 'unknown')),
  implement_count integer,
  check (
    (data_shape = 'aggregate' and aggregate_set_count is not null and aggregate_set_count > 0)
    or (data_shape <> 'aggregate' and aggregate_set_count is null)
  ),
  check (
    (load_semantics = 'per_implement_load' and implement_count is not null and implement_count > 0)
    or (load_semantics <> 'per_implement_load' and implement_count is null)
  ),
  check (set_number > 0),
  check (
    coalesce(reps, 0) >= 0
    and coalesce(weight, 0) >= 0
    and coalesce(duration_seconds, 0) >= 0
    and coalesce(distance, 0) >= 0
  ),
  unique (session_entry_id, set_number),
  created_at timestamptz not null default now()
);

create table if not exists public.data_quality_batches (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  batch_kind text not null,
  status text not null default 'planned'
    check (status in ('planned', 'applied', 'reversed', 'failed')),
  approved_checksum text,
  applied_checksum text,
  notes text,
  created_by uuid references public.people(id) on delete set null,
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  reversed_at timestamptz
);

create table if not exists public.data_quality_audit_events (
  id bigint generated by default as identity primary key,
  batch_id uuid not null references public.data_quality_batches(id) on delete restrict,
  person_id uuid not null references public.people(id) on delete cascade,
  entity_table text not null,
  entity_id text not null,
  action text not null check (action in ('insert', 'update', 'move', 'delete', 'restore')),
  before_value jsonb,
  after_value jsonb,
  reason text not null,
  reversal_value jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists data_quality_batches_person_checksum_uidx
  on public.data_quality_batches (person_id, approved_checksum)
  where approved_checksum is not null;

create index if not exists data_quality_batches_created_by_idx
  on public.data_quality_batches (created_by)
  where created_by is not null;

create index if not exists data_quality_audit_events_person_idx
  on public.data_quality_audit_events (person_id);

create table if not exists app_private.data_quality_snapshots (
  batch_id uuid not null references public.data_quality_batches(id) on delete restrict,
  entity_table text not null,
  entity_id text not null,
  row_value jsonb not null,
  captured_at timestamptz not null default now(),
  primary key (batch_id, entity_table, entity_id)
);

revoke all on table app_private.data_quality_snapshots from public, anon, authenticated;

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
  goal_type text not null default 'legacy'
    check (goal_type in ('legacy', 'consistency', 'performance', 'duration', 'milestone')),
  exercise_id uuid references public.exercises(id) on delete set null,
  tracking_mode text,
  goal_metric text
    check (
      goal_metric is null
      or goal_metric in (
        'sessions',
        'active_days',
        'minutes',
        'checkins',
        'max_weight',
        'estimated_1rm',
        'reps',
        'hold_seconds',
        'duration_minutes',
        'distance_km',
        'distance_m',
        'rounds',
        'height_cm',
        'problems',
        'completed'
      )
    ),
  target_value numeric check (target_value is null or target_value > 0),
  target_unit text,
  starting_value numeric,
  deadline date,
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

create table if not exists public.daily_rotation_items (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  target text,
  cue text,
  selection_weight smallint not null default 3
    check (selection_weight between 1 and 5),
  active_days smallint[] not null default array[1, 2, 3, 4, 5, 6, 7]::smallint[]
    check (
      cardinality(active_days) > 0
      and active_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
    ),
  minimum_days_between smallint not null default 1
    check (minimum_days_between between 0 and 30),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_rotation_assignments (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  item_id uuid not null references public.daily_rotation_items(id) on delete cascade,
  assigned_date date not null default current_date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (person_id, assigned_date)
);

create trigger daily_rotation_items_set_updated_at
before update on public.daily_rotation_items
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
  intensity_min_percent numeric,
  intensity_max_percent numeric,
  percent_base text,
  rounding_increment numeric,
  is_optional boolean default false,
  weight text,
  duration text,
  rpe text,
  rpe_cap numeric check (rpe_cap is null or rpe_cap between 1 and 10),
  selection_role text check (selection_role is null or selection_role in ('power', 'accessory', 'pull')),
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
  cycle_number integer not null default 1 check (cycle_number >= 1),
  previous_assignment_id uuid references public.program_assignments(id) on delete set null,
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
  is_enabled boolean not null default true,
  load_adjustment_percent numeric not null default 0
    check (load_adjustment_percent between -10 and 5),
  manual_adjustment_percent numeric not null default 0
    check (manual_adjustment_percent between -5 and 5),
  manual_adjusted_at timestamptz,
  last_decision text check (last_decision is null or last_decision in ('progress', 'repeat', 'regress')),
  one_rm_test_id uuid references public.one_rm_tests(id),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (program_assignment_id, slot_key)
);

create trigger program_assignment_exercises_set_updated_at
before update on public.program_assignment_exercises
for each row execute function public.set_updated_at();

create or replace function public.apply_programme_manual_adjustments(
  p_assignment_id uuid,
  p_adjustments jsonb
)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  adjustment_item jsonb;
  exercise_id_value uuid;
  adjustment_value numeric;
  affected_rows integer;
  updated_count integer := 0;
begin
  if jsonb_typeof(p_adjustments) <> 'array' or jsonb_array_length(p_adjustments) = 0 then
    raise exception 'At least one programme adjustment is required.';
  end if;

  if not exists (
    select 1
    from public.program_assignments assignment
    where assignment.id = p_assignment_id
      and assignment.status in ('active', 'paused')
  ) then
    raise exception 'The active programme assignment was not found.';
  end if;

  for adjustment_item in
    select value from jsonb_array_elements(p_adjustments)
  loop
    exercise_id_value := (adjustment_item ->> 'exercise_id')::uuid;
    adjustment_value := (adjustment_item ->> 'manual_adjustment_percent')::numeric;

    if adjustment_value not in (-5, -2.5, 0, 2.5, 5) then
      raise exception 'Programme adjustments must use a supported 2.5-point step.';
    end if;

    update public.program_assignment_exercises exercise
    set manual_adjustment_percent = adjustment_value,
        manual_adjusted_at = case when adjustment_value = 0 then null else now() end
    where exercise.id = exercise_id_value
      and exercise.program_assignment_id = p_assignment_id
      and exercise.is_enabled;

    get diagnostics affected_rows = row_count;
    if affected_rows <> 1 then
      raise exception 'A programme exercise could not be updated.';
    end if;
    updated_count := updated_count + affected_rows;
  end loop;

  return updated_count;
end;
$$;

revoke all on function public.apply_programme_manual_adjustments(uuid, jsonb) from public;
revoke all on function public.apply_programme_manual_adjustments(uuid, jsonb) from anon;
grant execute on function public.apply_programme_manual_adjustments(uuid, jsonb) to authenticated;

create table if not exists public.program_assignment_exercise_pools (
  id uuid primary key default gen_random_uuid(),
  program_assignment_id uuid not null references public.program_assignments(id) on delete cascade,
  role text not null check (role in ('power', 'accessory', 'pull')),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  exercise_name text not null,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (program_assignment_id, role, exercise_id)
);

create table if not exists public.program_workout_reviews (
  id uuid primary key default gen_random_uuid(),
  program_assignment_id uuid not null references public.program_assignments(id) on delete cascade,
  program_workout_id uuid not null references public.program_workouts(id) on delete cascade,
  program_assignment_exercise_id uuid not null references public.program_assignment_exercises(id) on delete cascade,
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

create table if not exists public.suggested_workouts (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  program_assignment_id uuid references public.program_assignments(id) on delete set null,
  program_workout_id uuid references public.program_workouts(id) on delete set null,
  training_location_id uuid references public.training_locations(id) on delete set null,
  suggested_for date,
  plan_kind text check (
    plan_kind is null or plan_kind in (
      'strength', 'conditioning', 'climbing', 'yoga', 'mobility', 'skill', 'other'
    )
  ),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'completed', 'skipped', 'archived')),
  title text not null,
  readiness text check (readiness in ('normal', 'fresh', 'tired')),
  basis text,
  completed_session_id uuid references public.sessions(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger suggested_workouts_set_updated_at
before update on public.suggested_workouts
for each row execute function public.set_updated_at();

create index suggested_workouts_person_schedule_idx
  on public.suggested_workouts (person_id, suggested_for, status)
  where suggested_for is not null;

create table if not exists public.suggested_workout_entries (
  id uuid primary key default gen_random_uuid(),
  suggested_workout_id uuid not null references public.suggested_workouts(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null,
  name text not null,
  workout_type text,
  order_index integer not null default 0,
  source_date date,
  reason text,
  tracking_mode text check (
    tracking_mode is null or tracking_mode in (
      'weight_reps', 'reps_only', 'hold', 'grip_hold', 'distance_time', 'duration',
      'conditioning', 'carry', 'mobility_position', 'power', 'climbing'
    )
  ),
  target_metrics jsonb not null default '{}'::jsonb
    check (jsonb_typeof(target_metrics) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (suggested_workout_id, order_index)
);

create trigger suggested_workout_entries_set_updated_at
before update on public.suggested_workout_entries
for each row execute function public.set_updated_at();

create table if not exists public.suggested_workout_sets (
  id uuid primary key default gen_random_uuid(),
  suggested_workout_entry_id uuid not null references public.suggested_workout_entries(id) on delete cascade,
  set_number integer not null,
  reps numeric,
  weight numeric,
  duration_seconds numeric check (duration_seconds is null or duration_seconds >= 0),
  rpe numeric,
  completed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (suggested_workout_entry_id, set_number)
);

create trigger suggested_workout_sets_set_updated_at
before update on public.suggested_workout_sets
for each row execute function public.set_updated_at();

create or replace function public.complete_suggested_workout(
  p_workout_id uuid,
  p_session_id uuid
)
returns table (
  program_assignment_id uuid,
  current_workout_index integer,
  assignment_status text
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  workout_row public.suggested_workouts%rowtype;
  assignment_row public.program_assignments%rowtype;
  expected_workout_id uuid;
  total_workouts integer;
  next_workout_index integer;
begin
  select workout.*
  into workout_row
  from public.suggested_workouts workout
  where workout.id = p_workout_id
  for update;

  if not found then
    raise exception 'The workout plan could not be found.';
  end if;

  if not exists (
    select 1
    from public.sessions session
    where session.id = p_session_id
      and session.person_id = workout_row.person_id
      and session.completed = true
  ) then
    raise exception 'The completed session does not match this workout plan.';
  end if;

  if workout_row.status = 'completed' then
    if workout_row.completed_session_id is distinct from p_session_id then
      raise exception 'This workout plan is already linked to another completed session.';
    end if;
  elsif workout_row.status in ('pending', 'accepted') then
    update public.suggested_workouts
    set status = 'completed',
        completed_session_id = p_session_id
    where id = workout_row.id;
  else
    raise exception 'Only a pending or accepted workout plan can be completed.';
  end if;

  if workout_row.program_assignment_id is null then
    return query select null::uuid, null::integer, null::text;
    return;
  end if;

  select assignment.*
  into assignment_row
  from public.program_assignments assignment
  where assignment.id = workout_row.program_assignment_id
  for update;

  if not found then
    raise exception 'The linked programme assignment could not be found.';
  end if;

  if workout_row.program_workout_id is null then
    return query
    select assignment_row.id, assignment_row.current_workout_index, assignment_row.status;
    return;
  end if;

  if workout_row.status <> 'completed' then
    select programme_workout.id
    into expected_workout_id
    from public.program_workouts programme_workout
    where programme_workout.program_id = assignment_row.program_id
    order by programme_workout.sequence_index, programme_workout.id
    offset assignment_row.current_workout_index
    limit 1;

    if expected_workout_id is distinct from workout_row.program_workout_id then
      raise exception 'This is not the assignment''s current programme session.';
    end if;

    select count(*)::integer
    into total_workouts
    from public.program_workouts programme_workout
    where programme_workout.program_id = assignment_row.program_id;

    next_workout_index := assignment_row.current_workout_index + 1;

    update public.program_assignments
    set current_workout_index = next_workout_index,
        status = case when next_workout_index >= total_workouts then 'complete' else status end,
        completed_on = case when next_workout_index >= total_workouts then current_date else null end
    where id = assignment_row.id
    returning * into assignment_row;
  end if;

  return query
  select assignment_row.id, assignment_row.current_workout_index, assignment_row.status;
end;
$$;

revoke all on function public.complete_suggested_workout(uuid, uuid) from public;
revoke all on function public.complete_suggested_workout(uuid, uuid) from anon;
grant execute on function public.complete_suggested_workout(uuid, uuid) to authenticated;

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
  ('Mixed Training', 'mixed-training', 95),
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

create index if not exists goals_exercise_id_idx
  on public.goals (exercise_id)
  where exercise_id is not null;

create index if not exists goal_checkins_person_date_idx
  on public.goal_checkins (person_id, checked_date desc);

create index if not exists goal_checkins_goal_date_idx
  on public.goal_checkins (goal_id, checked_date desc);

create index if not exists daily_rotation_items_person_active_idx
  on public.daily_rotation_items (person_id, is_active, sort_order);

create index if not exists daily_rotation_assignments_person_date_idx
  on public.daily_rotation_assignments (person_id, assigned_date desc);

create index if not exists daily_rotation_assignments_item_date_idx
  on public.daily_rotation_assignments (item_id, assigned_date desc);

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

create unique index if not exists suggested_workouts_open_programme_session_uidx
  on public.suggested_workouts (program_assignment_id, program_workout_id)
  where program_assignment_id is not null
    and program_workout_id is not null
    and status in ('pending', 'accepted');

create index if not exists suggested_workouts_location_status_idx
  on public.suggested_workouts (person_id, training_location_id, status, created_at desc);

create index if not exists suggested_workouts_training_location_idx
  on public.suggested_workouts (training_location_id);

create index if not exists suggested_workouts_completed_session_idx
  on public.suggested_workouts (completed_session_id);

create index if not exists suggested_workout_entries_workout_idx
  on public.suggested_workout_entries (suggested_workout_id, order_index);

create index if not exists suggested_workout_entries_exercise_idx
  on public.suggested_workout_entries (exercise_id);

create index if not exists suggested_workout_sets_entry_idx
  on public.suggested_workout_sets (suggested_workout_entry_id, set_number);

alter table public.people enable row level security;
alter table public.admin_people enable row level security;
alter table public.app_profiles enable row level security;
alter table public.person_app_profiles enable row level security;
alter table public.activity_types enable row level security;
alter table public.exercises enable row level security;
alter table public.exercise_aliases enable row level security;
alter table public.exercise_tags enable row level security;
alter table public.exercise_tag_links enable row level security;
alter table public.person_exercises enable row level security;
alter table public.training_locations enable row level security;
alter table public.equipment_items enable row level security;
alter table public.exercise_equipment_items enable row level security;
alter table public.training_location_equipment enable row level security;
alter table public.sessions enable row level security;
alter table public.session_entries enable row level security;
alter table public.entry_sets enable row level security;
alter table public.entry_metrics enable row level security;
alter table public.data_quality_batches enable row level security;
alter table public.data_quality_audit_events enable row level security;
alter table public.one_rm_tests enable row level security;
alter table public.bodyweight_logs enable row level security;
alter table public.goals enable row level security;
alter table public.goal_checkins enable row level security;
alter table public.daily_rotation_items enable row level security;
alter table public.daily_rotation_assignments enable row level security;
alter table public.programs enable row level security;
alter table public.program_workouts enable row level security;
alter table public.program_workout_entries enable row level security;
alter table public.program_assignments enable row level security;
alter table public.program_assignment_exercises enable row level security;
alter table public.program_assignment_exercise_pools enable row level security;
alter table public.program_workout_reviews enable row level security;
alter table public.suggested_workouts enable row level security;
alter table public.suggested_workout_entries enable row level security;
alter table public.suggested_workout_sets enable row level security;

grant usage on schema public to authenticated;

grant select on
  public.people,
  public.admin_people,
  public.app_profiles,
  public.person_app_profiles,
  public.activity_types,
  public.exercises,
  public.exercise_aliases,
  public.exercise_tags,
  public.exercise_tag_links,
  public.person_exercises,
  public.training_locations,
  public.equipment_items,
  public.exercise_equipment_items,
  public.training_location_equipment,
  public.sessions,
  public.session_entries,
  public.entry_sets,
  public.entry_metrics,
  public.data_quality_batches,
  public.data_quality_audit_events,
  public.one_rm_tests,
  public.bodyweight_logs,
  public.goals,
  public.goal_checkins,
  public.daily_rotation_items,
  public.daily_rotation_assignments,
  public.programs,
  public.program_workouts,
  public.program_workout_entries,
  public.program_assignments,
  public.program_assignment_exercises,
  public.suggested_workouts,
  public.suggested_workout_entries,
  public.suggested_workout_sets
to authenticated;

grant insert, update, delete on public.goals to authenticated;
grant insert, delete on public.goal_checkins to authenticated;
grant insert, update, delete on public.daily_rotation_items to authenticated;
grant insert, update, delete on public.daily_rotation_assignments to authenticated;
grant insert, update on public.activity_types to authenticated;
grant insert, update on public.exercises to authenticated;
grant insert, update, delete on public.exercise_aliases to authenticated;
grant insert, update, delete on public.exercise_tags to authenticated;
grant insert, delete on public.exercise_tag_links to authenticated;
grant insert, update, delete on public.person_exercises to authenticated;
grant insert, update, delete on public.training_locations to authenticated;
grant insert, update, delete on public.equipment_items to authenticated;
grant insert, delete on public.exercise_equipment_items to authenticated;
grant insert, delete on public.training_location_equipment to authenticated;
grant insert, update, delete on public.program_assignments to authenticated;
grant insert on public.sessions to authenticated;
grant insert on public.session_entries to authenticated;
grant insert on public.entry_sets to authenticated;
grant insert on public.entry_metrics to authenticated;
grant insert on public.one_rm_tests to authenticated;
grant insert, update, delete on public.program_assignment_exercises to authenticated;
grant select, insert, update, delete on public.program_assignment_exercise_pools to authenticated;
grant select, insert, update, delete on public.program_workout_reviews to authenticated;
grant insert, update, delete on public.suggested_workouts to authenticated;
grant insert, update, delete on public.suggested_workout_entries to authenticated;
grant insert, update, delete on public.suggested_workout_sets to authenticated;
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

create policy exercise_aliases_select_authenticated
  on public.exercise_aliases
  for select
  to authenticated
  using (true);

create policy exercise_aliases_insert_admin
  on public.exercise_aliases
  for insert
  to authenticated
  with check (app_private.current_person_is_admin());

create policy exercise_aliases_update_admin
  on public.exercise_aliases
  for update
  to authenticated
  using (app_private.current_person_is_admin())
  with check (app_private.current_person_is_admin());

create policy exercise_aliases_delete_admin
  on public.exercise_aliases
  for delete
  to authenticated
  using (app_private.current_person_is_admin());

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

create policy exercise_tags_insert_admin
  on public.exercise_tags
  for insert
  to authenticated
  with check (app_private.current_person_is_admin());

create policy exercise_tags_update_admin
  on public.exercise_tags
  for update
  to authenticated
  using (app_private.current_person_is_admin())
  with check (app_private.current_person_is_admin());

create policy exercise_tags_delete_admin
  on public.exercise_tags
  for delete
  to authenticated
  using (app_private.current_person_is_admin());

create policy exercise_tag_links_insert_admin
  on public.exercise_tag_links
  for insert
  to authenticated
  with check (app_private.current_person_is_admin());

create policy exercise_tag_links_delete_admin
  on public.exercise_tag_links
  for delete
  to authenticated
  using (app_private.current_person_is_admin());

create policy data_quality_batches_select_managed
  on public.data_quality_batches
  for select
  to authenticated
  using (app_private.person_is_accessible(person_id));

create policy data_quality_audit_events_select_managed
  on public.data_quality_audit_events
  for select
  to authenticated
  using (app_private.person_is_accessible(person_id));

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

create policy training_locations_select_managed
  on public.training_locations
  for select
  to authenticated
  using (app_private.person_is_accessible(person_id));

create policy training_locations_insert_managed
  on public.training_locations
  for insert
  to authenticated
  with check (app_private.person_is_accessible(person_id));

create policy training_locations_update_managed
  on public.training_locations
  for update
  to authenticated
  using (app_private.person_is_accessible(person_id))
  with check (app_private.person_is_accessible(person_id));

create policy training_locations_delete_managed
  on public.training_locations
  for delete
  to authenticated
  using (app_private.person_is_accessible(person_id));

create policy equipment_items_select_accessible
  on public.equipment_items
  for select
  to authenticated
  using (app_private.person_is_accessible(person_id));

create policy equipment_items_insert_accessible
  on public.equipment_items
  for insert
  to authenticated
  with check (app_private.person_is_accessible(person_id));

create policy equipment_items_update_accessible
  on public.equipment_items
  for update
  to authenticated
  using (app_private.person_is_accessible(person_id))
  with check (app_private.person_is_accessible(person_id));

create policy equipment_items_delete_accessible
  on public.equipment_items
  for delete
  to authenticated
  using (app_private.person_is_accessible(person_id));

create policy exercise_equipment_items_select_accessible
  on public.exercise_equipment_items
  for select
  to authenticated
  using (exists (
    select 1
    from public.equipment_items equipment
    where equipment.id = equipment_item_id
      and app_private.person_is_accessible(equipment.person_id)
  ));

create policy exercise_equipment_items_insert_admin
  on public.exercise_equipment_items
  for insert
  to authenticated
  with check (
    app_private.current_person_is_admin()
    and exists (
      select 1
      from public.equipment_items equipment
      where equipment.id = equipment_item_id
        and app_private.person_is_accessible(equipment.person_id)
    )
  );

create policy exercise_equipment_items_delete_admin
  on public.exercise_equipment_items
  for delete
  to authenticated
  using (
    app_private.current_person_is_admin()
    and exists (
      select 1
      from public.equipment_items equipment
      where equipment.id = equipment_item_id
        and app_private.person_is_accessible(equipment.person_id)
    )
  );

create policy training_location_equipment_select_accessible
  on public.training_location_equipment
  for select
  to authenticated
  using (exists (
    select 1
    from public.training_locations location
    join public.equipment_items equipment
      on equipment.id = equipment_item_id
     and equipment.person_id = location.person_id
    where location.id = location_id
      and app_private.person_is_accessible(location.person_id)
  ));

create policy training_location_equipment_insert_accessible
  on public.training_location_equipment
  for insert
  to authenticated
  with check (exists (
    select 1
    from public.training_locations location
    join public.equipment_items equipment
      on equipment.id = equipment_item_id
     and equipment.person_id = location.person_id
    where location.id = location_id
      and app_private.person_is_accessible(location.person_id)
  ));

create policy training_location_equipment_delete_accessible
  on public.training_location_equipment
  for delete
  to authenticated
  using (exists (
    select 1
    from public.training_locations location
    join public.equipment_items equipment
      on equipment.id = equipment_item_id
     and equipment.person_id = location.person_id
    where location.id = location_id
      and app_private.person_is_accessible(location.person_id)
  ));

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

create policy sessions_update_managed
  on public.sessions
  for update
  to authenticated
  using (app_private.person_is_accessible(person_id))
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

create policy daily_rotation_items_select_managed
  on public.daily_rotation_items
  for select
  to authenticated
  using (app_private.person_is_accessible(person_id));

create policy daily_rotation_items_insert_managed
  on public.daily_rotation_items
  for insert
  to authenticated
  with check (app_private.person_is_accessible(person_id));

create policy daily_rotation_items_update_managed
  on public.daily_rotation_items
  for update
  to authenticated
  using (app_private.person_is_accessible(person_id))
  with check (app_private.person_is_accessible(person_id));

create policy daily_rotation_items_delete_managed
  on public.daily_rotation_items
  for delete
  to authenticated
  using (app_private.person_is_accessible(person_id));

create policy daily_rotation_assignments_select_managed
  on public.daily_rotation_assignments
  for select
  to authenticated
  using (app_private.person_is_accessible(person_id));

create policy daily_rotation_assignments_insert_managed
  on public.daily_rotation_assignments
  for insert
  to authenticated
  with check (
    app_private.person_is_accessible(person_id)
    and exists (
      select 1
      from public.daily_rotation_items item
      where item.id = item_id
        and item.person_id = daily_rotation_assignments.person_id
        and app_private.person_is_accessible(item.person_id)
    )
  );

create policy daily_rotation_assignments_update_managed
  on public.daily_rotation_assignments
  for update
  to authenticated
  using (app_private.person_is_accessible(person_id))
  with check (
    app_private.person_is_accessible(person_id)
    and exists (
      select 1
      from public.daily_rotation_items item
      where item.id = item_id
        and item.person_id = daily_rotation_assignments.person_id
        and app_private.person_is_accessible(item.person_id)
    )
  );

create policy daily_rotation_assignments_delete_managed
  on public.daily_rotation_assignments
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

create policy program_assignments_select_managed
  on public.program_assignments
  for select
  to authenticated
  using (app_private.person_is_accessible(person_id));

create policy program_assignments_insert_managed
  on public.program_assignments
  for insert
  to authenticated
  with check (
    app_private.person_is_accessible(person_id)
    and exists (
      select 1
      from public.programs p
      where p.id = program_id
        and p.is_template = true
    )
  );

create policy program_assignments_update_managed
  on public.program_assignments
  for update
  to authenticated
  using (app_private.person_is_accessible(person_id))
  with check (
    app_private.person_is_accessible(person_id)
    and exists (
      select 1
      from public.programs p
      where p.id = program_id
        and p.is_template = true
    )
  );

create policy program_assignments_delete_managed
  on public.program_assignments
  for delete
  to authenticated
  using (app_private.person_is_accessible(person_id));

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

create policy suggested_workouts_select_accessible
  on public.suggested_workouts for select to authenticated
  using (app_private.person_is_accessible(person_id));

create policy suggested_workouts_insert_accessible
  on public.suggested_workouts for insert to authenticated
  with check (app_private.person_is_accessible(person_id));

create policy suggested_workouts_update_accessible
  on public.suggested_workouts for update to authenticated
  using (app_private.person_is_accessible(person_id))
  with check (app_private.person_is_accessible(person_id));

create policy suggested_workouts_delete_accessible
  on public.suggested_workouts for delete to authenticated
  using (app_private.person_is_accessible(person_id));

create policy suggested_workout_entries_select_accessible
  on public.suggested_workout_entries for select to authenticated
  using (exists (
    select 1 from public.suggested_workouts workout
    where workout.id = suggested_workout_id
      and app_private.person_is_accessible(workout.person_id)
  ));

create policy suggested_workout_entries_insert_accessible
  on public.suggested_workout_entries for insert to authenticated
  with check (exists (
    select 1 from public.suggested_workouts workout
    where workout.id = suggested_workout_id
      and app_private.person_is_accessible(workout.person_id)
  ));

create policy suggested_workout_entries_update_accessible
  on public.suggested_workout_entries for update to authenticated
  using (exists (
    select 1 from public.suggested_workouts workout
    where workout.id = suggested_workout_id
      and app_private.person_is_accessible(workout.person_id)
  ))
  with check (exists (
    select 1 from public.suggested_workouts workout
    where workout.id = suggested_workout_id
      and app_private.person_is_accessible(workout.person_id)
  ));

create policy suggested_workout_entries_delete_accessible
  on public.suggested_workout_entries for delete to authenticated
  using (exists (
    select 1 from public.suggested_workouts workout
    where workout.id = suggested_workout_id
      and app_private.person_is_accessible(workout.person_id)
  ));

create policy suggested_workout_sets_select_accessible
  on public.suggested_workout_sets for select to authenticated
  using (exists (
    select 1
    from public.suggested_workout_entries entry
    join public.suggested_workouts workout on workout.id = entry.suggested_workout_id
    where entry.id = suggested_workout_entry_id
      and app_private.person_is_accessible(workout.person_id)
  ));

create policy suggested_workout_sets_insert_accessible
  on public.suggested_workout_sets for insert to authenticated
  with check (exists (
    select 1
    from public.suggested_workout_entries entry
    join public.suggested_workouts workout on workout.id = entry.suggested_workout_id
    where entry.id = suggested_workout_entry_id
      and app_private.person_is_accessible(workout.person_id)
  ));

create policy suggested_workout_sets_update_accessible
  on public.suggested_workout_sets for update to authenticated
  using (exists (
    select 1
    from public.suggested_workout_entries entry
    join public.suggested_workouts workout on workout.id = entry.suggested_workout_id
    where entry.id = suggested_workout_entry_id
      and app_private.person_is_accessible(workout.person_id)
  ))
  with check (exists (
    select 1
    from public.suggested_workout_entries entry
    join public.suggested_workouts workout on workout.id = entry.suggested_workout_id
    where entry.id = suggested_workout_entry_id
      and app_private.person_is_accessible(workout.person_id)
  ));

create policy suggested_workout_sets_delete_accessible
  on public.suggested_workout_sets for delete to authenticated
  using (exists (
    select 1
    from public.suggested_workout_entries entry
    join public.suggested_workouts workout on workout.id = entry.suggested_workout_id
    where entry.id = suggested_workout_entry_id
      and app_private.person_is_accessible(workout.person_id)
  ));
create table if not exists public.training_methods (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references public.people(id) on delete cascade,
  system_key text unique,
  name text not null,
  family text not null check (family in ('exercise_group', 'set_method', 'timed_density')),
  description text,
  default_config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_methods_owner_check check (
    (person_id is null and system_key is not null)
    or (person_id is not null and system_key is null)
  )
);

create table if not exists public.person_training_methods (
  person_id uuid not null references public.people(id) on delete cascade,
  training_method_id uuid not null references public.training_methods(id) on delete cascade,
  is_enabled boolean not null default true,
  default_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (person_id, training_method_id)
);

drop trigger if exists training_methods_set_updated_at on public.training_methods;
create trigger training_methods_set_updated_at
before update on public.training_methods
for each row execute function public.set_updated_at();

drop trigger if exists person_training_methods_set_updated_at on public.person_training_methods;
create trigger person_training_methods_set_updated_at
before update on public.person_training_methods
for each row execute function public.set_updated_at();

create index if not exists training_methods_person_family_idx
  on public.training_methods (person_id, family, name);
create index if not exists person_training_methods_person_enabled_idx
  on public.person_training_methods (person_id, is_enabled);
create index if not exists person_training_methods_method_idx
  on public.person_training_methods (training_method_id);

alter table public.training_methods enable row level security;
alter table public.person_training_methods enable row level security;

grant select, insert, update, delete on
  public.training_methods,
  public.person_training_methods
to authenticated;

drop policy if exists training_methods_select_accessible on public.training_methods;
create policy training_methods_select_accessible
  on public.training_methods for select to authenticated
  using (person_id is null or app_private.person_is_accessible(person_id));

drop policy if exists training_methods_insert_accessible on public.training_methods;
create policy training_methods_insert_accessible
  on public.training_methods for insert to authenticated
  with check (
    person_id is not null
    and system_key is null
    and app_private.person_is_accessible(person_id)
  );

drop policy if exists training_methods_update_accessible on public.training_methods;
create policy training_methods_update_accessible
  on public.training_methods for update to authenticated
  using (person_id is not null and app_private.person_is_accessible(person_id))
  with check (
    person_id is not null
    and system_key is null
    and app_private.person_is_accessible(person_id)
  );

drop policy if exists training_methods_delete_accessible on public.training_methods;
create policy training_methods_delete_accessible
  on public.training_methods for delete to authenticated
  using (person_id is not null and app_private.person_is_accessible(person_id));

drop policy if exists person_training_methods_select_accessible on public.person_training_methods;
create policy person_training_methods_select_accessible
  on public.person_training_methods for select to authenticated
  using (app_private.person_is_accessible(person_id));

drop policy if exists person_training_methods_insert_accessible on public.person_training_methods;
create policy person_training_methods_insert_accessible
  on public.person_training_methods for insert to authenticated
  with check (
    app_private.person_is_accessible(person_id)
    and exists (
      select 1 from public.training_methods method
      where method.id = training_method_id
        and (method.person_id is null or method.person_id = person_id)
    )
  );

drop policy if exists person_training_methods_update_accessible on public.person_training_methods;
create policy person_training_methods_update_accessible
  on public.person_training_methods for update to authenticated
  using (app_private.person_is_accessible(person_id))
  with check (
    app_private.person_is_accessible(person_id)
    and exists (
      select 1 from public.training_methods method
      where method.id = training_method_id
        and (method.person_id is null or method.person_id = person_id)
    )
  );

drop policy if exists person_training_methods_delete_accessible on public.person_training_methods;
create policy person_training_methods_delete_accessible
  on public.person_training_methods for delete to authenticated
  using (app_private.person_is_accessible(person_id));

insert into public.training_methods (system_key, name, family, description, default_config)
values
  ('superset', 'Superset', 'exercise_group', 'Two exercises performed back-to-back before resting.', '{"movement_count":2,"rounds":3,"rest_between_movements_seconds":0,"rest_between_rounds_seconds":90}'::jsonb),
  ('tri_set', 'Tri-set', 'exercise_group', 'Three exercises performed in sequence before resting.', '{"movement_count":3,"rounds":3,"rest_between_movements_seconds":0,"rest_between_rounds_seconds":120}'::jsonb),
  ('giant_set', 'Giant set', 'exercise_group', 'Four or more exercises performed as one extended sequence.', '{"movement_count":4,"rounds":3,"rest_between_movements_seconds":0,"rest_between_rounds_seconds":150}'::jsonb),
  ('circuit', 'Circuit training', 'exercise_group', 'A sequence of exercises repeated for rounds with controlled rest.', '{"movement_count":5,"rounds":3,"rest_between_movements_seconds":15,"rest_between_rounds_seconds":120}'::jsonb),
  ('jump_sets', 'Jump sets', 'exercise_group', 'Alternating exercises for different muscle groups between sets.', '{"movement_count":2,"rounds":3,"rest_between_movements_seconds":30,"rest_between_rounds_seconds":60}'::jsonb),
  ('pha', 'Peripheral Heart Action', 'exercise_group', 'Alternates upper- and lower-body exercises to keep work moving around the body.', '{"movement_count":4,"rounds":3,"rest_between_movements_seconds":15,"rest_between_rounds_seconds":120}'::jsonb),
  ('complex_training', 'Complex training', 'exercise_group', 'Pairs a strength movement with a biomechanically similar explosive movement.', '{"movement_count":2,"rounds":3,"rest_between_movements_seconds":30,"rest_between_rounds_seconds":180}'::jsonb),
  ('drop_set', 'Drop / strip set', 'set_method', 'Continues a set through one or more load reductions.', '{"segments":3,"percentage_drop":15,"rest_between_segments_seconds":10}'::jsonb),
  ('cluster_set', 'Cluster set', 'set_method', 'Breaks a set into small rep clusters separated by short rests.', '{"segments":3,"reps_per_segment":2,"rest_between_segments_seconds":20}'::jsonb),
  ('rest_pause', 'Rest-pause set', 'set_method', 'Extends a set after a brief pause using the same load.', '{"segments":3,"rest_between_segments_seconds":20}'::jsonb),
  ('rep_targeting', 'Rep targeting', 'set_method', 'Accumulates a target number of reps across as many sets as needed.', '{"target_reps":25,"rest_between_segments_seconds":45}'::jsonb),
  ('partial_reps', 'Partial reps', 'set_method', 'Records deliberate partial-range work without treating it as full-range reps.', '{"range_of_motion":"partial"}'::jsonb),
  ('eccentrics', 'Eccentrics', 'set_method', 'Emphasises a deliberately slow, controlled lowering phase.', '{"segments":2,"eccentric_seconds":4,"rest_between_segments_seconds":60}'::jsonb),
  ('pyramid', 'Pyramid', 'set_method', 'Changes load and reps step by step through an ascending or descending sequence.', '{"segments":4,"direction":"ascending","rest_between_segments_seconds":90}'::jsonb),
  ('negatives', 'Negatives', 'set_method', 'Records eccentric-only repetitions using a controlled lowering phase.', '{"segments":3,"eccentric_seconds":5,"rest_between_segments_seconds":90}'::jsonb),
  ('edt', 'Escalating Density Training', 'timed_density', 'Accumulates more quality work inside a fixed training block.', '{"block_minutes":15,"movement_count":2}'::jsonb),
  ('tabata', 'Tabata', 'timed_density', 'Eight rounds of timed work and recovery intervals.', '{"rounds":8,"work_seconds":20,"rest_seconds":10}'::jsonb)
on conflict (system_key) do update
set
  name = excluded.name,
  family = excluded.family,
  description = excluded.description,
  default_config = excluded.default_config,
  is_active = true;
create table if not exists public.session_method_blocks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  training_method_id uuid not null references public.training_methods(id) on delete restrict,
  method_name text not null,
  family text not null check (family in ('exercise_group', 'set_method', 'timed_density')),
  order_index integer not null default 0,
  rounds integer,
  rest_between_movements_seconds integer,
  rest_between_rounds_seconds integer,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (session_id, order_index)
);

create table if not exists public.session_method_block_entries (
  block_id uuid not null references public.session_method_blocks(id) on delete cascade,
  session_entry_id uuid not null references public.session_entries(id) on delete cascade,
  sequence_index integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (block_id, session_entry_id),
  unique (block_id, sequence_index)
);

create table if not exists public.entry_set_segments (
  id uuid primary key default gen_random_uuid(),
  entry_set_id uuid not null references public.entry_sets(id) on delete cascade,
  training_method_id uuid not null references public.training_methods(id) on delete restrict,
  method_name text not null,
  segment_index integer not null default 0,
  reps numeric,
  weight numeric,
  rpe numeric,
  rest_after_seconds integer,
  range_of_motion text,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (entry_set_id, segment_index)
);

create index if not exists session_method_blocks_session_idx
  on public.session_method_blocks (session_id, order_index);
create index if not exists session_method_blocks_method_idx
  on public.session_method_blocks (training_method_id);
create index if not exists session_method_block_entries_entry_idx
  on public.session_method_block_entries (session_entry_id);
create index if not exists entry_set_segments_method_idx
  on public.entry_set_segments (training_method_id);

alter table public.session_method_blocks enable row level security;
alter table public.session_method_block_entries enable row level security;
alter table public.entry_set_segments enable row level security;

grant select, insert on
  public.session_method_blocks,
  public.session_method_block_entries,
  public.entry_set_segments
to authenticated;

drop policy if exists session_method_blocks_select_accessible on public.session_method_blocks;
create policy session_method_blocks_select_accessible
  on public.session_method_blocks for select to authenticated
  using (exists (
    select 1 from public.sessions session
    where session.id = session_id
      and app_private.person_is_accessible(session.person_id)
  ));

drop policy if exists session_method_blocks_insert_accessible on public.session_method_blocks;
create policy session_method_blocks_insert_accessible
  on public.session_method_blocks for insert to authenticated
  with check (
    exists (
      select 1 from public.sessions session
      where session.id = session_id
        and app_private.person_is_accessible(session.person_id)
    )
    and exists (
      select 1 from public.training_methods method
      where method.id = training_method_id
        and (
          method.person_id is null
          or method.person_id = (
            select session.person_id
            from public.sessions session
            where session.id = session_id
          )
        )
    )
  );

drop policy if exists session_method_block_entries_select_accessible on public.session_method_block_entries;
create policy session_method_block_entries_select_accessible
  on public.session_method_block_entries for select to authenticated
  using (exists (
    select 1
    from public.session_method_blocks block
    join public.sessions session on session.id = block.session_id
    join public.session_entries entry on entry.id = session_entry_id
    where block.id = block_id
      and entry.session_id = session.id
      and app_private.person_is_accessible(session.person_id)
  ));

drop policy if exists session_method_block_entries_insert_accessible on public.session_method_block_entries;
create policy session_method_block_entries_insert_accessible
  on public.session_method_block_entries for insert to authenticated
  with check (exists (
    select 1
    from public.session_method_blocks block
    join public.sessions session on session.id = block.session_id
    join public.session_entries entry on entry.id = session_entry_id
    where block.id = block_id
      and entry.session_id = session.id
      and app_private.person_is_accessible(session.person_id)
  ));

drop policy if exists entry_set_segments_select_accessible on public.entry_set_segments;
create policy entry_set_segments_select_accessible
  on public.entry_set_segments for select to authenticated
  using (exists (
    select 1
    from public.entry_sets set_row
    join public.session_entries entry on entry.id = set_row.session_entry_id
    join public.sessions session on session.id = entry.session_id
    where set_row.id = entry_set_id
      and app_private.person_is_accessible(session.person_id)
  ));

drop policy if exists entry_set_segments_insert_accessible on public.entry_set_segments;
create policy entry_set_segments_insert_accessible
  on public.entry_set_segments for insert to authenticated
  with check (
    exists (
      select 1
      from public.entry_sets set_row
      join public.session_entries entry on entry.id = set_row.session_entry_id
      join public.sessions session on session.id = entry.session_id
      where set_row.id = entry_set_id
        and app_private.person_is_accessible(session.person_id)
    )
    and exists (
      select 1
      from public.training_methods method
      join public.entry_sets set_row on set_row.id = entry_set_id
      join public.session_entries entry on entry.id = set_row.session_entry_id
      join public.sessions session on session.id = entry.session_id
      where method.id = training_method_id
        and method.family = 'set_method'
        and (method.person_id is null or method.person_id = session.person_id)
    )
  );

create table if not exists public.suggested_workout_method_blocks (
  id uuid primary key default gen_random_uuid(),
  suggested_workout_id uuid not null references public.suggested_workouts(id) on delete cascade,
  training_method_id uuid not null references public.training_methods(id) on delete restrict,
  method_name text not null,
  family text not null check (family in ('exercise_group', 'timed_density')),
  order_index integer not null default 0,
  rounds integer check (rounds is null or rounds > 0),
  rest_between_movements_seconds integer check (
    rest_between_movements_seconds is null or rest_between_movements_seconds >= 0
  ),
  rest_between_rounds_seconds integer check (
    rest_between_rounds_seconds is null or rest_between_rounds_seconds >= 0
  ),
  block_duration_seconds integer check (
    block_duration_seconds is null or block_duration_seconds > 0
  ),
  work_interval_seconds integer check (
    work_interval_seconds is null or work_interval_seconds >= 0
  ),
  rest_interval_seconds integer check (
    rest_interval_seconds is null or rest_interval_seconds >= 0
  ),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (suggested_workout_id, order_index)
);

create table if not exists public.suggested_workout_method_block_entries (
  block_id uuid not null references public.suggested_workout_method_blocks(id) on delete cascade,
  suggested_workout_entry_id uuid not null references public.suggested_workout_entries(id) on delete cascade,
  sequence_index integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (block_id, suggested_workout_entry_id),
  unique (block_id, sequence_index)
);

create index if not exists suggested_workout_method_blocks_workout_idx
  on public.suggested_workout_method_blocks (suggested_workout_id, order_index);
create index if not exists suggested_workout_method_blocks_method_idx
  on public.suggested_workout_method_blocks (training_method_id);
create index if not exists suggested_workout_method_block_entries_entry_idx
  on public.suggested_workout_method_block_entries (suggested_workout_entry_id);

alter table public.suggested_workout_method_blocks enable row level security;
alter table public.suggested_workout_method_block_entries enable row level security;

revoke all privileges on table public.suggested_workout_method_blocks from authenticated;
revoke all privileges on table public.suggested_workout_method_block_entries from authenticated;
grant select, insert on table public.suggested_workout_method_blocks to authenticated;
grant select, insert on table public.suggested_workout_method_block_entries to authenticated;

drop policy if exists suggested_workout_method_blocks_select_accessible
  on public.suggested_workout_method_blocks;
create policy suggested_workout_method_blocks_select_accessible
  on public.suggested_workout_method_blocks for select to authenticated
  using (exists (
    select 1 from public.suggested_workouts workout
    where workout.id = suggested_workout_id
      and app_private.person_is_accessible(workout.person_id)
  ));

drop policy if exists suggested_workout_method_blocks_insert_accessible
  on public.suggested_workout_method_blocks;
create policy suggested_workout_method_blocks_insert_accessible
  on public.suggested_workout_method_blocks for insert to authenticated
  with check (
    exists (
      select 1 from public.suggested_workouts workout
      where workout.id = suggested_workout_id
        and app_private.person_is_accessible(workout.person_id)
    )
    and exists (
      select 1
      from public.training_methods method
      join public.suggested_workouts workout on workout.id = suggested_workout_id
      where method.id = training_method_id
        and method.family = suggested_workout_method_blocks.family
        and (method.person_id is null or method.person_id = workout.person_id)
    )
  );

drop policy if exists suggested_workout_method_block_entries_select_accessible
  on public.suggested_workout_method_block_entries;
create policy suggested_workout_method_block_entries_select_accessible
  on public.suggested_workout_method_block_entries for select to authenticated
  using (exists (
    select 1
    from public.suggested_workout_method_blocks block
    join public.suggested_workouts workout on workout.id = block.suggested_workout_id
    join public.suggested_workout_entries entry on entry.id = suggested_workout_entry_id
    where block.id = block_id
      and entry.suggested_workout_id = workout.id
      and app_private.person_is_accessible(workout.person_id)
  ));

drop policy if exists suggested_workout_method_block_entries_insert_accessible
  on public.suggested_workout_method_block_entries;
create policy suggested_workout_method_block_entries_insert_accessible
  on public.suggested_workout_method_block_entries for insert to authenticated
  with check (exists (
    select 1
    from public.suggested_workout_method_blocks block
    join public.suggested_workouts workout on workout.id = block.suggested_workout_id
    join public.suggested_workout_entries entry on entry.id = suggested_workout_entry_id
    where block.id = block_id
      and entry.suggested_workout_id = workout.id
      and app_private.person_is_accessible(workout.person_id)
  ));

create table if not exists public.suggested_workout_set_segments (
  id uuid primary key default gen_random_uuid(),
  suggested_workout_set_id uuid not null references public.suggested_workout_sets(id) on delete cascade,
  training_method_id uuid not null references public.training_methods(id) on delete restrict,
  method_name text not null,
  segment_index integer not null default 0,
  reps numeric,
  weight numeric,
  rpe numeric,
  rest_after_seconds integer check (rest_after_seconds is null or rest_after_seconds >= 0),
  range_of_motion text,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (suggested_workout_set_id, segment_index)
);

create index if not exists suggested_workout_set_segments_method_idx
  on public.suggested_workout_set_segments (training_method_id);

alter table public.suggested_workout_set_segments enable row level security;

revoke all privileges on table public.suggested_workout_set_segments from authenticated;
grant select, insert on table public.suggested_workout_set_segments to authenticated;

drop policy if exists suggested_workout_set_segments_select_accessible
  on public.suggested_workout_set_segments;
create policy suggested_workout_set_segments_select_accessible
  on public.suggested_workout_set_segments for select to authenticated
  using (exists (
    select 1
    from public.suggested_workout_sets set_row
    join public.suggested_workout_entries entry
      on entry.id = set_row.suggested_workout_entry_id
    join public.suggested_workouts workout
      on workout.id = entry.suggested_workout_id
    where set_row.id = suggested_workout_set_id
      and app_private.person_is_accessible(workout.person_id)
  ));

drop policy if exists suggested_workout_set_segments_insert_accessible
  on public.suggested_workout_set_segments;
create policy suggested_workout_set_segments_insert_accessible
  on public.suggested_workout_set_segments for insert to authenticated
  with check (
    exists (
      select 1
      from public.suggested_workout_sets set_row
      join public.suggested_workout_entries entry
        on entry.id = set_row.suggested_workout_entry_id
      join public.suggested_workouts workout
        on workout.id = entry.suggested_workout_id
      where set_row.id = suggested_workout_set_id
        and app_private.person_is_accessible(workout.person_id)
    )
    and exists (
      select 1
      from public.training_methods method
      join public.suggested_workout_sets set_row
        on set_row.id = suggested_workout_set_id
      join public.suggested_workout_entries entry
        on entry.id = set_row.suggested_workout_entry_id
      join public.suggested_workouts workout
        on workout.id = entry.suggested_workout_id
      where method.id = training_method_id
        and method.family = 'set_method'
        and (method.person_id is null or method.person_id = workout.person_id)
    )
  );
-- One person has one current programme. Previous runs remain available for review.
create unique index if not exists program_assignments_one_active_per_person_uidx
  on public.program_assignments (person_id)
  where status = 'active';

create or replace function public.change_programme_run(
  p_assignment_id uuid,
  p_action text,
  p_started_on date default current_date
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source public.program_assignments%rowtype;
  next_id uuid;
begin
  if p_action is null or p_action not in ('restart', 'end') then
    raise exception 'Choose restart or end.';
  end if;

  select assignment.* into source
  from public.program_assignments assignment
  where assignment.id = p_assignment_id
  for update;

  if not found or source.status <> 'active' then
    raise exception 'The active programme could not be found.';
  end if;

  if p_action = 'restart' and p_started_on is null then
    raise exception 'Choose a start date for the new run.';
  end if;

  update public.suggested_workouts
  set status = 'archived'
  where program_assignment_id = source.id
    and status in ('pending', 'accepted');

  update public.program_assignments
  set status = 'archived'
  where id = source.id;

  if p_action = 'end' then
    return source.id;
  end if;

  insert into public.program_assignments (
    program_id, person_id, assigned_by_person_id, status,
    current_workout_index, started_on, cycle_number,
    previous_assignment_id, notes
  ) values (
    source.program_id, source.person_id, source.assigned_by_person_id, 'active',
    0, p_started_on, source.cycle_number + 1,
    source.id, source.notes
  ) returning id into next_id;

  insert into public.program_assignment_exercises (
    program_assignment_id, slot_key, exercise_id, exercise_name,
    training_max, is_enabled, load_adjustment_percent,
    manual_adjustment_percent, last_decision
  )
  select next_id, slot_key, exercise_id, exercise_name,
         training_max, is_enabled, 0, 0, null
  from public.program_assignment_exercises
  where program_assignment_id = source.id;

  insert into public.program_assignment_exercise_pools (
    program_assignment_id, role, exercise_id, exercise_name, is_enabled
  )
  select next_id, role, exercise_id, exercise_name, is_enabled
  from public.program_assignment_exercise_pools
  where program_assignment_id = source.id;

  return next_id;
end;
$$;

revoke all on function public.change_programme_run(uuid, text, date) from public;
revoke all on function public.change_programme_run(uuid, text, date) from anon;
grant execute on function public.change_programme_run(uuid, text, date) to authenticated;
-- Advance only when the person deliberately chooses a later programme session.
-- Skipped sessions remain visible in the run without inventing completed workouts.
create or replace function public.choose_next_programme_session(
  p_assignment_id uuid,
  p_target_workout_id uuid
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  run_row public.program_assignments%rowtype;
  target_row public.program_workouts%rowtype;
  skipped_row public.program_workouts%rowtype;
  target_index integer;
  skipped_count integer := 0;
begin
  select assignment.* into run_row
  from public.program_assignments assignment
  where assignment.id = p_assignment_id
  for update;

  if not found or run_row.status <> 'active' then
    raise exception 'The active programme could not be found.';
  end if;

  select workout.* into target_row
  from public.program_workouts workout
  where workout.id = p_target_workout_id
    and workout.program_id = run_row.program_id;

  if not found then
    raise exception 'Choose a session in this programme.';
  end if;

  select count(*)::integer into target_index
  from public.program_workouts workout
  where workout.program_id = run_row.program_id
    and (workout.sequence_index, workout.id) < (target_row.sequence_index, target_row.id);

  if target_index <= run_row.current_workout_index then
    raise exception 'Choose a later unfinished session.';
  end if;

  if exists (
    select 1
    from public.suggested_workouts planned
    join public.program_workouts workout on workout.id = planned.program_workout_id
    where planned.program_assignment_id = run_row.id
      and workout.sequence_index >= run_row.current_workout_index
      and workout.sequence_index < target_row.sequence_index
      and planned.status = 'accepted'
  ) then
    raise exception 'Finish or discard your started programme workout before skipping ahead.';
  end if;

  for skipped_row in
    select workout.*
    from public.program_workouts workout
    where workout.program_id = run_row.program_id
      and workout.sequence_index >= run_row.current_workout_index
      and workout.sequence_index < target_row.sequence_index
    order by workout.sequence_index
  loop
    if exists (
      select 1 from public.suggested_workouts planned
      where planned.program_assignment_id = run_row.id
        and planned.program_workout_id = skipped_row.id
        and planned.status = 'completed'
    ) then
      raise exception 'A completed session cannot be skipped.';
    end if;

    update public.suggested_workouts planned
    set status = 'skipped'
    where planned.program_assignment_id = run_row.id
      and planned.program_workout_id = skipped_row.id
      and planned.status = 'pending';

    if not found and not exists (
      select 1 from public.suggested_workouts planned
      where planned.program_assignment_id = run_row.id
        and planned.program_workout_id = skipped_row.id
        and planned.status = 'skipped'
    ) then
      insert into public.suggested_workouts (
        person_id, program_assignment_id, program_workout_id, status, title, notes
      ) values (
        run_row.person_id, run_row.id, skipped_row.id, 'skipped', skipped_row.name,
        'Skipped when choosing a later programme session.'
      );
    end if;
    skipped_count := skipped_count + 1;
  end loop;

  update public.program_assignments
  set current_workout_index = target_index
  where id = run_row.id;

  return skipped_count;
end;
$$;

revoke all on function public.choose_next_programme_session(uuid, uuid) from public;
revoke all on function public.choose_next_programme_session(uuid, uuid) from anon;
grant execute on function public.choose_next_programme_session(uuid, uuid) to authenticated;
create table public.mobility_practice_runs (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  skill text not null check (skill in ('pike', 'bridge')),
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  phase text not null default 'setup' check (phase in ('setup', 'phase_1', 'phase_2', 'phase_3')),
  started_on date not null default current_date,
  ended_on date,
  review_on date,
  readiness text not null default 'unchecked'
    check (readiness in ('unchecked', 'ready', 'shoulders_first')),
  readiness_checked_on date,
  readiness_left_deg numeric check (readiness_left_deg between 0 and 360),
  readiness_right_deg numeric check (readiness_right_deg between 0 and 360),
  plan_received boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, person_id),
  check (skill = 'bridge' or readiness = 'unchecked'),
  check (status <> 'archived' or ended_on is not null)
);

create unique index mobility_practice_one_current_per_skill_idx
  on public.mobility_practice_runs (person_id, skill)
  where status in ('active', 'paused');

create trigger mobility_practice_runs_set_updated_at
before update on public.mobility_practice_runs
for each row execute function public.set_updated_at();

alter table public.suggested_workouts
  add column mobility_practice_run_id uuid
  references public.mobility_practice_runs(id) on delete set null;

alter table public.suggested_workouts
  add column goal_id uuid references public.goals(id) on delete set null;

create index suggested_workouts_mobility_run_idx
  on public.suggested_workouts (mobility_practice_run_id)
  where mobility_practice_run_id is not null;

create index suggested_workouts_goal_idx
  on public.suggested_workouts (goal_id)
  where goal_id is not null;

create function app_private.guard_scheduled_mobility_plan()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.mobility_practice_run_id is null then
    if new.plan_kind = 'mobility' then
      raise exception 'Choose an active mobility practice.';
    end if;
    return new;
  end if;

  if new.plan_kind is distinct from 'mobility' then
    raise exception 'Only mobility plans can use a mobility practice.';
  end if;

  if not exists (
    select 1
    from public.mobility_practice_runs run
    where run.id = new.mobility_practice_run_id
      and run.person_id = new.person_id
      and run.status = 'active'
      and app_private.person_is_accessible(run.person_id)
  ) then
    raise exception 'Choose an active mobility practice.';
  end if;

  return new;
end;
$$;

create trigger guard_scheduled_mobility_plan
before insert or update of person_id, plan_kind, mobility_practice_run_id
on public.suggested_workouts
for each row execute function app_private.guard_scheduled_mobility_plan();

revoke all on function app_private.guard_scheduled_mobility_plan() from public, anon;
grant execute on function app_private.guard_scheduled_mobility_plan() to authenticated;

create function app_private.guard_programme_support_plan()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.goal_id is not null then
    if new.plan_kind is distinct from 'skill' then
      raise exception 'Only skill plans can use a supporting goal.';
    end if;
    if new.mobility_practice_run_id is not null then
      raise exception 'Choose either a goal or a mobility practice.';
    end if;
    if new.program_assignment_id is null or new.program_workout_id is not null then
      raise exception 'A supporting goal must belong to a programme without replacing a strength session.';
    end if;
    if not exists (
      select 1 from public.goals goal
      where goal.id = new.goal_id
        and goal.person_id = new.person_id
        and goal.status = 'active'
        and goal.exercise_id is not null
        and app_private.person_is_accessible(goal.person_id)
    ) then
      raise exception 'Choose an accessible active exercise goal.';
    end if;
  end if;

  if new.program_assignment_id is not null and new.program_workout_id is null then
    if new.goal_id is null and new.mobility_practice_run_id is null then
      raise exception 'A programme support plan needs a goal or mobility practice.';
    end if;
    if not exists (
      select 1 from public.program_assignments assignment
      where assignment.id = new.program_assignment_id
        and assignment.person_id = new.person_id
        and assignment.status in ('active', 'paused')
        and app_private.person_is_accessible(assignment.person_id)
    ) then
      raise exception 'Choose an accessible current programme.';
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_programme_support_plan
before insert or update of person_id, program_assignment_id, program_workout_id,
  plan_kind, goal_id, mobility_practice_run_id
on public.suggested_workouts
for each row execute function app_private.guard_programme_support_plan();

revoke all on function app_private.guard_programme_support_plan() from public, anon;
grant execute on function app_private.guard_programme_support_plan() to authenticated;

create table public.mobility_assessment_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.mobility_practice_runs(id) on delete restrict,
  test_key text not null,
  side text not null default 'none' check (side in ('none', 'left', 'right')),
  measured_on date not null,
  value_numeric numeric,
  value_text text,
  unit text not null check (unit in ('deg', 'cm', 'text')),
  setup_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (unit = 'text' and value_numeric is null and nullif(btrim(value_text), '') is not null)
    or (unit <> 'text' and value_numeric is not null and value_text is null)
  ),
  check (unit <> 'deg' or value_numeric between 0 and 360)
);

create index mobility_assessments_run_test_date_idx
  on public.mobility_assessment_results (run_id, test_key, side, measured_on desc);

create trigger mobility_assessment_results_set_updated_at
before update on public.mobility_assessment_results
for each row execute function public.set_updated_at();

create table public.mobility_practice_drills (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.mobility_practice_runs(id) on delete restrict,
  exercise_id uuid references public.exercises(id) on delete set null,
  name text not null,
  lesson_url text check (
    lesson_url is null or
    lesson_url ~ '^https://www[.]matthewismith[.]com/products/mobility-flexibility-toolkit/[^?#]*$'
  ),
  sort_order integer not null default 0,
  target_sets integer check (target_sets is null or target_sets between 1 and 20),
  target_reps text,
  target_weight_kg numeric check (target_weight_kg is null or target_weight_kg >= 0),
  target_hold_seconds numeric check (target_hold_seconds is null or target_hold_seconds > 0),
  target_detail text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index mobility_drills_run_order_idx
  on public.mobility_practice_drills (run_id, sort_order, created_at);
create index mobility_drills_exercise_idx
  on public.mobility_practice_drills (exercise_id)
  where exercise_id is not null;

create trigger mobility_practice_drills_set_updated_at
before update on public.mobility_practice_drills
for each row execute function public.set_updated_at();

alter table public.sessions
  add column mobility_practice_run_id uuid;

alter table public.sessions
  add constraint sessions_mobility_practice_owner_fkey
  foreign key (mobility_practice_run_id, person_id)
  references public.mobility_practice_runs (id, person_id)
  on delete restrict;

create index sessions_mobility_practice_run_idx
  on public.sessions (mobility_practice_run_id, session_date desc)
  where mobility_practice_run_id is not null;

alter table public.mobility_practice_runs enable row level security;
alter table public.mobility_assessment_results enable row level security;
alter table public.mobility_practice_drills enable row level security;

create policy mobility_practice_runs_accessible
  on public.mobility_practice_runs
  for all to authenticated
  using (app_private.person_is_accessible(person_id))
  with check (app_private.person_is_accessible(person_id));

create policy mobility_assessments_accessible
  on public.mobility_assessment_results
  for all to authenticated
  using (exists (
    select 1 from public.mobility_practice_runs run
    where run.id = run_id and app_private.person_is_accessible(run.person_id)
  ))
  with check (exists (
    select 1 from public.mobility_practice_runs run
    where run.id = run_id and app_private.person_is_accessible(run.person_id)
  ));

create policy mobility_drills_accessible
  on public.mobility_practice_drills
  for all to authenticated
  using (exists (
    select 1 from public.mobility_practice_runs run
    where run.id = run_id and app_private.person_is_accessible(run.person_id)
  ))
  with check (exists (
    select 1 from public.mobility_practice_runs run
    where run.id = run_id and app_private.person_is_accessible(run.person_id)
  ));

grant select, insert, update on public.mobility_practice_runs to authenticated;
grant select, insert, update, delete on public.mobility_assessment_results to authenticated;
grant select, insert, update, delete on public.mobility_practice_drills to authenticated;
grant update (mobility_practice_run_id) on public.sessions to authenticated;

create function public.save_mobility_workout(
  p_person_id uuid,
  p_session jsonb,
  p_entries jsonb,
  p_method_blocks jsonb,
  p_mobility_run_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_session_id uuid;
begin
  if not exists (
    select 1 from public.mobility_practice_runs run
    where run.id = p_mobility_run_id and run.person_id = p_person_id
  ) then
    raise exception 'The mobility practice was not found for this training profile.'
      using errcode = '22023';
  end if;

  saved_session_id := public.save_workout(
    p_person_id, p_session, p_entries, p_method_blocks
  );

  update public.sessions
  set mobility_practice_run_id = p_mobility_run_id
  where id = saved_session_id and person_id = p_person_id;

  if not found then
    raise exception 'The mobility workout could not be linked.';
  end if;
  return saved_session_id;
end;
$$;

revoke all on function public.save_mobility_workout(uuid, jsonb, jsonb, jsonb, uuid) from public;
revoke all on function public.save_mobility_workout(uuid, jsonb, jsonb, jsonb, uuid) from anon;
grant execute on function public.save_mobility_workout(uuid, jsonb, jsonb, jsonb, uuid)
  to authenticated;


-- 2026-10-04: Editable personal programmes (applied to Training Admin on 2026-10-04).
-- Personal prescriptions belong to one run. Source templates and completed sessions remain intact.
create table public.personal_programmes (
  assignment_id uuid primary key references public.program_assignments(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 200),
  created_at timestamptz not null default now()
);
create table public.personal_programme_sessions (
  assignment_id uuid not null references public.personal_programmes(assignment_id) on delete cascade,
  program_workout_id uuid not null references public.program_workouts(id),
  name text not null check (length(btrim(name)) between 1 and 200),
  scheduled_on date not null,
  plan jsonb not null,
  revision integer not null default 1,
  primary key (assignment_id, program_workout_id)
);
create index personal_programme_sessions_workout_idx on public.personal_programme_sessions(program_workout_id);
alter table public.personal_programmes enable row level security;
alter table public.personal_programme_sessions enable row level security;
revoke all on public.personal_programmes, public.personal_programme_sessions from anon, authenticated;
grant select, insert on public.personal_programmes to authenticated;
grant select, insert, update on public.personal_programme_sessions to authenticated;
create policy personal_programmes_read on public.personal_programmes for select to authenticated
using (exists (select 1 from public.program_assignments a where a.id = assignment_id and app_private.person_is_accessible(a.person_id)));
create policy personal_programmes_insert on public.personal_programmes for insert to authenticated
with check (exists (select 1 from public.program_assignments a where a.id = assignment_id and a.status = 'paused' and app_private.person_is_accessible(a.person_id)));
create policy personal_sessions_read on public.personal_programme_sessions for select to authenticated
using (exists (select 1 from public.program_assignments a where a.id = assignment_id and app_private.person_is_accessible(a.person_id)));
create policy personal_sessions_insert on public.personal_programme_sessions for insert to authenticated
with check (exists (select 1 from public.program_assignments a where a.id = assignment_id and app_private.person_is_accessible(a.person_id)));
create policy personal_sessions_update on public.personal_programme_sessions for update to authenticated
using (exists (select 1 from public.program_assignments a where a.id = assignment_id and app_private.person_is_accessible(a.person_id)))
with check (exists (select 1 from public.program_assignments a where a.id = assignment_id and app_private.person_is_accessible(a.person_id)));

create function app_private.validate_personal_programme_plan(p_plan jsonb, p_require_targets boolean default false) returns void
language plpgsql security invoker set search_path = '' as $$
declare m jsonb; s jsonb; rule jsonb; field text; target_value text;
begin
  if p_plan is null or p_plan->'version' is distinct from '1'::jsonb or coalesce(p_plan->>'locationKind','') not in ('home','gym')
    or jsonb_typeof(p_plan->'movements') is distinct from 'array' then
    raise exception 'Choose a location and at least one exercise.';
  end if;
  if jsonb_array_length(p_plan->'movements') not between 1 and 30 then raise exception 'Use 1 to 30 exercises.'; end if;
  if (select count(distinct value->>'programmeKey') from jsonb_array_elements(p_plan->'movements')) <> jsonb_array_length(p_plan->'movements') then
    raise exception 'Exercise identities must be unique.';
  end if;
  for m in select value from jsonb_array_elements(p_plan->'movements') loop
    if jsonb_typeof(m->'programmeKey') is distinct from 'string' or jsonb_typeof(m->'exercise') is distinct from 'string'
      or (m ? 'restTime' and jsonb_typeof(m->'restTime') is distinct from 'string')
      or coalesce(length(m->>'programmeKey'),0) not between 1 and 128 or coalesce(length(btrim(m->>'exercise')),0) not between 1 and 200
      or coalesce(length(m->>'reason'),0) > 4000 or coalesce(length(m->>'restTime'),0) > 100
      or m->>'trackingMode' is null or m->>'trackingMode' not in ('weight_reps','reps_only','hold','grip_hold') then
      raise exception 'Use a supported strength exercise and concise guidance.';
    end if;
    if not exists (select 1 from public.exercises e where e.id = (m->>'exerciseId')::uuid) then raise exception 'Choose an exercise from the Library.'; end if;
    if jsonb_typeof(m->'workoutType') is distinct from 'string'
      or lower(m->>'workoutType') <> 'strength' or jsonb_typeof(m->'sourceDate') is distinct from 'string'
      or jsonb_typeof(m->'reason') is distinct from 'string' or jsonb_typeof(m->'targets') is distinct from 'object' then
      raise exception 'Check the exercise description and targets.';
    end if;
    foreach field in array array['durationMinutes','distance','distanceUnit','rounds','height','detail'] loop
      if jsonb_typeof(m->'targets'->field) is distinct from 'string' then raise exception 'Check the exercise targets.'; end if;
    end loop;
    rule := m->'progression';
    foreach field in array array['minReps','maxReps','incrementKg','maxRpe'] loop
      if jsonb_typeof(rule->field) is distinct from 'number' then raise exception 'Check the progression numbers.'; end if;
    end loop;
    if (rule->>'minReps')::numeric <> trunc((rule->>'minReps')::numeric)
      or (rule->>'maxReps')::numeric <> trunc((rule->>'maxReps')::numeric) then raise exception 'Use whole rep targets.'; end if;
    if rule->>'type' is null or rule->>'type' not in ('fixed','double','source')
      or coalesce((rule->>'minReps')::numeric,0) not between 1 and 100
      or coalesce((rule->>'maxReps')::numeric,0) not between (rule->>'minReps')::numeric and 100
      or coalesce((rule->>'incrementKg')::numeric,0) <= 0 or (rule->>'incrementKg')::numeric > 100
      or coalesce((rule->>'maxRpe')::numeric,0) not between 1 and 10
      or (rule->>'type' = 'double' and m->>'trackingMode' <> 'weight_reps') then
      raise exception 'Check the progression range, increment and effort limit.';
    end if;
    if jsonb_typeof(m->'setRows') is distinct from 'array' then raise exception 'Add at least one set.'; end if;
    if jsonb_array_length(m->'setRows') not between 1 and 20 then raise exception 'Use 1 to 20 sets per exercise.'; end if;
    for s in select value from jsonb_array_elements(m->'setRows') loop
      if jsonb_typeof(s->'completed') is distinct from 'boolean' then raise exception 'Check the set targets.'; end if;
      foreach field in array array['reps','weight','durationSeconds','rpe'] loop
        target_value := s->>field;
        if jsonb_typeof(s->field) is distinct from 'string' or (target_value <> '' and (target_value !~ '^\d+(\.\d+)?$' or target_value::numeric > case when field='rpe' then 10 when field='durationSeconds' then 86400 else 1000 end)) then
          raise exception 'Check the set targets.';
        end if;
      end loop;
      if p_require_targets and rule->>'type'<>'source' and (
        m->>'trackingMode' in ('weight_reps','reps_only') and coalesce(nullif(s->>'reps','')::numeric,0)<=0
        or m->>'trackingMode' in ('hold','grip_hold') and coalesce(nullif(s->>'durationSeconds','')::numeric,0)<=0
        or m->>'trackingMode' in ('weight_reps','grip_hold') and nullif(s->>'weight','') is null) then
        raise exception 'Fill in future set targets for %, or choose source programme rules.',m->>'exercise';
      end if;
    end loop;
  end loop;
end; $$;
revoke all on function app_private.validate_personal_programme_plan(jsonb,boolean) from public, anon;
grant execute on function app_private.validate_personal_programme_plan(jsonb,boolean) to authenticated;

-- The same guard applies to direct table writes and RPCs. Lock the run to serialize edits,
-- starts, skips and completions; never allow an edit to rewrite a started prescription.
create function app_private.guard_personal_programme_session() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare a public.program_assignments%rowtype; w public.program_workouts%rowtype;
begin
  if tg_op = 'UPDATE' and (new.assignment_id <> old.assignment_id or new.program_workout_id <> old.program_workout_id) then
    raise exception 'A session cannot be moved to a different run.';
  end if;
  select * into a from public.program_assignments where id = new.assignment_id for update;
  select * into w from public.program_workouts where id = new.program_workout_id and program_id = a.program_id;
  if a.id is null or w.id is null or a.status not in ('active','paused') or w.sequence_index < a.current_workout_index then
    raise exception 'Only future sessions in a current or paused programme can be edited.';
  end if;
  if exists (select 1 from public.suggested_workouts p where p.program_assignment_id = a.id and p.program_workout_id = w.id and p.status in ('accepted','completed','skipped')) then
    raise exception 'This session has already started, completed or been skipped.';
  end if;
  perform app_private.validate_personal_programme_plan(new.plan,a.status='active');
  new.revision := case when tg_op = 'INSERT' then 1 else old.revision + 1 end;
  return new;
end; $$;
create trigger guard_personal_programme_session before insert or update on public.personal_programme_sessions
for each row execute function app_private.guard_personal_programme_session();
revoke all on function app_private.guard_personal_programme_session() from public, anon;
grant execute on function app_private.guard_personal_programme_session() to authenticated;

create function public.create_personal_programme(p_person_id uuid, p_program_id uuid, p_name text, p_started_on date, p_sessions jsonb, p_notes text default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare a_id uuid; item jsonb; expected integer;
begin
  if auth.uid() is null or not app_private.person_is_accessible(p_person_id) then raise exception 'The training profile is not accessible.'; end if;
  if p_started_on is null then raise exception 'Choose a start date.'; end if;
  select count(*) into expected from public.program_workouts w join public.programs p on p.id=w.program_id where p.id=p_program_id and p.is_template;
  if expected = 0 or jsonb_typeof(p_sessions) is distinct from 'array' then raise exception 'Choose a starting programme.'; end if;
  if jsonb_array_length(p_sessions) <> expected or (select count(distinct value->>'workoutId') from jsonb_array_elements(p_sessions)) <> expected then
    raise exception 'Include every session in the starting programme.';
  end if;
  insert into public.program_assignments(program_id,person_id,assigned_by_person_id,status,started_on,notes)
  values(p_program_id,p_person_id,p_person_id,'paused',p_started_on,p_notes) returning id into a_id;
  insert into public.personal_programmes(assignment_id,name) values(a_id,btrim(p_name));
  for item in select value from jsonb_array_elements(p_sessions) loop
    insert into public.personal_programme_sessions(assignment_id,program_workout_id,name,scheduled_on,plan)
    values(a_id,(item->>'workoutId')::uuid,item->>'name',(item->>'scheduledDate')::date,item->'plan');
  end loop;
  return a_id;
end; $$;
revoke all on function public.create_personal_programme(uuid,uuid,text,date,jsonb,text) from public, anon;
grant execute on function public.create_personal_programme(uuid,uuid,text,date,jsonb,text) to authenticated;

create function public.save_personal_programme_sessions(p_assignment_id uuid, p_updates jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare a public.program_assignments%rowtype; item jsonb; changed integer := 0;
begin
  select * into a from public.program_assignments where id=p_assignment_id for update;
  if auth.uid() is null or a.id is null or a.status not in ('active','paused') then raise exception 'This programme cannot be edited.'; end if;
  if jsonb_typeof(p_updates) is distinct from 'array' then raise exception 'Choose sessions to update.'; end if;
  if jsonb_array_length(p_updates) not between 1 and 100 then raise exception 'Choose 1 to 100 sessions to update.'; end if;
  if (select count(distinct value->>'workoutId') from jsonb_array_elements(p_updates)) <> jsonb_array_length(p_updates) then raise exception 'A session can only be updated once.'; end if;
  for item in select value from jsonb_array_elements(p_updates) loop
    update public.personal_programme_sessions set name=item->>'name', scheduled_on=(item->>'scheduledDate')::date, plan=item->'plan'
    where assignment_id=p_assignment_id and program_workout_id=(item->>'workoutId')::uuid and revision=(item->>'revision')::integer;
    if not found then raise exception 'This programme changed elsewhere. Refresh before saving.'; end if;
    changed := changed+1;
  end loop;
  return changed;
end; $$;
revoke all on function public.save_personal_programme_sessions(uuid,jsonb) from public, anon;
grant execute on function public.save_personal_programme_sessions(uuid,jsonb) to authenticated;

create function public.start_personal_programme_session(p_assignment_id uuid, p_workout_id uuid, p_revision integer, p_location_id uuid, p_easier boolean default false)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare a public.program_assignments%rowtype; prescribed public.personal_programme_sessions%rowtype;
  current_id uuid; plan_id uuid; entry_id uuid; m jsonb; s jsonb; movement_index integer := 0; set_index integer; row_count integer; load numeric;
begin
  select * into a from public.program_assignments where id=p_assignment_id for update;
  if auth.uid() is null or a.id is null or a.status <> 'active' then raise exception 'Start or resume this programme first.'; end if;
  select id into current_id from public.program_workouts where program_id=a.program_id order by sequence_index,id offset a.current_workout_index limit 1;
  if current_id is distinct from p_workout_id then raise exception 'This is no longer the next programme session.'; end if;
  select * into prescribed from public.personal_programme_sessions where assignment_id=a.id and program_workout_id=current_id;
  if prescribed.program_workout_id is null or prescribed.revision is distinct from p_revision then raise exception 'The session changed. Refresh Today before starting.'; end if;
  perform app_private.validate_personal_programme_plan(prescribed.plan,true);
  if exists (select 1 from public.suggested_workouts where program_assignment_id=a.id and program_workout_id=current_id and status in ('pending','accepted','completed','skipped')) then raise exception 'This programme session has already been started.'; end if;
  if not exists (select 1 from public.training_locations where id=p_location_id and kind in ('home','gym') and is_active and person_id=a.person_id and app_private.person_is_accessible(person_id)) then raise exception 'Choose an available training location.'; end if;
  insert into public.suggested_workouts(person_id,program_assignment_id,program_workout_id,training_location_id,status,title,basis,suggested_for)
  select a.person_id,a.id,current_id,p_location_id,'accepted',p.name || ' · ' || prescribed.name,
    case when p_easier then 'Personal programme · easier return: one fewer set where possible and about 10% lighter.' else 'Targets from your personal programme. Progression follows each exercise’s saved rule.' end,current_date
  from public.personal_programmes p where p.assignment_id=a.id returning id into plan_id;
  for m in select value from jsonb_array_elements(prescribed.plan->'movements') loop
    insert into public.suggested_workout_entries(suggested_workout_id,exercise_id,name,workout_type,order_index,reason,tracking_mode,target_metrics)
    values(plan_id,(m->>'exerciseId')::uuid,m->>'exercise',m->>'workoutType',movement_index,m->>'reason',m->>'trackingMode',
      jsonb_build_object('rest_time',coalesce(m->>'restTime',''),'progression',m->'progression')) returning id into entry_id;
    movement_index := movement_index+1;
    set_index := 0;
    row_count := jsonb_array_length(m->'setRows');
    for s in select value from jsonb_array_elements(m->'setRows') loop
      set_index := set_index+1;
      if p_easier and row_count>1 and set_index=row_count then continue; end if;
      load := nullif(s->>'weight','')::numeric;
      if p_easier then load := round(load*0.9,2); end if;
      insert into public.suggested_workout_sets(suggested_workout_entry_id,set_number,reps,weight,duration_seconds,rpe,completed)
      values(entry_id,set_index,nullif(s->>'reps','')::numeric,load,nullif(s->>'durationSeconds','')::numeric,nullif(s->>'rpe','')::numeric,true);
    end loop;
  end loop;
  return plan_id;
end; $$;
revoke all on function public.start_personal_programme_session(uuid,uuid,integer,uuid,boolean) from public, anon;
grant execute on function public.start_personal_programme_session(uuid,uuid,integer,uuid,boolean) to authenticated;

create or replace function public.change_programme_run(
  p_assignment_id uuid,
  p_action text,
  p_started_on date default current_date
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source public.program_assignments%rowtype;
  next_id uuid;
begin
  if p_action is null or p_action not in ('restart', 'end') then
    raise exception 'Choose restart or end.';
  end if;

  select assignment.* into source
  from public.program_assignments assignment
  where assignment.id = p_assignment_id
  for update;

  if not found or source.status not in ('active','paused','complete') or (p_action = 'end' and source.status = 'complete') then
    raise exception 'The active programme could not be found.';
  end if;

  if p_action = 'restart' and p_started_on is null then
    raise exception 'Choose a start date for the new run.';
  end if;

  update public.suggested_workouts
  set status = 'archived'
  where program_assignment_id = source.id
    and status in ('pending', 'accepted');

  update public.program_assignments
  set status = 'archived'
  where id = source.id;

  if p_action = 'end' then
    return source.id;
  end if;

  insert into public.program_assignments (
    program_id, person_id, assigned_by_person_id, status,
    current_workout_index, started_on, cycle_number,
    previous_assignment_id, notes
  ) values (
    source.program_id, source.person_id, source.assigned_by_person_id,
    case when exists(select 1 from public.personal_programmes where assignment_id=source.id) then 'paused' else 'active' end,
    0, p_started_on, source.cycle_number + 1,
    source.id, source.notes
  ) returning id into next_id;

  insert into public.program_assignment_exercises (
    program_assignment_id, slot_key, exercise_id, exercise_name,
    training_max, is_enabled, load_adjustment_percent,
    manual_adjustment_percent, last_decision
  )
  select next_id, slot_key, exercise_id, exercise_name,
         training_max, is_enabled, 0, 0, null
  from public.program_assignment_exercises
  where program_assignment_id = source.id;

  insert into public.program_assignment_exercise_pools (
    program_assignment_id, role, exercise_id, exercise_name, is_enabled
  )
  select next_id, role, exercise_id, exercise_name, is_enabled
  from public.program_assignment_exercise_pools
  where program_assignment_id = source.id;

  if exists (select 1 from public.personal_programmes where assignment_id=source.id) then
    insert into public.personal_programmes(assignment_id,name) select next_id,name from public.personal_programmes where assignment_id=source.id;
    insert into public.personal_programme_sessions(assignment_id,program_workout_id,name,scheduled_on,plan)
    select next_id,program_workout_id,name,scheduled_on + (p_started_on-source.started_on),plan
    from public.personal_programme_sessions where assignment_id=source.id;
    update public.program_assignments set status='active' where id=next_id;
  end if;
  return next_id;
end;
$$;

revoke all on function public.change_programme_run(uuid, text, date) from public;
revoke all on function public.change_programme_run(uuid, text, date) from anon;
grant execute on function public.change_programme_run(uuid, text, date) to authenticated;

-- Activation validates deliberate targets. Source-driven exercises may remain open-ended;
-- fixed and rep-range exercises must have a usable prescription before arriving at training.
create function app_private.guard_personal_programme_activation() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare session_row record;
begin
  if new.status='active' and old.status<>'active' and exists(select 1 from public.personal_programmes where assignment_id=new.id) then
    if (select count(*) from public.personal_programme_sessions p join public.program_workouts w on w.id=p.program_workout_id
        where p.assignment_id=new.id and w.sequence_index>=new.current_workout_index)
      <> (select count(*) from public.program_workouts w where w.program_id=new.program_id and w.sequence_index>=new.current_workout_index) then
      raise exception 'Include every future session before starting your personal programme.';
    end if;
    for session_row in select plan from public.personal_programme_sessions p join public.program_workouts w on w.id=p.program_workout_id where p.assignment_id=new.id and w.sequence_index>=new.current_workout_index loop
      perform app_private.validate_personal_programme_plan(session_row.plan,true);
    end loop;
  end if;
  return new;
end; $$;
create trigger guard_personal_programme_activation before update on public.program_assignments
for each row execute function app_private.guard_personal_programme_activation();
revoke all on function app_private.guard_personal_programme_activation() from public,anon;
grant execute on function app_private.guard_personal_programme_activation() to authenticated;
create table public.coaching_preferences (
  person_id uuid primary key references public.people(id) on delete cascade,
  primary_focus_id text not null default 'programme' check (btrim(primary_focus_id) <> ''),
  secondary_focus_ids text[] not null default '{}',
  maintenance_focus_ids text[] not null default '{}',
  weekly_training_days smallint not null default 4 check (weekly_training_days between 1 and 7),
  weekly_minutes integer not null default 300 check (weekly_minutes between 30 and 1680),
  max_demanding_days smallint not null default 3 check (
    max_demanding_days between 1 and 7 and max_demanding_days <= weekly_training_days
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(secondary_focus_ids) <= 2),
  check (not (primary_focus_id = any(secondary_focus_ids))),
  check (not (primary_focus_id = any(maintenance_focus_ids))),
  check (not (secondary_focus_ids && maintenance_focus_ids))
);

create trigger coaching_preferences_set_updated_at
before update on public.coaching_preferences
for each row execute function public.set_updated_at();

alter table public.coaching_preferences enable row level security;

create policy coaching_preferences_accessible
  on public.coaching_preferences
  for all to authenticated
  using (app_private.person_is_accessible(person_id))
  with check (app_private.person_is_accessible(person_id));

grant select, insert, update on public.coaching_preferences to authenticated;
create table public.coaching_recommendation_decisions (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  week_start date not null,
  recommendation_key text not null check (
    btrim(recommendation_key) <> '' and char_length(recommendation_key) <= 200
  ),
  recommendation_type text not null check (recommendation_type in ('move_session')),
  suggested_workout_id uuid not null references public.suggested_workouts(id) on delete restrict,
  original_date date not null,
  proposed_date date not null,
  chosen_date date,
  decision text not null check (decision in ('accepted', 'rejected')),
  rationale text not null check (btrim(rationale) <> ''),
  decided_at timestamptz not null default now(),
  unique (person_id, week_start, recommendation_key),
  check (original_date between week_start and week_start + 6),
  check (proposed_date between week_start and week_start + 6),
  check (chosen_date is null or chosen_date between week_start and week_start + 6),
  check (
    (decision = 'accepted' and chosen_date is not null)
    or (decision = 'rejected' and chosen_date is null)
  )
);

create index coaching_recommendation_decisions_person_week_idx
  on public.coaching_recommendation_decisions (person_id, week_start, decided_at desc);

alter table public.coaching_recommendation_decisions enable row level security;

create policy coaching_recommendation_decisions_accessible
  on public.coaching_recommendation_decisions
  for all to authenticated
  using (app_private.person_is_accessible(person_id))
  with check (app_private.person_is_accessible(person_id));

grant select, insert, update on public.coaching_recommendation_decisions to authenticated;

create function public.decide_coaching_recommendation(
  p_recommendation_key text,
  p_suggested_workout_id uuid,
  p_week_start date,
  p_original_date date,
  p_proposed_date date,
  p_chosen_date date,
  p_decision text,
  p_rationale text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_person_id uuid;
  v_current_date date;
  v_decision_id uuid;
begin
  if p_decision not in ('accepted', 'rejected') then
    raise exception 'Choose accept or reject.' using errcode = '22023';
  end if;
  if p_recommendation_key is null or btrim(p_recommendation_key) = '' then
    raise exception 'The coaching recommendation is missing.' using errcode = '22023';
  end if;
  if p_original_date not between p_week_start and p_week_start + 6
    or p_proposed_date not between p_week_start and p_week_start + 6
    or (p_chosen_date is not null and p_chosen_date not between p_week_start and p_week_start + 6)
  then
    raise exception 'Choose a date inside this training week.' using errcode = '22023';
  end if;
  if (p_decision = 'accepted' and p_chosen_date is null)
    or (p_decision = 'rejected' and p_chosen_date is not null)
  then
    raise exception 'The coaching decision is incomplete.' using errcode = '22023';
  end if;

  select workout.person_id, workout.suggested_for
    into v_person_id, v_current_date
  from public.suggested_workouts workout
  where workout.id = p_suggested_workout_id
    and workout.program_workout_id is null
    and workout.status in ('pending', 'accepted')
    and app_private.person_is_accessible(workout.person_id)
  for update;

  if not found or v_current_date is distinct from p_original_date then
    raise exception 'This recommendation is out of date. Refresh the week and review it again.';
  end if;

  if p_decision = 'accepted' then
    update public.suggested_workouts
    set suggested_for = p_chosen_date
    where id = p_suggested_workout_id and person_id = v_person_id;
  end if;

  insert into public.coaching_recommendation_decisions (
    person_id, week_start, recommendation_key, recommendation_type,
    suggested_workout_id, original_date, proposed_date, chosen_date,
    decision, rationale
  ) values (
    v_person_id, p_week_start, p_recommendation_key, 'move_session',
    p_suggested_workout_id, p_original_date, p_proposed_date, p_chosen_date,
    p_decision, p_rationale
  )
  on conflict (person_id, week_start, recommendation_key) do update
  set proposed_date = excluded.proposed_date,
      chosen_date = excluded.chosen_date,
      decision = excluded.decision,
      rationale = excluded.rationale,
      decided_at = now()
  returning id into v_decision_id;

  return v_decision_id;
end;
$$;

revoke all on function public.decide_coaching_recommendation(
  text, uuid, date, date, date, date, text, text
) from public;
revoke all on function public.decide_coaching_recommendation(
  text, uuid, date, date, date, date, text, text
) from anon;
grant execute on function public.decide_coaching_recommendation(
  text, uuid, date, date, date, date, text, text
) to authenticated;
alter table public.coaching_recommendation_decisions
  add column subject_focus_id text;

update public.coaching_recommendation_decisions decision
set subject_focus_id = case
  when workout.goal_id is not null then 'goal:' || workout.goal_id::text
  when workout.mobility_practice_run_id is not null then
    'mobility:' || workout.mobility_practice_run_id::text
  else 'kind:' || coalesce(workout.plan_kind, 'other')
end
from public.suggested_workouts workout
where workout.id = decision.suggested_workout_id;

alter table public.coaching_recommendation_decisions
  alter column subject_focus_id set not null,
  add constraint coaching_recommendation_decisions_subject_focus_check
    check (btrim(subject_focus_id) <> ''),
  drop constraint coaching_recommendation_decisions_recommendation_type_check,
  add constraint coaching_recommendation_decisions_recommendation_type_check
    check (recommendation_type in ('move_session', 'skip_support_session')),
  drop constraint coaching_recommendation_decisions_check3,
  add constraint coaching_recommendation_decisions_decision_shape_check
    check (
      (
        recommendation_type = 'move_session'
        and (
          (decision = 'accepted' and chosen_date is not null)
          or (decision = 'rejected' and chosen_date is null)
        )
      )
      or (
        recommendation_type = 'skip_support_session'
        and chosen_date is null
      )
    );

create index coaching_recommendation_decisions_learning_idx
  on public.coaching_recommendation_decisions (
    person_id, recommendation_type, subject_focus_id, week_start desc
  );

create function public.decide_coaching_recommendation_v2(
  p_recommendation_type text,
  p_recommendation_key text,
  p_suggested_workout_id uuid,
  p_week_start date,
  p_original_date date,
  p_proposed_date date,
  p_chosen_date date,
  p_decision text,
  p_rationale text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_person_id uuid;
  v_current_date date;
  v_current_status text;
  v_program_assignment_id uuid;
  v_program_workout_id uuid;
  v_goal_id uuid;
  v_mobility_run_id uuid;
  v_plan_kind text;
  v_subject_focus_id text;
  v_decision_id uuid;
begin
  if p_recommendation_type not in ('move_session', 'skip_support_session') then
    raise exception 'Choose a supported coaching recommendation.' using errcode = '22023';
  end if;
  if p_decision not in ('accepted', 'rejected') then
    raise exception 'Choose accept or reject.' using errcode = '22023';
  end if;
  if p_recommendation_key is null or btrim(p_recommendation_key) = '' then
    raise exception 'The coaching recommendation is missing.' using errcode = '22023';
  end if;
  if p_original_date not between p_week_start and p_week_start + 6
    or p_proposed_date not between p_week_start and p_week_start + 6
    or (p_chosen_date is not null and p_chosen_date not between p_week_start and p_week_start + 6)
  then
    raise exception 'Choose a date inside this training week.' using errcode = '22023';
  end if;
  if (
      p_recommendation_type = 'move_session'
      and (
        (p_decision = 'accepted' and p_chosen_date is null)
        or (p_decision = 'rejected' and p_chosen_date is not null)
      )
    )
    or (
      p_recommendation_type = 'skip_support_session'
      and p_chosen_date is not null
    )
  then
    raise exception 'The coaching decision is incomplete.' using errcode = '22023';
  end if;

  select
    workout.person_id,
    workout.suggested_for,
    workout.status,
    workout.program_assignment_id,
    workout.program_workout_id,
    workout.goal_id,
    workout.mobility_practice_run_id,
    workout.plan_kind
  into
    v_person_id,
    v_current_date,
    v_current_status,
    v_program_assignment_id,
    v_program_workout_id,
    v_goal_id,
    v_mobility_run_id,
    v_plan_kind
  from public.suggested_workouts workout
  where workout.id = p_suggested_workout_id
    and workout.program_workout_id is null
    and workout.status in ('pending', 'accepted')
    and app_private.person_is_accessible(workout.person_id)
  for update;

  if not found or v_current_date is distinct from p_original_date then
    raise exception 'This recommendation is out of date. Refresh the week and review it again.';
  end if;

  v_subject_focus_id := case
    when v_goal_id is not null then 'goal:' || v_goal_id::text
    when v_mobility_run_id is not null then 'mobility:' || v_mobility_run_id::text
    else 'kind:' || coalesce(v_plan_kind, 'other')
  end;

  if p_recommendation_type = 'skip_support_session' then
    if v_program_assignment_id is null
      or v_program_workout_id is not null
      or (v_goal_id is null and v_mobility_run_id is null)
    then
      raise exception 'Only programme-linked support work can be reduced.';
    end if;
    if not exists (
      select 1
      from public.coaching_preferences preference
      where preference.person_id = v_person_id
        and v_subject_focus_id = any(preference.maintenance_focus_ids)
        and app_private.person_is_accessible(preference.person_id)
    ) then
      raise exception 'Only a saved maintenance priority can be reduced.';
    end if;
  end if;

  if p_decision = 'accepted' and p_recommendation_type = 'move_session' then
    update public.suggested_workouts
    set suggested_for = p_chosen_date
    where id = p_suggested_workout_id and person_id = v_person_id;
  elsif p_decision = 'accepted' and p_recommendation_type = 'skip_support_session' then
    update public.suggested_workouts
    set status = 'skipped'
    where id = p_suggested_workout_id
      and person_id = v_person_id
      and status = v_current_status;
  end if;

  insert into public.coaching_recommendation_decisions (
    person_id, week_start, recommendation_key, recommendation_type,
    suggested_workout_id, subject_focus_id, original_date, proposed_date, chosen_date,
    decision, rationale
  ) values (
    v_person_id, p_week_start, p_recommendation_key, p_recommendation_type,
    p_suggested_workout_id, v_subject_focus_id, p_original_date, p_proposed_date, p_chosen_date,
    p_decision, p_rationale
  )
  on conflict (person_id, week_start, recommendation_key) do update
  set recommendation_type = excluded.recommendation_type,
      suggested_workout_id = excluded.suggested_workout_id,
      subject_focus_id = excluded.subject_focus_id,
      original_date = excluded.original_date,
      proposed_date = excluded.proposed_date,
      chosen_date = excluded.chosen_date,
      decision = excluded.decision,
      rationale = excluded.rationale,
      decided_at = now()
  returning id into v_decision_id;

  return v_decision_id;
end;
$$;

revoke all on function public.decide_coaching_recommendation_v2(
  text, text, uuid, date, date, date, date, text, text
) from public;
revoke all on function public.decide_coaching_recommendation_v2(
  text, text, uuid, date, date, date, date, text, text
) from anon;
grant execute on function public.decide_coaching_recommendation_v2(
  text, text, uuid, date, date, date, date, text, text
) to authenticated;

create or replace function public.decide_coaching_recommendation(
  p_recommendation_key text,
  p_suggested_workout_id uuid,
  p_week_start date,
  p_original_date date,
  p_proposed_date date,
  p_chosen_date date,
  p_decision text,
  p_rationale text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select public.decide_coaching_recommendation_v2(
    'move_session',
    p_recommendation_key,
    p_suggested_workout_id,
    p_week_start,
    p_original_date,
    p_proposed_date,
    p_chosen_date,
    p_decision,
    p_rationale
  );
$$;

revoke all on function public.decide_coaching_recommendation(
  text, uuid, date, date, date, date, text, text
) from public;
revoke all on function public.decide_coaching_recommendation(
  text, uuid, date, date, date, date, text, text
) from anon;
grant execute on function public.decide_coaching_recommendation(
  text, uuid, date, date, date, date, text, text
) to authenticated;
alter table public.coaching_recommendation_decisions
  add column action_details jsonb not null default '{}'::jsonb,
  add constraint coaching_recommendation_decisions_action_details_check
    check (jsonb_typeof(action_details) = 'object'),
  drop constraint coaching_recommendation_decisions_recommendation_type_check,
  add constraint coaching_recommendation_decisions_recommendation_type_check
    check (
      recommendation_type in (
        'move_session', 'skip_support_session', 'adjust_support_dose'
      )
    ),
  drop constraint coaching_recommendation_decisions_decision_shape_check,
  add constraint coaching_recommendation_decisions_decision_shape_check
    check (
      (
        recommendation_type = 'move_session'
        and (
          (decision = 'accepted' and chosen_date is not null)
          or (decision = 'rejected' and chosen_date is null)
        )
      )
      or (
        recommendation_type in ('skip_support_session', 'adjust_support_dose')
        and chosen_date is null
      )
    );

create function public.decide_coaching_recommendation_v3(
  p_recommendation_type text,
  p_recommendation_key text,
  p_suggested_workout_id uuid,
  p_week_start date,
  p_original_date date,
  p_proposed_date date,
  p_chosen_date date,
  p_decision text,
  p_rationale text,
  p_action_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_person_id uuid;
  v_current_date date;
  v_current_status text;
  v_program_assignment_id uuid;
  v_program_workout_id uuid;
  v_goal_id uuid;
  v_mobility_run_id uuid;
  v_plan_kind text;
  v_subject_focus_id text;
  v_decision_id uuid;
  v_entry_count integer;
  v_entry_id uuid;
  v_tracking_mode text;
  v_current_sets integer;
  v_current_value numeric;
  v_max_value numeric;
  v_adjustment text;
  v_from_sets integer;
  v_from_value numeric;
  v_target_sets integer;
  v_target_value numeric;
  v_dose_unit text;
  v_increment numeric;
begin
  if p_recommendation_type not in (
    'move_session', 'skip_support_session', 'adjust_support_dose'
  ) then
    raise exception 'Choose a supported coaching recommendation.' using errcode = '22023';
  end if;
  if p_decision not in ('accepted', 'rejected') then
    raise exception 'Choose accept or reject.' using errcode = '22023';
  end if;
  if p_recommendation_key is null or btrim(p_recommendation_key) = '' then
    raise exception 'The coaching recommendation is missing.' using errcode = '22023';
  end if;
  if p_action_details is null or jsonb_typeof(p_action_details) <> 'object' then
    raise exception 'The coaching action is invalid.' using errcode = '22023';
  end if;
  if p_original_date not between p_week_start and p_week_start + 6
    or p_proposed_date not between p_week_start and p_week_start + 6
    or (p_chosen_date is not null and p_chosen_date not between p_week_start and p_week_start + 6)
  then
    raise exception 'Choose a date inside this training week.' using errcode = '22023';
  end if;
  if (
      p_recommendation_type = 'move_session'
      and (
        (p_decision = 'accepted' and p_chosen_date is null)
        or (p_decision = 'rejected' and p_chosen_date is not null)
      )
    )
    or (
      p_recommendation_type in ('skip_support_session', 'adjust_support_dose')
      and p_chosen_date is not null
    )
  then
    raise exception 'The coaching decision is incomplete.' using errcode = '22023';
  end if;

  select
    workout.person_id,
    workout.suggested_for,
    workout.status,
    workout.program_assignment_id,
    workout.program_workout_id,
    workout.goal_id,
    workout.mobility_practice_run_id,
    workout.plan_kind
  into
    v_person_id,
    v_current_date,
    v_current_status,
    v_program_assignment_id,
    v_program_workout_id,
    v_goal_id,
    v_mobility_run_id,
    v_plan_kind
  from public.suggested_workouts workout
  where workout.id = p_suggested_workout_id
    and workout.program_workout_id is null
    and workout.status in ('pending', 'accepted')
    and app_private.person_is_accessible(workout.person_id)
  for update;

  if not found or v_current_date is distinct from p_original_date then
    raise exception 'This recommendation is out of date. Refresh the week and review it again.';
  end if;

  v_subject_focus_id := case
    when v_goal_id is not null then 'goal:' || v_goal_id::text
    when v_mobility_run_id is not null then 'mobility:' || v_mobility_run_id::text
    else 'kind:' || coalesce(v_plan_kind, 'other')
  end;

  if p_recommendation_type = 'skip_support_session' then
    if v_program_assignment_id is null
      or v_program_workout_id is not null
      or (v_goal_id is null and v_mobility_run_id is null)
    then
      raise exception 'Only programme-linked support work can be reduced.';
    end if;
    if not exists (
      select 1
      from public.coaching_preferences preference
      where preference.person_id = v_person_id
        and v_subject_focus_id = any(preference.maintenance_focus_ids)
        and app_private.person_is_accessible(preference.person_id)
    ) then
      raise exception 'Only a saved maintenance priority can be reduced.';
    end if;
  elsif p_recommendation_type = 'adjust_support_dose' then
    if v_program_assignment_id is null
      or v_program_workout_id is not null
      or v_goal_id is null
      or v_plan_kind is distinct from 'skill'
    then
      raise exception 'Only programme-linked skill support can use a coaching dose change.';
    end if;

    select count(*)::integer
    into v_entry_count
    from public.suggested_workout_entries entry
    where entry.suggested_workout_id = p_suggested_workout_id;

    if v_entry_count <> 1 then
      raise exception 'A coaching dose change needs one support movement.';
    end if;

    select entry.id, entry.tracking_mode
    into v_entry_id, v_tracking_mode
    from public.suggested_workout_entries entry
    where entry.suggested_workout_id = p_suggested_workout_id
    limit 1;

    if v_tracking_mode not in ('reps_only', 'hold', 'grip_hold') then
      raise exception 'This support dose cannot be adjusted automatically.';
    end if;

    perform 1
    from public.suggested_workout_sets set_row
    where set_row.suggested_workout_entry_id = v_entry_id
    for update;

    select
      count(*)::integer,
      min(
        case
          when v_tracking_mode in ('hold', 'grip_hold') then set_row.duration_seconds
          else set_row.reps
        end
      ),
      max(
        case
          when v_tracking_mode in ('hold', 'grip_hold') then set_row.duration_seconds
          else set_row.reps
        end
      )
    into v_current_sets, v_current_value, v_max_value
    from public.suggested_workout_sets set_row
    where set_row.suggested_workout_entry_id = v_entry_id;

    if v_current_sets < 1
      or v_current_value is null
      or v_current_value <> v_max_value
      or exists (
        select 1
        from public.suggested_workout_sets set_row
        join public.suggested_workout_set_segments segment
          on segment.suggested_workout_set_id = set_row.id
        where set_row.suggested_workout_entry_id = v_entry_id
      )
    then
      raise exception 'This support dose is not a simple uniform prescription.';
    end if;

    begin
      v_adjustment := p_action_details ->> 'adjustment';
      v_from_sets := (p_action_details ->> 'from_sets')::integer;
      v_from_value := (p_action_details ->> 'from_value')::numeric;
      v_target_sets := (p_action_details ->> 'target_sets')::integer;
      v_target_value := (p_action_details ->> 'target_value')::numeric;
      v_dose_unit := p_action_details ->> 'dose_unit';
    exception when others then
      raise exception 'The coaching dose details are invalid.' using errcode = '22023';
    end;

    if v_adjustment not in ('progress', 'reduce')
      or v_from_sets is distinct from v_current_sets
      or v_from_value is distinct from v_current_value
      or v_target_sets not between 1 and 6
      or v_target_value < 1
      or v_dose_unit is distinct from (
        case when v_tracking_mode in ('hold', 'grip_hold') then 'seconds' else 'reps' end
      )
    then
      raise exception 'This coaching dose is out of date or outside its safe bounds.';
    end if;

    v_increment := case when v_dose_unit = 'seconds' then 2 else 1 end;
    if v_adjustment = 'progress' and (
      v_target_sets <> v_current_sets
      or v_target_value <> v_current_value + v_increment
    ) then
      raise exception 'Progression is limited to one small dose step.';
    elsif v_adjustment = 'reduce' and (
      (
        v_current_sets > 1
        and (v_target_sets <> v_current_sets - 1 or v_target_value <> v_current_value)
      )
      or (
        v_current_sets = 1
        and (
          v_target_sets <> 1
          or v_target_value <> greatest(1, v_current_value - v_increment)
          or v_target_value >= v_current_value
        )
      )
    ) then
      raise exception 'Reduction is limited to one small dose step.';
    end if;
  end if;

  if p_decision = 'accepted' and p_recommendation_type = 'move_session' then
    update public.suggested_workouts
    set suggested_for = p_chosen_date
    where id = p_suggested_workout_id and person_id = v_person_id;
  elsif p_decision = 'accepted' and p_recommendation_type = 'skip_support_session' then
    update public.suggested_workouts
    set status = 'skipped'
    where id = p_suggested_workout_id
      and person_id = v_person_id
      and status = v_current_status;
  elsif p_decision = 'accepted' and p_recommendation_type = 'adjust_support_dose' then
    delete from public.suggested_workout_sets
    where suggested_workout_entry_id = v_entry_id
      and set_number > v_target_sets;

    update public.suggested_workout_sets
    set reps = case when v_dose_unit = 'reps' then v_target_value else reps end,
        duration_seconds = case
          when v_dose_unit = 'seconds' then v_target_value
          else duration_seconds
        end
    where suggested_workout_entry_id = v_entry_id;
  end if;

  insert into public.coaching_recommendation_decisions (
    person_id, week_start, recommendation_key, recommendation_type,
    suggested_workout_id, subject_focus_id, original_date, proposed_date, chosen_date,
    decision, rationale, action_details
  ) values (
    v_person_id, p_week_start, p_recommendation_key, p_recommendation_type,
    p_suggested_workout_id, v_subject_focus_id, p_original_date, p_proposed_date, p_chosen_date,
    p_decision, p_rationale, p_action_details
  )
  on conflict (person_id, week_start, recommendation_key) do update
  set recommendation_type = excluded.recommendation_type,
      suggested_workout_id = excluded.suggested_workout_id,
      subject_focus_id = excluded.subject_focus_id,
      original_date = excluded.original_date,
      proposed_date = excluded.proposed_date,
      chosen_date = excluded.chosen_date,
      decision = excluded.decision,
      rationale = excluded.rationale,
      action_details = excluded.action_details,
      decided_at = now()
  returning id into v_decision_id;

  return v_decision_id;
end;
$$;

revoke all on function public.decide_coaching_recommendation_v3(
  text, text, uuid, date, date, date, date, text, text, jsonb
) from public;
revoke all on function public.decide_coaching_recommendation_v3(
  text, text, uuid, date, date, date, date, text, text, jsonb
) from anon;
grant execute on function public.decide_coaching_recommendation_v3(
  text, text, uuid, date, date, date, date, text, text, jsonb
) to authenticated;

create or replace function public.decide_coaching_recommendation_v2(
  p_recommendation_type text,
  p_recommendation_key text,
  p_suggested_workout_id uuid,
  p_week_start date,
  p_original_date date,
  p_proposed_date date,
  p_chosen_date date,
  p_decision text,
  p_rationale text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select public.decide_coaching_recommendation_v3(
    p_recommendation_type,
    p_recommendation_key,
    p_suggested_workout_id,
    p_week_start,
    p_original_date,
    p_proposed_date,
    p_chosen_date,
    p_decision,
    p_rationale,
    '{}'::jsonb
  );
$$;

revoke all on function public.decide_coaching_recommendation_v2(
  text, text, uuid, date, date, date, date, text, text
) from public;
revoke all on function public.decide_coaching_recommendation_v2(
  text, text, uuid, date, date, date, date, text, text
) from anon;
grant execute on function public.decide_coaching_recommendation_v2(
  text, text, uuid, date, date, date, date, text, text
) to authenticated;
