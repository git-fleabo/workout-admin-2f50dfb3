-- Apply the reviewed load meanings supplied on 24 July 2026 and materialise
-- the remaining Front Lever record as three sets of one repetition.

begin;

create temporary table _dq_load_corrections (
  session_entry_id uuid primary key,
  load_semantics text not null,
  volume_status text not null,
  implement_count integer
) on commit drop;

insert into _dq_load_corrections (
  session_entry_id,
  load_semantics,
  volume_status,
  implement_count
)
values
  ('1526ed73-a854-4a31-a96d-6dae295010e9', 'per_implement_load', 'exact', 2),
  ('92706599-c0e1-44c1-b7b4-73ddf240a581', 'total_external_load', 'exact', null),
  ('f87779a4-ce8a-4cad-8e63-31f7871f3bbe', 'per_implement_load', 'exact', 2),
  ('73f9d8aa-716c-41b4-910f-1fd813ac8001', 'per_implement_load', 'exact', 2),
  ('3a06577d-5cc7-4590-930e-91eea7293464', 'assistance', 'not_applicable', null),
  ('d2961ee6-539c-48e8-a493-42bd05011866', 'total_external_load', 'exact', null),
  ('44b1ddb5-e842-4e79-a3ac-49d52288466d', 'assistance', 'not_applicable', null),
  ('0af43ed1-46a9-4367-8038-d960f151e9e7', 'combined_implement_load', 'exact', null),
  ('b17fcf59-507e-47a0-979d-eb25bc3c88d9', 'combined_implement_load', 'exact', null),
  ('efa6819d-cb52-4041-8bb6-8ec8414091ba', 'added_bodyweight_load', 'exact', null),
  ('6199a240-ba48-4357-ac61-a601088e42cf', 'total_external_load', 'exact', null),
  ('d2457e8d-dc5a-4358-bd40-967c7ab926eb', 'per_implement_load', 'exact', 2),
  ('2dfec9b4-a646-4bae-9889-8bab35467da0', 'per_implement_load', 'exact', 2),
  ('24ffb68d-a595-49a0-8f8e-a36d7263c2e3', 'total_external_load', 'exact', null),
  ('6863fcf5-2bb9-49e1-ac57-3ab7c2bd21b4', 'per_implement_load', 'exact', 2),
  ('3ed07991-9981-4bf5-95e8-8708053426b2', 'total_external_load', 'exact', null),
  ('0f4dfce5-164a-49af-8832-033b75dbc5ad', 'combined_implement_load', 'exact', null),
  ('80cdaeb7-e329-4331-9400-4a0017e462e3', 'total_external_load', 'exact', null),
  ('d7d7960a-18e9-4ec0-b59a-06ea33bb0732', 'combined_implement_load', 'exact', null);

create temporary table _dq_front_lever_original
on commit drop
as
select set_row.*
from public.entry_sets set_row
where set_row.id = '2ff1ef8d-2cea-4f0b-9e99-078e44f1e0ab';

do $$
begin
  if (select count(*) from _dq_load_corrections) <> 19 then
    raise exception 'Expected 19 reviewed load corrections.';
  end if;

  if (
    select count(*)
    from public.entry_sets set_row
    join _dq_load_corrections correction
      on correction.session_entry_id = set_row.session_entry_id
  ) <> 44 then
    raise exception 'Expected 44 set rows across the reviewed load corrections.';
  end if;

  if exists (
    select 1
    from public.entry_sets set_row
    join _dq_load_corrections correction
      on correction.session_entry_id = set_row.session_entry_id
    where set_row.load_semantics <> 'unknown'
      or set_row.volume_status <> 'ambiguous'
      or set_row.implement_count is not null
  ) then
    raise exception 'A reviewed load row no longer matches the expected baseline.';
  end if;

  if not exists (
    select 1
    from _dq_front_lever_original set_row
    where set_row.data_shape = 'aggregate'
      and set_row.aggregate_set_count = 3
      and set_row.reps = 1
      and set_row.set_number = 1
  ) then
    raise exception 'The reviewed Front Lever row no longer matches the expected baseline.';
  end if;
end
$$;

insert into public.data_quality_batches (
  person_id,
  batch_kind,
  status,
  approved_checksum,
  notes
)
select distinct
  session.person_id,
  'manual_load_and_rep_correction',
  'planned',
  'workout-manual-load-and-front-lever-v1-2026-07-24',
  'Reviewed load meanings for 19 entries plus Front Lever correction to 1/1/1.'
from (
  select correction.session_entry_id
  from _dq_load_corrections correction
  union
  select set_row.session_entry_id
  from _dq_front_lever_original set_row
) affected
join public.session_entries entry on entry.id = affected.session_entry_id
join public.sessions session on session.id = entry.session_id
on conflict (person_id, approved_checksum) where approved_checksum is not null
do nothing;

insert into app_private.data_quality_snapshots (
  batch_id,
  entity_table,
  entity_id,
  row_value
)
select
  batch.id,
  'entry_sets',
  set_row.id::text,
  to_jsonb(set_row)
from (
  select set_row.*
  from public.entry_sets set_row
  join _dq_load_corrections correction
    on correction.session_entry_id = set_row.session_entry_id
  union all
  select set_row.*
  from _dq_front_lever_original set_row
) set_row
join public.session_entries entry on entry.id = set_row.session_entry_id
join public.sessions session on session.id = entry.session_id
join public.data_quality_batches batch
  on batch.person_id = session.person_id
  and batch.approved_checksum = 'workout-manual-load-and-front-lever-v1-2026-07-24'
on conflict do nothing;

insert into public.data_quality_audit_events (
  batch_id,
  person_id,
  entity_table,
  entity_id,
  action,
  before_value,
  after_value,
  reason,
  reversal_value
)
select
  batch.id,
  session.person_id,
  'entry_sets',
  set_row.id::text,
  'update',
  to_jsonb(set_row),
  to_jsonb(set_row) || jsonb_build_object(
    'load_semantics', correction.load_semantics,
    'volume_status', correction.volume_status,
    'implement_count', correction.implement_count
  ),
  'Applied the reviewed historical load meaning',
  to_jsonb(set_row)
from public.entry_sets set_row
join _dq_load_corrections correction
  on correction.session_entry_id = set_row.session_entry_id
join public.session_entries entry on entry.id = set_row.session_entry_id
join public.sessions session on session.id = entry.session_id
join public.data_quality_batches batch
  on batch.person_id = session.person_id
  and batch.approved_checksum = 'workout-manual-load-and-front-lever-v1-2026-07-24';

update public.entry_sets set_row
set
  load_semantics = correction.load_semantics,
  volume_status = correction.volume_status,
  implement_count = correction.implement_count
from _dq_load_corrections correction
where correction.session_entry_id = set_row.session_entry_id;

insert into public.data_quality_audit_events (
  batch_id,
  person_id,
  entity_table,
  entity_id,
  action,
  before_value,
  after_value,
  reason,
  reversal_value
)
select
  batch.id,
  session.person_id,
  'entry_sets',
  original.id::text,
  'update',
  to_jsonb(original),
  to_jsonb(original) || jsonb_build_object(
    'reps', 1,
    'data_shape', 'individual',
    'aggregate_set_count', null
  ),
  'Corrected the reviewed Front Lever record from one aggregate rep to three sets of one',
  to_jsonb(original)
from _dq_front_lever_original original
join public.session_entries entry on entry.id = original.session_entry_id
join public.sessions session on session.id = entry.session_id
join public.data_quality_batches batch
  on batch.person_id = session.person_id
  and batch.approved_checksum = 'workout-manual-load-and-front-lever-v1-2026-07-24';

update public.entry_sets set_row
set
  reps = 1,
  data_shape = 'individual',
  aggregate_set_count = null
where set_row.id = '2ff1ef8d-2cea-4f0b-9e99-078e44f1e0ab';

create temporary table _dq_front_lever_inserts
on commit drop
as
select
  gen_random_uuid() as id,
  original.session_entry_id,
  generated_set_number as set_number,
  1::numeric as reps,
  original.weight,
  original.duration_seconds,
  original.distance,
  original.distance_unit,
  null::numeric as rpe,
  original.rest_seconds,
  original.assistance_type,
  original.assistance_detail,
  original.quality,
  original.completed,
  null::text as notes,
  original.created_at,
  original.rest_time,
  'individual'::text as data_shape,
  null::integer as aggregate_set_count,
  original.load_semantics,
  original.volume_status,
  original.implement_count
from _dq_front_lever_original original
cross join generate_series(2, 3) as generated_set_number;

insert into public.entry_sets (
  id,
  session_entry_id,
  set_number,
  reps,
  weight,
  duration_seconds,
  distance,
  distance_unit,
  rpe,
  rest_seconds,
  assistance_type,
  assistance_detail,
  quality,
  completed,
  notes,
  created_at,
  rest_time,
  data_shape,
  aggregate_set_count,
  load_semantics,
  volume_status,
  implement_count
)
select
  id,
  session_entry_id,
  set_number,
  reps,
  weight,
  duration_seconds,
  distance,
  distance_unit,
  rpe,
  rest_seconds,
  assistance_type,
  assistance_detail,
  quality,
  completed,
  notes,
  created_at,
  rest_time,
  data_shape,
  aggregate_set_count,
  load_semantics,
  volume_status,
  implement_count
from _dq_front_lever_inserts;

insert into public.data_quality_audit_events (
  batch_id,
  person_id,
  entity_table,
  entity_id,
  action,
  before_value,
  after_value,
  reason,
  reversal_value
)
select
  batch.id,
  session.person_id,
  'entry_sets',
  inserted.id::text,
  'insert',
  null,
  to_jsonb(inserted),
  'Created a reviewed Front Lever set at one repetition',
  jsonb_build_object('delete_entity', true)
from _dq_front_lever_inserts inserted
join public.session_entries entry on entry.id = inserted.session_entry_id
join public.sessions session on session.id = entry.session_id
join public.data_quality_batches batch
  on batch.person_id = session.person_id
  and batch.approved_checksum = 'workout-manual-load-and-front-lever-v1-2026-07-24';

update public.data_quality_batches
set
  status = 'applied',
  applied_checksum = approved_checksum,
  applied_at = now()
where approved_checksum = 'workout-manual-load-and-front-lever-v1-2026-07-24';

commit;
