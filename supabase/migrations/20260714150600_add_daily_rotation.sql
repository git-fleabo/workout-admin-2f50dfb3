create table if not exists public.daily_rotation_items (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  target text,
  cue text,
  selection_weight smallint not null default 3
    check (selection_weight between 1 and 5),
  active_days smallint[] not null default array[1, 2, 3, 4, 5, 6, 7]::smallint[]
    check (
      cardinality(active_days) > 0
      and active_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
    ),
  minimum_days_between smallint not null default 1
    check (minimum_days_between between 0 and 30),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_rotation_assignments (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  item_id uuid not null references public.daily_rotation_items(id) on delete cascade,
  assigned_date date not null default current_date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (person_id, assigned_date)
);

create trigger daily_rotation_items_set_updated_at
before update on public.daily_rotation_items
for each row execute function public.set_updated_at();

create index if not exists daily_rotation_items_person_active_idx
  on public.daily_rotation_items (person_id, is_active, sort_order);

create index if not exists daily_rotation_assignments_person_date_idx
  on public.daily_rotation_assignments (person_id, assigned_date desc);

create index if not exists daily_rotation_assignments_item_date_idx
  on public.daily_rotation_assignments (item_id, assigned_date desc);

alter table public.daily_rotation_items enable row level security;
alter table public.daily_rotation_assignments enable row level security;

grant select, insert, update, delete on public.daily_rotation_items to authenticated;
grant select, insert, update, delete on public.daily_rotation_assignments to authenticated;

create policy daily_rotation_items_select_managed
  on public.daily_rotation_items
  for select
  to authenticated
  using (app_private.person_is_accessible(person_id));

create policy daily_rotation_items_insert_managed
  on public.daily_rotation_items
  for insert
  to authenticated
  with check (app_private.person_is_accessible(person_id));

create policy daily_rotation_items_update_managed
  on public.daily_rotation_items
  for update
  to authenticated
  using (app_private.person_is_accessible(person_id))
  with check (app_private.person_is_accessible(person_id));

create policy daily_rotation_items_delete_managed
  on public.daily_rotation_items
  for delete
  to authenticated
  using (app_private.person_is_accessible(person_id));

create policy daily_rotation_assignments_select_managed
  on public.daily_rotation_assignments
  for select
  to authenticated
  using (app_private.person_is_accessible(person_id));

create policy daily_rotation_assignments_insert_managed
  on public.daily_rotation_assignments
  for insert
  to authenticated
  with check (
    app_private.person_is_accessible(person_id)
    and exists (
      select 1
      from public.daily_rotation_items item
      where item.id = item_id
        and item.person_id = daily_rotation_assignments.person_id
        and app_private.person_is_accessible(item.person_id)
    )
  );

create policy daily_rotation_assignments_update_managed
  on public.daily_rotation_assignments
  for update
  to authenticated
  using (app_private.person_is_accessible(person_id))
  with check (
    app_private.person_is_accessible(person_id)
    and exists (
      select 1
      from public.daily_rotation_items item
      where item.id = item_id
        and item.person_id = daily_rotation_assignments.person_id
        and app_private.person_is_accessible(item.person_id)
    )
  );

create policy daily_rotation_assignments_delete_managed
  on public.daily_rotation_assignments
  for delete
  to authenticated
  using (app_private.person_is_accessible(person_id));
