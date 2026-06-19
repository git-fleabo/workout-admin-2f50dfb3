insert into public.activity_types (name, slug, sort_order)
values
  ('Cardio', 'cardio', 20),
  ('Conditioning', 'conditioning', 100),
  ('Class', 'class', 130),
  ('Other', 'other', 999),
  ('Mobility/Flexibility', 'mobility-flexibility', 45),
  ('Climbing', 'climbing', 90)
on conflict (slug) do update
set name = excluded.name,
    sort_order = excluded.sort_order;

with target as (
  select id
  from public.activity_types
  where name = 'Mobility/Flexibility' or slug = 'mobility-flexibility'
  limit 1
),
legacy_types as (
  select id
  from public.activity_types
  where name in ('Mobility', 'Stretching')
     or slug in ('mobility', 'stretching')
)
update public.exercises
set activity_type_id = (select id from target),
    updated_at = now()
where activity_type_id in (select id from legacy_types)
  and exists (select 1 from target);

with type_ids as (
  select
    (select id from public.activity_types where name = 'Cardio' limit 1) as cardio_id,
    (select id from public.activity_types where name = 'Run' limit 1) as run_id,
    (select id from public.activity_types where name = 'Conditioning' limit 1) as conditioning_id,
    (select id from public.activity_types where name = 'Power' limit 1) as power_id
),
moved as (
  update public.exercises e
  set activity_type_id = case
        when e.activity_type_id = type_ids.run_id then type_ids.cardio_id
        when e.activity_type_id = type_ids.power_id then type_ids.conditioning_id
        else e.activity_type_id
      end,
      updated_at = now()
  from type_ids
  where e.activity_type_id in (type_ids.run_id, type_ids.power_id)
    and e.is_active = true
    and not exists (
      select 1
      from public.exercises duplicate
      where duplicate.id <> e.id
        and duplicate.is_active = true
        and lower(duplicate.name) = lower(e.name)
        and duplicate.activity_type_id = case
          when e.activity_type_id = type_ids.run_id then type_ids.cardio_id
          when e.activity_type_id = type_ids.power_id then type_ids.conditioning_id
          else e.activity_type_id
        end
    )
  returning e.id
)
update public.exercises e
set is_active = false,
    updated_at = now(),
    notes = concat_ws(' ', nullif(e.notes, ''), 'Retired duplicate after Run/Cardio and Power/Conditioning category consolidation.')
from type_ids
where e.activity_type_id in (type_ids.run_id, type_ids.power_id)
  and e.is_active = true
  and exists (
    select 1
    from public.exercises duplicate
    where duplicate.id <> e.id
      and duplicate.is_active = true
      and lower(duplicate.name) = lower(e.name)
      and duplicate.activity_type_id = case
        when e.activity_type_id = type_ids.run_id then type_ids.cardio_id
        when e.activity_type_id = type_ids.power_id then type_ids.conditioning_id
        else e.activity_type_id
      end
  );

update public.exercises
set is_active = false,
    updated_at = now(),
    notes = concat_ws(' ', nullif(notes, ''), 'Retired after Bike and Row were split into separate Cardio movements.')
where lower(name) = 'run / bike / row';

update public.exercises
set name = 'Ring Muscle-Up',
    focus_area = coalesce(focus_area, 'Pull'),
    equipment = 'Rings / Bodyweight / Assistance / Added weight',
    default_metric = 'Reps',
    suggested_sets = coalesce(suggested_sets, '3'),
    suggested_reps = coalesce(suggested_reps, '6-10'),
    notes = coalesce(notes, 'Track total reps across all sets, assistance or added load as needed.'),
    updated_at = now()
where lower(name) = 'muscle-up'
  and not exists (
    select 1
    from public.exercises existing
    where existing.id <> public.exercises.id
      and existing.is_active = true
      and lower(existing.name) = 'ring muscle-up'
  );

update public.exercises
set is_active = false,
    updated_at = now(),
    notes = concat_ws(' ', nullif(notes, ''), 'Retired duplicate after Muscle-Up was split into Bar Muscle-Up and Ring Muscle-Up.')
where lower(name) = 'muscle-up';

update public.session_entries
set name = 'Ring Muscle-Up',
    updated_at = now()
where lower(name) = 'muscle-up';

update public.one_rm_tests
set exercise_name = 'Ring Muscle-Up',
    updated_at = now()
where lower(exercise_name) = 'muscle-up';

with desired(type_name, name, focus_area, equipment, default_metric, suggested_sets, suggested_reps, notes) as (
  values
    ('Cardio', 'Jog', 'Easy', null, 'Distance / time', null, null, 'Easy pace; track distance, time, RPE/feel and notes.'),
    ('Cardio', 'Run', 'Run', null, 'Distance / time', null, null, 'Track distance, time, RPE/feel and notes.'),
    ('Cardio', 'Bike', 'Bike', 'Bike / stationary bike', 'Distance / time', null, null, 'Track distance or minutes, RPE/feel and notes.'),
    ('Cardio', 'Row', 'Row', 'Rower', 'Distance / time', null, null, 'Track distance or minutes, RPE/feel and notes.'),
    ('Cardio', 'Sprint', 'Speed', null, 'Efforts / distance / time', null, null, 'Track efforts, distance or time per effort, RPE/feel and notes.'),
    ('Skills/Calisthenics', 'Bar Muscle-Up', 'Pull', 'Bar / Bodyweight / Assistance / Added weight', 'Reps', '3', '6-10', 'Track total reps across all sets, assistance or added load as needed.'),
    ('Skills/Calisthenics', 'Ring Muscle-Up', 'Pull', 'Rings / Bodyweight / Assistance / Added weight', 'Reps', '3', '6-10', 'Track total reps across all sets, assistance or added load as needed.'),
    ('Skills/Calisthenics', 'Handstand Pushups', 'Push', 'Wall / parallettes / bodyweight', 'Reps', '3', '6-10', 'Track total reps across all sets and assistance or deficit as needed.'),
    ('Skills/Calisthenics', 'Pistol Squats', 'Legs', 'Bodyweight / assistance / added load', 'Reps', '3', '6-10', 'Track total reps across all sets and assistance or added load as needed.'),
    ('Skills/Calisthenics', 'Pushups', 'Push', 'Bodyweight / added load', 'Reps', '3', '10-20', 'Track total reps across all sets and variation details in notes.'),
    ('Skills/Calisthenics', '1-Arm Pushups', 'Push', 'Bodyweight / assistance', 'Reps', '3', '3-8', 'Track total reps across all sets and assistance or progression details in notes.'),
    ('Class', 'Yoga Class', 'Class', 'Mat', 'Minutes', null, null, 'Use notes for venue, instructor, class style and difficulty.'),
    ('Class', 'Pilates Class', 'Class', 'Mat', 'Minutes', null, null, 'Use notes for venue, instructor, class style and difficulty.'),
    ('Class', 'Strength Class', 'Class', 'Any', 'Minutes', null, null, 'Use notes for venue, instructor, class style and difficulty.'),
    ('Class', 'Conditioning Class', 'Class', 'Any', 'Minutes', null, null, 'Use notes for venue, instructor, class style and difficulty.'),
    ('Other', 'Other Session', 'Other', 'Any', 'Minutes', null, null, 'Catch-all only when no other movement fits.'),
    ('Mobility/Flexibility', 'Side Split', 'Flexibility', 'Mat', 'Distance / hold / feel', null, null, 'Track distance in cm, hold seconds and feel 1-5.'),
    ('Mobility/Flexibility', 'Pancake', 'Flexibility', 'Mat', 'Distance / hold / feel', null, null, 'Track distance in cm, hold seconds and feel 1-5.'),
    ('Mobility/Flexibility', 'Pike', 'Flexibility', 'Mat', 'Distance / hold / feel', null, null, 'Track distance in cm, hold seconds and feel 1-5.'),
    ('Mobility/Flexibility', 'Bridge', 'Flexibility', 'Mat', 'Distance / hold / feel', null, null, 'Track distance in cm, hold seconds and feel 1-5.'),
    ('Mobility/Flexibility', 'Shoulder Flexion', 'Flexibility', 'Wall / floor', 'Distance / hold / feel', null, null, 'Track distance in cm, hold seconds and feel 1-5.'),
    ('Climbing', 'Bouldering Session', 'Climbing', 'Climbing gym', 'Hours / boulders / max grade', null, null, 'Track hours, boulders/problems, max grade, gradient where relevant, RPE and notes.'),
    ('Climbing', 'Ropes/Belay', 'Climbing', 'Climbing gym', 'Hours / routes / max grade', null, null, 'Track hours, routes, max grade, RPE and notes.'),
    ('Climbing', 'Kilter', 'Climbing', 'Kilter board', 'Hours / boulders / grade / gradient', null, null, 'Track hours, boulders/problems, max grade, gradient, RPE and notes.'),
    ('Climbing', 'Mix', 'Climbing', 'Climbing gym', 'Hours / routes / boulders / grade', null, null, 'Mixed climbing session; track the useful details in notes.')
),
typed as (
  select d.*, at.id as activity_type_id
  from desired d
  join public.activity_types at on at.name = d.type_name
)
update public.exercises e
set activity_type_id = typed.activity_type_id,
    focus_area = typed.focus_area,
    equipment = typed.equipment,
    default_metric = typed.default_metric,
    suggested_sets = typed.suggested_sets,
    suggested_reps = typed.suggested_reps,
    notes = typed.notes,
    is_active = true,
    updated_at = now()
from typed
where lower(e.name) = lower(typed.name);

with desired(type_name, name, focus_area, equipment, default_metric, suggested_sets, suggested_reps, notes) as (
  values
    ('Cardio', 'Jog', 'Easy', null, 'Distance / time', null, null, 'Easy pace; track distance, time, RPE/feel and notes.'),
    ('Cardio', 'Run', 'Run', null, 'Distance / time', null, null, 'Track distance, time, RPE/feel and notes.'),
    ('Cardio', 'Bike', 'Bike', 'Bike / stationary bike', 'Distance / time', null, null, 'Track distance or minutes, RPE/feel and notes.'),
    ('Cardio', 'Row', 'Row', 'Rower', 'Distance / time', null, null, 'Track distance or minutes, RPE/feel and notes.'),
    ('Cardio', 'Sprint', 'Speed', null, 'Efforts / distance / time', null, null, 'Track efforts, distance or time per effort, RPE/feel and notes.'),
    ('Skills/Calisthenics', 'Bar Muscle-Up', 'Pull', 'Bar / Bodyweight / Assistance / Added weight', 'Reps', '3', '6-10', 'Track total reps across all sets, assistance or added load as needed.'),
    ('Skills/Calisthenics', 'Ring Muscle-Up', 'Pull', 'Rings / Bodyweight / Assistance / Added weight', 'Reps', '3', '6-10', 'Track total reps across all sets, assistance or added load as needed.'),
    ('Skills/Calisthenics', 'Handstand Pushups', 'Push', 'Wall / parallettes / bodyweight', 'Reps', '3', '6-10', 'Track total reps across all sets and assistance or deficit as needed.'),
    ('Skills/Calisthenics', 'Pistol Squats', 'Legs', 'Bodyweight / assistance / added load', 'Reps', '3', '6-10', 'Track total reps across all sets and assistance or added load as needed.'),
    ('Skills/Calisthenics', 'Pushups', 'Push', 'Bodyweight / added load', 'Reps', '3', '10-20', 'Track total reps across all sets and variation details in notes.'),
    ('Skills/Calisthenics', '1-Arm Pushups', 'Push', 'Bodyweight / assistance', 'Reps', '3', '3-8', 'Track total reps across all sets and assistance or progression details in notes.'),
    ('Class', 'Yoga Class', 'Class', 'Mat', 'Minutes', null, null, 'Use notes for venue, instructor, class style and difficulty.'),
    ('Class', 'Pilates Class', 'Class', 'Mat', 'Minutes', null, null, 'Use notes for venue, instructor, class style and difficulty.'),
    ('Class', 'Strength Class', 'Class', 'Any', 'Minutes', null, null, 'Use notes for venue, instructor, class style and difficulty.'),
    ('Class', 'Conditioning Class', 'Class', 'Any', 'Minutes', null, null, 'Use notes for venue, instructor, class style and difficulty.'),
    ('Other', 'Other Session', 'Other', 'Any', 'Minutes', null, null, 'Catch-all only when no other movement fits.'),
    ('Mobility/Flexibility', 'Side Split', 'Flexibility', 'Mat', 'Distance / hold / feel', null, null, 'Track distance in cm, hold seconds and feel 1-5.'),
    ('Mobility/Flexibility', 'Pancake', 'Flexibility', 'Mat', 'Distance / hold / feel', null, null, 'Track distance in cm, hold seconds and feel 1-5.'),
    ('Mobility/Flexibility', 'Pike', 'Flexibility', 'Mat', 'Distance / hold / feel', null, null, 'Track distance in cm, hold seconds and feel 1-5.'),
    ('Mobility/Flexibility', 'Bridge', 'Flexibility', 'Mat', 'Distance / hold / feel', null, null, 'Track distance in cm, hold seconds and feel 1-5.'),
    ('Mobility/Flexibility', 'Shoulder Flexion', 'Flexibility', 'Wall / floor', 'Distance / hold / feel', null, null, 'Track distance in cm, hold seconds and feel 1-5.'),
    ('Climbing', 'Bouldering Session', 'Climbing', 'Climbing gym', 'Hours / boulders / max grade', null, null, 'Track hours, boulders/problems, max grade, gradient where relevant, RPE and notes.'),
    ('Climbing', 'Ropes/Belay', 'Climbing', 'Climbing gym', 'Hours / routes / max grade', null, null, 'Track hours, routes, max grade, RPE and notes.'),
    ('Climbing', 'Kilter', 'Climbing', 'Kilter board', 'Hours / boulders / grade / gradient', null, null, 'Track hours, boulders/problems, max grade, gradient, RPE and notes.'),
    ('Climbing', 'Mix', 'Climbing', 'Climbing gym', 'Hours / routes / boulders / grade', null, null, 'Mixed climbing session; track the useful details in notes.')
),
typed as (
  select d.*, at.id as activity_type_id
  from desired d
  join public.activity_types at on at.name = d.type_name
),
numbered as (
  select
    typed.*,
    (select coalesce(max(source_row), 4) from public.exercises where source_sheet = 'Exercise Library')
      + row_number() over (order by typed.type_name, typed.name) as next_source_row
  from typed
  where not exists (
    select 1
    from public.exercises e
    where lower(e.name) = lower(typed.name)
  )
)
insert into public.exercises (
  activity_type_id,
  name,
  focus_area,
  equipment,
  default_metric,
  suggested_sets,
  suggested_reps,
  notes,
  is_active,
  source_sheet,
  source_row
)
select
  activity_type_id,
  name,
  focus_area,
  equipment,
  default_metric,
  suggested_sets,
  suggested_reps,
  notes,
  true,
  'Exercise Library',
  next_source_row
from numbered;

update public.exercises
set is_active = false,
    updated_at = now()
where lower(name) = 'rice bucket';

update public.exercises e
set is_active = false,
    updated_at = now()
from public.activity_types at
where e.activity_type_id = at.id
  and at.name = 'Strength'
  and lower(e.name) = 'farmer carry';

update public.exercises
set is_active = false,
    updated_at = now()
where lower(name) = 'indoor climbing session';

update public.exercises
set is_active = false,
    updated_at = now()
where lower(name) = 'indoor ropes';

update public.exercises e
set is_active = false,
    updated_at = now()
from public.activity_types at
where e.activity_type_id = at.id
  and at.name = 'Bouldering';

with strength as (
  select id from public.activity_types where name = 'Strength' limit 1
),
renamed as (
  update public.exercises
  set name = 'Pull-Up',
      equipment = 'Bodyweight / Assistance / Added weight',
      default_metric = 'Reps',
      suggested_sets = '3',
      suggested_reps = '6-10',
      notes = 'Track bodyweight reps, assistance or added load as needed.',
      updated_at = now()
  where lower(name) = 'pull-up / lat pulldown'
  returning id
),
desired(name, focus_area, equipment, default_metric, suggested_sets, suggested_reps, notes) as (
  values
    ('Lat Pulldown', 'Pull', 'Cable machine', 'Weight x reps', '3', '8-12', 'Track machine weight, reps and RPE.'),
    ('Chin-Up', 'Pull', 'Bodyweight / Assistance / Added weight', 'Reps', '3', '6-10', 'Track bodyweight reps, assistance or added load as needed.')
),
numbered as (
  select
    desired.*,
    (select id from strength) as activity_type_id,
    (select coalesce(max(source_row), 4) from public.exercises where source_sheet = 'Exercise Library')
      + row_number() over (order by desired.name) as next_source_row
  from desired
  where not exists (
    select 1
    from public.exercises e
    where lower(e.name) = lower(desired.name)
  )
)
insert into public.exercises (
  activity_type_id,
  name,
  focus_area,
  equipment,
  default_metric,
  suggested_sets,
  suggested_reps,
  notes,
  is_active,
  source_sheet,
  source_row
)
select
  activity_type_id,
  name,
  focus_area,
  equipment,
  default_metric,
  suggested_sets,
  suggested_reps,
  notes,
  true,
  'Exercise Library',
  next_source_row
from numbered;
