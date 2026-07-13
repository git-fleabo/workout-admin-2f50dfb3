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
