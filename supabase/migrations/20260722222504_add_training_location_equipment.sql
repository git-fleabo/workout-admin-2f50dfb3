create table public.equipment_items (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  name text not null,
  category text not null default 'accessory'
    check (category in ('free_weights', 'fixed_equipment', 'cardio', 'functional', 'accessory')),
  circuit_group text not null default 'specialist'
    check (
      circuit_group in (
        'mat', 'kettlebell', 'dumbbell', 'barbell', 'bar_rings',
        'cardio_machine', 'cable_machine', 'specialist'
      )
    ),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index equipment_items_person_name_unique
  on public.equipment_items (person_id, lower(name));
create index equipment_items_person_active_idx
  on public.equipment_items (person_id, is_active, sort_order, name);

create trigger equipment_items_set_updated_at
before update on public.equipment_items
for each row execute function public.set_updated_at();

create table public.training_location_equipment (
  location_id uuid not null references public.training_locations(id) on delete cascade,
  equipment_item_id uuid not null references public.equipment_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (location_id, equipment_item_id)
);

create index training_location_equipment_item_idx
  on public.training_location_equipment (equipment_item_id, location_id);

alter table public.equipment_items enable row level security;
alter table public.training_location_equipment enable row level security;

revoke all on table public.equipment_items from anon, authenticated;
revoke all on table public.training_location_equipment from anon, authenticated;

grant select, insert, update, delete on table public.equipment_items to authenticated;
grant select, insert, delete on table public.training_location_equipment to authenticated;

create policy equipment_items_select_accessible
  on public.equipment_items for select to authenticated
  using (app_private.person_is_accessible(person_id));

create policy equipment_items_insert_accessible
  on public.equipment_items for insert to authenticated
  with check (app_private.person_is_accessible(person_id));

create policy equipment_items_update_accessible
  on public.equipment_items for update to authenticated
  using (app_private.person_is_accessible(person_id))
  with check (app_private.person_is_accessible(person_id));

create policy equipment_items_delete_accessible
  on public.equipment_items for delete to authenticated
  using (app_private.person_is_accessible(person_id));

create policy training_location_equipment_select_accessible
  on public.training_location_equipment for select to authenticated
  using (exists (
    select 1
    from public.training_locations location
    join public.equipment_items equipment
      on equipment.id = equipment_item_id
     and equipment.person_id = location.person_id
    where location.id = location_id
      and app_private.person_is_accessible(location.person_id)
  ));

create policy training_location_equipment_insert_accessible
  on public.training_location_equipment for insert to authenticated
  with check (exists (
    select 1
    from public.training_locations location
    join public.equipment_items equipment
      on equipment.id = equipment_item_id
     and equipment.person_id = location.person_id
    where location.id = location_id
      and app_private.person_is_accessible(location.person_id)
  ));

create policy training_location_equipment_delete_accessible
  on public.training_location_equipment for delete to authenticated
  using (exists (
    select 1
    from public.training_locations location
    join public.equipment_items equipment
      on equipment.id = equipment_item_id
     and equipment.person_id = location.person_id
    where location.id = location_id
      and app_private.person_is_accessible(location.person_id)
  ));

with defaults(name, category, circuit_group, sort_order) as (
  values
    ('Mat', 'accessory', 'mat', 10),
    ('Resistance bands', 'accessory', 'specialist', 20),
    ('Jump rope', 'accessory', 'specialist', 30),
    ('Weight plates', 'free_weights', 'specialist', 40),
    ('Dumbbell', 'free_weights', 'dumbbell', 50),
    ('Kettlebell', 'free_weights', 'kettlebell', 60),
    ('Barbell', 'free_weights', 'barbell', 70),
    ('Bench', 'fixed_equipment', 'specialist', 80),
    ('Pull-up bar', 'fixed_equipment', 'bar_rings', 90),
    ('Gymnastic rings', 'functional', 'bar_rings', 100),
    ('Cable machine', 'fixed_equipment', 'cable_machine', 110),
    ('Assisted pull-up machine', 'fixed_equipment', 'specialist', 120),
    ('Leg press machine', 'fixed_equipment', 'specialist', 130),
    ('Leg extension machine', 'fixed_equipment', 'specialist', 140),
    ('Leg curl machine', 'fixed_equipment', 'specialist', 150),
    ('Chest press machine', 'fixed_equipment', 'specialist', 160),
    ('Step / plyo box', 'functional', 'specialist', 170),
    ('TRX', 'functional', 'specialist', 180),
    ('Parallettes', 'functional', 'specialist', 190),
    ('Landmine', 'functional', 'specialist', 200),
    ('Medicine ball', 'functional', 'specialist', 210),
    ('Sled', 'functional', 'specialist', 220),
    ('Sandbag', 'functional', 'specialist', 230),
    ('Battle ropes', 'functional', 'specialist', 240),
    ('Heavy bag', 'functional', 'specialist', 250),
    ('Tyre', 'functional', 'specialist', 260),
    ('Hangboard', 'functional', 'specialist', 270),
    ('Bike', 'cardio', 'cardio_machine', 280),
    ('Rower', 'cardio', 'cardio_machine', 290),
    ('Air bike', 'cardio', 'cardio_machine', 300),
    ('SkiErg', 'cardio', 'specialist', 310)
)
insert into public.equipment_items (
  person_id,
  name,
  category,
  circuit_group,
  sort_order
)
select person.id, defaults.name, defaults.category, defaults.circuit_group, defaults.sort_order
from public.people person
cross join defaults
where person.status = 'active'
  and not exists (
    select 1
    from public.equipment_items existing
    where existing.person_id = person.id
      and lower(existing.name) = lower(defaults.name)
  );
