-- Minimal isolated schema for the real programme RPCs and RLS tests.
-- This fixture is used only in a temporary local PostgreSQL cluster.
create role anon;
create role authenticated;
create schema auth;
create schema app_private;
grant usage on schema public, auth, app_private to authenticated;
create function auth.uid() returns uuid language sql stable as $$
select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create function app_private.person_is_accessible(person_id uuid) returns boolean language sql stable as $$
select person_id = auth.uid()
$$;
create table public.people(id uuid primary key);
create table public.exercises(id uuid primary key);
create table public.programs(id uuid primary key,is_template boolean not null);
create table public.program_workouts(id uuid primary key,program_id uuid references public.programs,sequence_index integer);
create table public.program_assignments(
 id uuid primary key default gen_random_uuid(),program_id uuid references public.programs,
 person_id uuid not null,assigned_by_person_id uuid,status text not null,
 current_workout_index integer not null default 0,started_on date,completed_on date,
 cycle_number integer not null default 1,previous_assignment_id uuid references public.program_assignments,notes text
);
create unique index active_run on public.program_assignments(person_id) where status='active';
create table public.program_assignment_exercises(
 program_assignment_id uuid references public.program_assignments,slot_key text,exercise_id uuid,
 exercise_name text,training_max numeric,is_enabled boolean,load_adjustment_percent numeric,
 manual_adjustment_percent numeric,last_decision text
);
create table public.program_assignment_exercise_pools(
 program_assignment_id uuid references public.program_assignments,role text,exercise_id uuid,exercise_name text,is_enabled boolean
);
create table public.training_locations(id uuid primary key,person_id uuid,kind text,is_active boolean);
create table public.sessions(id uuid primary key,person_id uuid,completed boolean);
create table public.goals(
 id uuid primary key default gen_random_uuid(),person_id uuid not null references public.people,
 status text not null,exercise_id uuid references public.exercises
);
create table public.mobility_practice_runs(
 id uuid primary key default gen_random_uuid(),person_id uuid not null references public.people,
 status text not null check(status in ('active','paused','archived'))
);
create table public.suggested_workouts(
 id uuid primary key default gen_random_uuid(),person_id uuid,program_assignment_id uuid references public.program_assignments,
 program_workout_id uuid references public.program_workouts,training_location_id uuid references public.training_locations,
 status text,title text,basis text,suggested_for date,completed_session_id uuid references public.sessions,
 created_at timestamptz default now()
);
create table public.suggested_workout_entries(
 id uuid primary key default gen_random_uuid(),suggested_workout_id uuid references public.suggested_workouts,
 exercise_id uuid references public.exercises,name text,workout_type text,order_index integer,reason text,tracking_mode text,target_metrics jsonb
);
create table public.suggested_workout_sets(
 id uuid primary key default gen_random_uuid(),suggested_workout_entry_id uuid references public.suggested_workout_entries,
 set_number integer,reps numeric,weight numeric,duration_seconds numeric,rpe numeric,completed boolean
);
grant select on public.people,public.exercises,public.programs,public.program_workouts to authenticated;
grant select,insert,update on public.program_assignments,public.program_assignment_exercises,
 public.program_assignment_exercise_pools,public.suggested_workouts,public.suggested_workout_entries,
 public.suggested_workout_sets,public.training_locations,public.sessions,public.goals,
 public.mobility_practice_runs to authenticated;
alter table public.people enable row level security;
create policy people_access on public.people to authenticated using(app_private.person_is_accessible(id));
alter table public.mobility_practice_runs enable row level security;
create policy mobility_runs_access on public.mobility_practice_runs to authenticated
 using(app_private.person_is_accessible(person_id)) with check(app_private.person_is_accessible(person_id));
alter table public.goals enable row level security;
create policy goals_access on public.goals to authenticated
 using(app_private.person_is_accessible(person_id)) with check(app_private.person_is_accessible(person_id));
alter table public.program_assignments enable row level security;
create policy assignments_access on public.program_assignments to authenticated using(app_private.person_is_accessible(person_id)) with check(app_private.person_is_accessible(person_id));
alter table public.training_locations enable row level security;
create policy locations_access on public.training_locations to authenticated using(app_private.person_is_accessible(person_id));
alter table public.sessions enable row level security;
create policy sessions_access on public.sessions to authenticated using(app_private.person_is_accessible(person_id));
alter table public.suggested_workouts enable row level security;
create policy suggestions_access on public.suggested_workouts to authenticated using(app_private.person_is_accessible(person_id)) with check(app_private.person_is_accessible(person_id));
alter table public.suggested_workout_entries enable row level security;
create policy entries_access on public.suggested_workout_entries to authenticated
 using(exists(select 1 from public.suggested_workouts w where w.id=suggested_workout_id))
 with check(exists(select 1 from public.suggested_workouts w where w.id=suggested_workout_id));
alter table public.suggested_workout_sets enable row level security;
create policy sets_access on public.suggested_workout_sets to authenticated
 using(exists(select 1 from public.suggested_workout_entries e where e.id=suggested_workout_entry_id))
 with check(exists(select 1 from public.suggested_workout_entries e where e.id=suggested_workout_entry_id));
