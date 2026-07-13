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

create index if not exists session_method_blocks_session_idx
  on public.session_method_blocks (session_id, order_index);
create index if not exists session_method_blocks_method_idx
  on public.session_method_blocks (training_method_id);
create index if not exists session_method_block_entries_entry_idx
  on public.session_method_block_entries (session_entry_id);

alter table public.session_method_blocks enable row level security;
alter table public.session_method_block_entries enable row level security;

grant select, insert on
  public.session_method_blocks,
  public.session_method_block_entries
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
