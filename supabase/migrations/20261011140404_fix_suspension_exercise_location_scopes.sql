-- Repair the imported Gym-only ring/TRX defaults for Noam's enabled catalogue.
-- Keep explicit Home-only preferences, disabled exercises, and other profiles.
-- Both still requires every structured equipment item at the selected location.
update public.person_exercises pe
set location_scope = 'both', updated_at = now()
from public.exercises exercise, public.people person
where pe.exercise_id = exercise.id
  and pe.person_id = person.id
  and person.display_name = 'Noam'
  and person.status = 'active'
  and pe.is_enabled
  and pe.location_scope = 'gym'
  and exercise.is_active
  and (
    exercise.name like 'Ring %'
    or exercise.name like 'TRX %'
  )
  and exists (
    select 1
    from public.exercise_equipment_items requirement
    join public.equipment_items equipment on equipment.id = requirement.equipment_item_id
    where requirement.exercise_id = exercise.id
      and equipment.person_id = person.id
      and equipment.is_active
      and (
        (exercise.name like 'Ring %' and equipment.name = 'Gymnastic rings')
        or (exercise.name like 'TRX %' and equipment.name = 'TRX')
      )
  )
  and exists (
    select 1
    from public.training_locations location
    where location.person_id = person.id
      and location.kind = 'home'
      and location.is_active
      and not exists (
        select 1
        from public.exercise_equipment_items requirement
        join public.equipment_items equipment on equipment.id = requirement.equipment_item_id
        where requirement.exercise_id = exercise.id
          and equipment.person_id = person.id
          and (
            not equipment.is_active
            or not exists (
              select 1
              from public.training_location_equipment available
              where available.location_id = location.id
                and available.equipment_item_id = equipment.id
            )
          )
      )
  );
