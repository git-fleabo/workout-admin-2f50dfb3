-- Dependencies for real coach migrations, only inside the disposable cluster.
create function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
alter table public.programs add column method_type text default 'adaptive_strength_12_week';
alter table public.program_workouts add column name text default 'Session';
alter table public.suggested_workouts add column notes text;
alter table public.program_assignment_exercises
 add column id uuid primary key default gen_random_uuid(),
 add column manual_adjusted_at timestamptz,
 add column updated_at timestamptz default now();
create table public.suggested_workout_set_segments(
 id uuid primary key default gen_random_uuid(),
 suggested_workout_set_id uuid references public.suggested_workout_sets(id)
);
alter table public.suggested_workout_set_segments enable row level security;
create policy segments_access on public.suggested_workout_set_segments to authenticated
 using(exists(select 1 from public.suggested_workout_sets s where s.id=suggested_workout_set_id));
grant select on public.suggested_workout_set_segments to authenticated;
grant delete on public.suggested_workout_sets to authenticated;
alter table public.program_assignment_exercises enable row level security;
create policy exercise_mappings_access on public.program_assignment_exercises to authenticated
 using(exists(select 1 from public.program_assignments a where a.id=program_assignment_id))
 with check(exists(select 1 from public.program_assignments a where a.id=program_assignment_id));
