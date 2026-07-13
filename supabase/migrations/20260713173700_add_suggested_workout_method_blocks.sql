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

create policy suggested_workout_method_blocks_select_accessible
  on public.suggested_workout_method_blocks for select to authenticated
  using (exists (
    select 1 from public.suggested_workouts workout
    where workout.id = suggested_workout_id
      and app_private.person_is_accessible(workout.person_id)
  ));

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
