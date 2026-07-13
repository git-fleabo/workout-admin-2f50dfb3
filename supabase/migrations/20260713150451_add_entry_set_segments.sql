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

create index if not exists entry_set_segments_method_idx
  on public.entry_set_segments (training_method_id);

alter table public.entry_set_segments enable row level security;

grant select, insert on public.entry_set_segments to authenticated;

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
