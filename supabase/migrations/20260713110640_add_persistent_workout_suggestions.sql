alter table public.suggested_workouts
  add column if not exists training_location_id uuid references public.training_locations(id) on delete set null,
  add column if not exists readiness text check (readiness in ('normal', 'fresh', 'tired')),
  add column if not exists basis text,
  add column if not exists completed_session_id uuid references public.sessions(id) on delete set null;

create table if not exists public.suggested_workout_entries (
  id uuid primary key default gen_random_uuid(),
  suggested_workout_id uuid not null references public.suggested_workouts(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null,
  name text not null,
  workout_type text,
  order_index integer not null default 0,
  source_date date,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (suggested_workout_id, order_index)
);

create table if not exists public.suggested_workout_sets (
  id uuid primary key default gen_random_uuid(),
  suggested_workout_entry_id uuid not null references public.suggested_workout_entries(id) on delete cascade,
  set_number integer not null,
  reps numeric,
  weight numeric,
  rpe numeric,
  completed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (suggested_workout_entry_id, set_number)
);

drop trigger if exists suggested_workout_entries_set_updated_at on public.suggested_workout_entries;
create trigger suggested_workout_entries_set_updated_at
before update on public.suggested_workout_entries
for each row execute function public.set_updated_at();

drop trigger if exists suggested_workout_sets_set_updated_at on public.suggested_workout_sets;
create trigger suggested_workout_sets_set_updated_at
before update on public.suggested_workout_sets
for each row execute function public.set_updated_at();

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

alter table public.suggested_workout_entries enable row level security;
alter table public.suggested_workout_sets enable row level security;

grant select, insert, update, delete on
  public.suggested_workouts,
  public.suggested_workout_entries,
  public.suggested_workout_sets
to authenticated;

drop policy if exists suggested_workouts_select_accessible on public.suggested_workouts;
create policy suggested_workouts_select_accessible
  on public.suggested_workouts for select to authenticated
  using (app_private.person_is_accessible(person_id));

drop policy if exists suggested_workouts_insert_accessible on public.suggested_workouts;
create policy suggested_workouts_insert_accessible
  on public.suggested_workouts for insert to authenticated
  with check (app_private.person_is_accessible(person_id));

drop policy if exists suggested_workouts_update_accessible on public.suggested_workouts;
create policy suggested_workouts_update_accessible
  on public.suggested_workouts for update to authenticated
  using (app_private.person_is_accessible(person_id))
  with check (app_private.person_is_accessible(person_id));

drop policy if exists suggested_workouts_delete_accessible on public.suggested_workouts;
create policy suggested_workouts_delete_accessible
  on public.suggested_workouts for delete to authenticated
  using (app_private.person_is_accessible(person_id));

drop policy if exists suggested_workout_entries_select_accessible on public.suggested_workout_entries;
create policy suggested_workout_entries_select_accessible
  on public.suggested_workout_entries for select to authenticated
  using (exists (
    select 1 from public.suggested_workouts workout
    where workout.id = suggested_workout_id
      and app_private.person_is_accessible(workout.person_id)
  ));

drop policy if exists suggested_workout_entries_insert_accessible on public.suggested_workout_entries;
create policy suggested_workout_entries_insert_accessible
  on public.suggested_workout_entries for insert to authenticated
  with check (exists (
    select 1 from public.suggested_workouts workout
    where workout.id = suggested_workout_id
      and app_private.person_is_accessible(workout.person_id)
  ));

drop policy if exists suggested_workout_entries_update_accessible on public.suggested_workout_entries;
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

drop policy if exists suggested_workout_entries_delete_accessible on public.suggested_workout_entries;
create policy suggested_workout_entries_delete_accessible
  on public.suggested_workout_entries for delete to authenticated
  using (exists (
    select 1 from public.suggested_workouts workout
    where workout.id = suggested_workout_id
      and app_private.person_is_accessible(workout.person_id)
  ));

drop policy if exists suggested_workout_sets_select_accessible on public.suggested_workout_sets;
create policy suggested_workout_sets_select_accessible
  on public.suggested_workout_sets for select to authenticated
  using (exists (
    select 1
    from public.suggested_workout_entries entry
    join public.suggested_workouts workout on workout.id = entry.suggested_workout_id
    where entry.id = suggested_workout_entry_id
      and app_private.person_is_accessible(workout.person_id)
  ));

drop policy if exists suggested_workout_sets_insert_accessible on public.suggested_workout_sets;
create policy suggested_workout_sets_insert_accessible
  on public.suggested_workout_sets for insert to authenticated
  with check (exists (
    select 1
    from public.suggested_workout_entries entry
    join public.suggested_workouts workout on workout.id = entry.suggested_workout_id
    where entry.id = suggested_workout_entry_id
      and app_private.person_is_accessible(workout.person_id)
  ));

drop policy if exists suggested_workout_sets_update_accessible on public.suggested_workout_sets;
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

drop policy if exists suggested_workout_sets_delete_accessible on public.suggested_workout_sets;
create policy suggested_workout_sets_delete_accessible
  on public.suggested_workout_sets for delete to authenticated
  using (exists (
    select 1
    from public.suggested_workout_entries entry
    join public.suggested_workouts workout on workout.id = entry.suggested_workout_id
    where entry.id = suggested_workout_entry_id
      and app_private.person_is_accessible(workout.person_id)
  ));
