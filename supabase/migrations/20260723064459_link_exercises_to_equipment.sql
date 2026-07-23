-- Replace free-text exercise equipment matching with structured person-owned requirements.
create table public.exercise_equipment_items (
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  equipment_item_id uuid not null references public.equipment_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (exercise_id, equipment_item_id)
);

create index exercise_equipment_items_equipment_idx
  on public.exercise_equipment_items (equipment_item_id, exercise_id);

alter table public.exercise_equipment_items enable row level security;

revoke all on table public.exercise_equipment_items from anon, authenticated;
grant select, insert, delete on table public.exercise_equipment_items to authenticated;

create policy exercise_equipment_items_select_accessible
  on public.exercise_equipment_items for select to authenticated
  using (exists (
    select 1
    from public.equipment_items equipment
    where equipment.id = equipment_item_id
      and app_private.person_is_accessible(equipment.person_id)
  ));

create policy exercise_equipment_items_insert_admin
  on public.exercise_equipment_items for insert to authenticated
  with check (
    app_private.current_person_is_admin()
    and exists (
      select 1
      from public.equipment_items equipment
      where equipment.id = equipment_item_id
        and app_private.person_is_accessible(equipment.person_id)
    )
  );

create policy exercise_equipment_items_delete_admin
  on public.exercise_equipment_items for delete to authenticated
  using (
    app_private.current_person_is_admin()
    and exists (
      select 1
      from public.equipment_items equipment
      where equipment.id = equipment_item_id
        and app_private.person_is_accessible(equipment.person_id)
    )
  );

comment on table public.exercise_equipment_items is
  'Structured equipment requirements for an exercise. Every selected item must exist at a location for the exercise to be available there.';
comment on column public.exercises.equipment is
  'Legacy display snapshot. Structured availability uses exercise_equipment_items.';

-- Fill small gaps in the starter catalogue so legacy specialist movements can be mapped.
with defaults(name, category, circuit_group, sort_order) as (
  values
    ('Climbing wall', 'functional', 'specialist', 320),
    ('Kilter board', 'fixed_equipment', 'specialist', 330),
    ('Pinch block', 'functional', 'specialist', 340),
    ('Stall bars / pole', 'fixed_equipment', 'specialist', 350),
    ('Towel', 'accessory', 'specialist', 360),
    ('Wall target', 'functional', 'specialist', 370),
    ('Wrist roller', 'functional', 'specialist', 380),
    ('Grip implement', 'accessory', 'specialist', 390)
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

-- Conservative legacy backfill. Slash-separated alternatives are resolved to the
-- movement's primary/default implement rather than incorrectly requiring every alternative.
with mapped as (
  select exercise.id as exercise_id, equipment.id as equipment_item_id
  from public.exercises exercise
  join public.equipment_items equipment on equipment.is_active
  where
    (lower(equipment.name) = 'trx' and lower(coalesce(exercise.equipment, '')) like '%trx%')
    or (
      lower(equipment.name) = 'gymnastic rings'
      and (
        lower(coalesce(exercise.equipment, '')) like '%gymnastic rings%'
        or exercise.name = 'Ring Muscle-Up'
        or exercise.name = 'Back Lever'
      )
    )
    or (
      lower(equipment.name) = 'pull-up bar'
      and (
        lower(coalesce(exercise.equipment, '')) like '%pull-up bar%'
        or lower(coalesce(exercise.equipment, '')) = 'bar'
        or exercise.name in (
          '1-Arm Hang',
          'Bar Muscle-Up',
          'Chin-Up',
          'Dead Hang',
          'Fat Grip Hang',
          'Front Lever',
          'Hanging Leg Raise',
          'Pull-Up',
          'Towel Hang',
          'Weighted Pull-Up'
        )
      )
    )
    or (
      lower(equipment.name) = 'barbell'
      and (
        lower(coalesce(exercise.equipment, '')) = 'barbell'
        or lower(coalesce(exercise.equipment, '')) like 'barbell / bench%'
        or lower(coalesce(exercise.equipment, '')) like 'landmine / barbell%'
        or exercise.name = 'Deadlift'
      )
    )
    or (
      lower(equipment.name) = 'dumbbell'
      and (
        lower(coalesce(exercise.equipment, '')) in ('dumbbell', 'dumbbell ')
        or lower(coalesce(exercise.equipment, '')) like 'dumbbell / bench%'
        or lower(coalesce(exercise.equipment, '')) like 'dumbbell / step%'
        or exercise.name = 'ATG Squats'
      )
    )
    or (
      lower(equipment.name) = 'kettlebell'
      and (
        lower(coalesce(exercise.equipment, '')) = 'kettlebell'
        or exercise.name = 'Farmer Carry'
      )
    )
    or (
      lower(equipment.name) = 'bench'
      and (
        lower(coalesce(exercise.equipment, '')) like '%bench%'
        or exercise.name = 'Bench Press'
      )
    )
    or (
      lower(equipment.name) = 'mat'
      and (
        lower(coalesce(exercise.equipment, '')) = 'mat'
        or lower(coalesce(exercise.equipment, '')) like 'mat /%'
      )
    )
    or (
      lower(equipment.name) = 'resistance bands'
      and (
        lower(coalesce(exercise.equipment, '')) like '%resistance band%'
        or lower(coalesce(exercise.equipment, '')) like '%bands%'
      )
    )
    or (
      lower(equipment.name) = 'jump rope'
      and lower(coalesce(exercise.equipment, '')) like '%jump rope%'
    )
    or (
      lower(equipment.name) = 'weight plates'
      and lower(coalesce(exercise.equipment, '')) in ('weight plate', 'weight plates')
    )
    or (
      lower(equipment.name) = 'cable machine'
      and lower(coalesce(exercise.equipment, '')) like '%cable machine%'
    )
    or (
      lower(equipment.name) = 'assisted pull-up machine'
      and lower(coalesce(exercise.equipment, '')) like '%assisted pull-up machine%'
    )
    or (
      lower(equipment.name) = 'leg press machine'
      and lower(coalesce(exercise.equipment, '')) like '%leg press machine%'
    )
    or (
      lower(equipment.name) = 'leg extension machine'
      and lower(coalesce(exercise.equipment, '')) like '%leg extension machine%'
    )
    or (
      lower(equipment.name) = 'leg curl machine'
      and lower(coalesce(exercise.equipment, '')) like '%leg curl machine%'
    )
    or (
      lower(equipment.name) = 'chest press machine'
      and lower(coalesce(exercise.equipment, '')) like '%chest press machine%'
    )
    or (
      lower(equipment.name) = 'step / plyo box'
      and (
        lower(coalesce(exercise.equipment, '')) like '%step%'
        or exercise.name = 'Box Jumps'
      )
    )
    or (
      lower(equipment.name) = 'parallettes'
      and exercise.name in ('L-Sit', 'Planche')
    )
    or (
      lower(equipment.name) = 'landmine'
      and lower(coalesce(exercise.equipment, '')) like '%landmine%'
    )
    or (
      lower(equipment.name) = 'medicine ball'
      and lower(coalesce(exercise.equipment, '')) like '%medicine ball%'
    )
    or (
      lower(equipment.name) = 'sled'
      and lower(coalesce(exercise.equipment, '')) like '%sled%'
    )
    or (
      lower(equipment.name) = 'sandbag'
      and lower(coalesce(exercise.equipment, '')) like '%sandbag%'
    )
    or (
      lower(equipment.name) = 'battle ropes'
      and lower(coalesce(exercise.equipment, '')) like '%battle ropes%'
    )
    or (
      lower(equipment.name) = 'heavy bag'
      and lower(coalesce(exercise.equipment, '')) like '%heavy bag%'
    )
    or (
      lower(equipment.name) = 'tyre'
      and lower(coalesce(exercise.equipment, '')) like '%tyre%'
    )
    or (
      lower(equipment.name) = 'hangboard'
      and lower(coalesce(exercise.equipment, '')) like '%hangboard%'
    )
    or (
      lower(equipment.name) = 'bike'
      and lower(coalesce(exercise.equipment, '')) like '%bike%'
    )
    or (
      lower(equipment.name) = 'rower'
      and lower(coalesce(exercise.equipment, '')) like '%rower%'
    )
    or (
      lower(equipment.name) = 'air bike'
      and lower(coalesce(exercise.equipment, '')) like '%air bike%'
    )
    or (
      lower(equipment.name) = 'skierg'
      and lower(coalesce(exercise.equipment, '')) like '%skierg%'
    )
    or (
      lower(equipment.name) = 'climbing wall'
      and exercise.name in ('Bouldering Session', 'Ropes/Belay', 'Mix')
    )
    or (
      lower(equipment.name) = 'kilter board'
      and exercise.name = 'Kilter'
    )
    or (
      lower(equipment.name) = 'pinch block'
      and exercise.name = 'Pinch Block'
    )
    or (
      lower(equipment.name) = 'stall bars / pole'
      and exercise.name = 'Human Flag'
    )
    or (
      lower(equipment.name) = 'towel'
      and exercise.name = 'Towel Hang'
    )
    or (
      lower(equipment.name) = 'wall target'
      and exercise.name = 'Wall Ball'
    )
    or (
      lower(equipment.name) = 'wrist roller'
      and exercise.name = 'Wrist Roller'
    )
    or (
      lower(equipment.name) = 'grip implement'
      and exercise.name = 'Other'
      and lower(coalesce(exercise.equipment, '')) = 'grip tool'
    )
)
insert into public.exercise_equipment_items (exercise_id, equipment_item_id)
select distinct exercise_id, equipment_item_id
from mapped
on conflict (exercise_id, equipment_item_id) do nothing;
