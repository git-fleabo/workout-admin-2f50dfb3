-- Additional production columns needed by Base Strength's isolated regression test.
alter table public.programs add column name text, add column description text,
 add column duration_weeks integer, add column sessions_per_week integer,
 add column percent_base text, add column rounding_increment numeric;
alter table public.program_workouts add column week_number integer, add column day_number integer, add column session_number integer;
create table public.session_entries(id uuid primary key default gen_random_uuid(),session_id uuid references public.sessions,
 exercise_id uuid references public.exercises,order_index integer,completed boolean default true);
create table public.entry_sets(id uuid primary key default gen_random_uuid(),session_entry_id uuid references public.session_entries,
 set_number integer,reps numeric,weight numeric,completed boolean default true,data_shape text default 'individual',
 aggregate_set_count integer,load_semantics text default 'total_external_load');
create table public.entry_set_segments(id uuid primary key default gen_random_uuid(),entry_set_id uuid references public.entry_sets);
alter table public.session_entries enable row level security;
create policy actual_entries_access on public.session_entries to authenticated
 using(exists(select 1 from public.sessions s where s.id=session_id)) with check(exists(select 1 from public.sessions s where s.id=session_id));
alter table public.entry_sets enable row level security;
create policy actual_sets_access on public.entry_sets to authenticated
 using(exists(select 1 from public.session_entries e where e.id=session_entry_id)) with check(exists(select 1 from public.session_entries e where e.id=session_entry_id));
alter table public.entry_set_segments enable row level security;
create policy actual_segments_access on public.entry_set_segments to authenticated
 using(exists(select 1 from public.entry_sets s where s.id=entry_set_id)) with check(exists(select 1 from public.entry_sets s where s.id=entry_set_id));
grant select,insert,update,delete on public.session_entries,public.entry_sets,public.entry_set_segments to authenticated;
