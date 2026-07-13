create table if not exists public.training_locations (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  name text not null,
  kind text not null default 'other'
    check (kind in ('home', 'gym', 'other')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id, name)
);

drop trigger if exists training_locations_set_updated_at on public.training_locations;
create trigger training_locations_set_updated_at
before update on public.training_locations
for each row execute function public.set_updated_at();

alter table public.sessions
  add column if not exists training_location_id uuid
  references public.training_locations(id) on delete set null;

create index if not exists sessions_training_location_idx
  on public.sessions (training_location_id);

alter table public.training_locations enable row level security;

grant select, insert, update, delete on table public.training_locations to authenticated;

drop policy if exists training_locations_select_managed on public.training_locations;
create policy training_locations_select_managed
  on public.training_locations
  for select
  to authenticated
  using (app_private.person_is_accessible(person_id));

drop policy if exists training_locations_insert_managed on public.training_locations;
create policy training_locations_insert_managed
  on public.training_locations
  for insert
  to authenticated
  with check (app_private.person_is_accessible(person_id));

drop policy if exists training_locations_update_managed on public.training_locations;
create policy training_locations_update_managed
  on public.training_locations
  for update
  to authenticated
  using (app_private.person_is_accessible(person_id))
  with check (app_private.person_is_accessible(person_id));

drop policy if exists training_locations_delete_managed on public.training_locations;
create policy training_locations_delete_managed
  on public.training_locations
  for delete
  to authenticated
  using (app_private.person_is_accessible(person_id));

insert into public.training_locations (person_id, name, kind)
select p.id, defaults.name, defaults.kind
from public.people p
cross join (
  values ('Home', 'home'), ('Gym', 'gym')
) as defaults(name, kind)
where p.status = 'active'
on conflict (person_id, name) do update
set kind = excluded.kind,
    is_active = true;
