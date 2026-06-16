insert into public.activity_types (name, slug, sort_order)
values
  ('Run', 'run', 120),
  ('Class', 'class', 130),
  ('Other', 'other', 999),
  ('Mobility', 'mobility', 50),
  ('Climbing', 'climbing', 90)
on conflict (slug) do update
set name = excluded.name,
    sort_order = excluded.sort_order;

with desired(type_name, name, focus_area, equipment, default_metric, suggested_sets, suggested_reps, notes) as (
  values
    ('Run', 'Jog', 'Easy', null, 'Distance / time', null, null, 'Easy pace; track distance, time, RPE/feel and notes.'),
    ('Run', 'Run', 'Run', null, 'Distance / time', null, null, 'Track distance, time, RPE/feel and notes.'),
    ('Run', 'Sprint', 'Speed', null, 'Efforts / distance / time', null, null, 'Track efforts, distance or time per effort, RPE/feel and notes.'),
    ('Class', 'Yoga Class', 'Class', 'Mat', 'Minutes', null, null, 'Use notes for venue, instructor, class style and difficulty.'),
    ('Class', 'Pilates Class', 'Class', 'Mat', 'Minutes', null, null, 'Use notes for venue, instructor, class style and difficulty.'),
    ('Class', 'Strength Class', 'Class', 'Any', 'Minutes', null, null, 'Use notes for venue, instructor, class style and difficulty.'),
    ('Class', 'Conditioning Class', 'Class', 'Any', 'Minutes', null, null, 'Use notes for venue, instructor, class style and difficulty.'),
    ('Other', 'Other Session', 'Other', 'Any', 'Minutes', null, null, 'Catch-all only when no other movement fits.'),
    ('Mobility', 'Side Split', 'Flexibility', 'Mat', 'Distance / hold / feel', null, null, 'Track distance in cm, hold seconds and feel 1-5.'),
    ('Mobility', 'Pancake', 'Flexibility', 'Mat', 'Distance / hold / feel', null, null, 'Track distance in cm, hold seconds and feel 1-5.'),
    ('Mobility', 'Pike', 'Flexibility', 'Mat', 'Distance / hold / feel', null, null, 'Track distance in cm, hold seconds and feel 1-5.'),
    ('Mobility', 'Bridge', 'Flexibility', 'Mat', 'Distance / hold / feel', null, null, 'Track distance in cm, hold seconds and feel 1-5.'),
    ('Mobility', 'Shoulder Flexion', 'Flexibility', 'Wall / floor', 'Distance / hold / feel', null, null, 'Track distance in cm, hold seconds and feel 1-5.'),
    ('Climbing', 'Bouldering Session', 'Climbing', 'Climbing gym', 'Hours / boulders / max grade', null, null, 'Track hours, boulders/problems, max grade, gradient where relevant, RPE and notes.'),
    ('Climbing', 'Indoor Ropes', 'Climbing', 'Climbing gym', 'Hours / routes / max grade', null, null, 'Track hours, routes, max grade, RPE and notes.'),
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
    ('Run', 'Jog', 'Easy', null, 'Distance / time', null, null, 'Easy pace; track distance, time, RPE/feel and notes.'),
    ('Run', 'Run', 'Run', null, 'Distance / time', null, null, 'Track distance, time, RPE/feel and notes.'),
    ('Run', 'Sprint', 'Speed', null, 'Efforts / distance / time', null, null, 'Track efforts, distance or time per effort, RPE/feel and notes.'),
    ('Class', 'Yoga Class', 'Class', 'Mat', 'Minutes', null, null, 'Use notes for venue, instructor, class style and difficulty.'),
    ('Class', 'Pilates Class', 'Class', 'Mat', 'Minutes', null, null, 'Use notes for venue, instructor, class style and difficulty.'),
    ('Class', 'Strength Class', 'Class', 'Any', 'Minutes', null, null, 'Use notes for venue, instructor, class style and difficulty.'),
    ('Class', 'Conditioning Class', 'Class', 'Any', 'Minutes', null, null, 'Use notes for venue, instructor, class style and difficulty.'),
    ('Other', 'Other Session', 'Other', 'Any', 'Minutes', null, null, 'Catch-all only when no other movement fits.'),
    ('Mobility', 'Side Split', 'Flexibility', 'Mat', 'Distance / hold / feel', null, null, 'Track distance in cm, hold seconds and feel 1-5.'),
    ('Mobility', 'Pancake', 'Flexibility', 'Mat', 'Distance / hold / feel', null, null, 'Track distance in cm, hold seconds and feel 1-5.'),
    ('Mobility', 'Pike', 'Flexibility', 'Mat', 'Distance / hold / feel', null, null, 'Track distance in cm, hold seconds and feel 1-5.'),
    ('Mobility', 'Bridge', 'Flexibility', 'Mat', 'Distance / hold / feel', null, null, 'Track distance in cm, hold seconds and feel 1-5.'),
    ('Mobility', 'Shoulder Flexion', 'Flexibility', 'Wall / floor', 'Distance / hold / feel', null, null, 'Track distance in cm, hold seconds and feel 1-5.'),
    ('Climbing', 'Bouldering Session', 'Climbing', 'Climbing gym', 'Hours / boulders / max grade', null, null, 'Track hours, boulders/problems, max grade, gradient where relevant, RPE and notes.'),
    ('Climbing', 'Indoor Ropes', 'Climbing', 'Climbing gym', 'Hours / routes / max grade', null, null, 'Track hours, routes, max grade, RPE and notes.'),
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

update public.exercises e
set is_active = false,
    updated_at = now()
from public.activity_types at
where e.activity_type_id = at.id
  and at.name = 'Bouldering';
