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
  ('edt', 'Escalating Density Training', 'timed_density', 'Accumulates more quality work inside a fixed training block.', '{"block_minutes":15,"movement_count":2}'::jsonb),
  ('tabata', 'Tabata', 'timed_density', 'Eight rounds of timed work and recovery intervals.', '{"rounds":8,"work_seconds":20,"rest_seconds":10}'::jsonb)
on conflict (system_key) do update
set
  name = excluded.name,
  family = excluded.family,
  description = excluded.description,
  default_config = excluded.default_config,
  is_active = true;
