-- Production-shaped workout tables in a disposable socket-only PostgreSQL cluster.
create role anon;
create role authenticated;
create schema auth;
create schema app_private;
grant usage on schema public,auth,app_private to authenticated;
create function auth.uid() returns uuid language sql stable as $$
select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create function app_private.person_is_accessible(person_id uuid) returns boolean language sql stable as $$
select person_id = auth.uid()
$$;
create function app_private.current_person_is_admin() returns boolean language sql stable as $$select false$$;
create function public.set_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now(); return new; end$$;
create table public.people(id uuid primary key);
create table public.activity_types(id uuid primary key default gen_random_uuid(),name text,slug text unique,sort_order integer);
create table public.exercises(id uuid primary key,activity_type_id uuid references public.activity_types,is_active boolean default true);
create table public.training_locations(id uuid primary key,person_id uuid references public.people);
create table public.mobility_practice_runs(id uuid primary key,person_id uuid references public.people);
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

create table if not exists public.entry_metrics (
  id uuid primary key default gen_random_uuid(),
  session_entry_id uuid not null references public.session_entries(id) on delete cascade,
  metric_key text not null,
  metric_value numeric,
  metric_text text,
  metric_unit text,
  created_at timestamptz not null default now()
);

alter table public.sessions add column mobility_practice_run_id uuid references public.mobility_practice_runs;
create table public.suggested_workouts(id uuid primary key,person_id uuid references public.people,
 status text,completed_session_id uuid references public.sessions on delete set null);
create table public.program_workout_reviews(id uuid primary key,session_id uuid references public.sessions on delete set null);
alter table public.sessions enable row level security;
create policy sessions_select_managed on public.sessions for select to authenticated using(app_private.person_is_accessible(person_id));
create policy sessions_insert_managed on public.sessions for insert to authenticated with check(app_private.person_is_accessible(person_id));
create policy sessions_update_managed on public.sessions for update to authenticated using(app_private.person_is_accessible(person_id)) with check(app_private.person_is_accessible(person_id));
create policy sessions_delete_managed on public.sessions for delete to authenticated using(app_private.person_is_accessible(person_id));
alter table public.session_entries enable row level security;
create policy entries_select on public.session_entries for select to authenticated using(exists(select 1 from public.sessions s where s.id=session_id));
create policy entries_insert on public.session_entries for insert to authenticated with check(exists(select 1 from public.sessions s where s.id=session_id));
alter table public.entry_sets enable row level security;
create policy sets_select on public.entry_sets for select to authenticated using(exists(select 1 from public.session_entries e where e.id=session_entry_id));
create policy sets_insert on public.entry_sets for insert to authenticated with check(exists(select 1 from public.session_entries e where e.id=session_entry_id));
alter table public.entry_metrics enable row level security;
create policy metrics_select on public.entry_metrics for select to authenticated using(exists(select 1 from public.session_entries e where e.id=session_entry_id));
create policy metrics_insert on public.entry_metrics for insert to authenticated with check(exists(select 1 from public.session_entries e where e.id=session_entry_id));
grant select on public.people,public.activity_types,public.exercises,public.training_locations,public.mobility_practice_runs to authenticated;
grant select,insert,update,delete on public.sessions to authenticated;
grant select,insert on public.session_entries,public.entry_sets,public.entry_metrics to authenticated;
