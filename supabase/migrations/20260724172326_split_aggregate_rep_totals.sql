-- Convert reviewed rep-only aggregate imports into individual set rows.
-- Totals are preserved exactly and remainder reps are assigned to the
-- earliest sets, producing a balanced non-increasing sequence.

begin;

create temporary table _dq_rep_split_source
on commit drop
as
select set_row.*
from public.entry_sets set_row
where set_row.data_shape = 'aggregate'
  and set_row.reps is not null
  and set_row.reps = trunc(set_row.reps)
  and set_row.duration_seconds is null
  and set_row.distance is null
  and set_row.aggregate_set_count in (2, 3, 4)
  and set_row.reps >= set_row.aggregate_set_count;

insert into public.data_quality_batches (
  person_id,
  batch_kind,
  status,
  approved_checksum,
  notes
)
select distinct
  session.person_id,
  'historical_aggregate_rep_split',
  'planned',
  'workout-aggregate-rep-split-v1-2026-07-24',
  'Approved balanced non-increasing split of rep-only historical totals. Exact totals are preserved.'
from _dq_rep_split_source source
join public.session_entries entry on entry.id = source.session_entry_id
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
  source.id::text,
  to_jsonb(source)
from _dq_rep_split_source source
join public.session_entries entry on entry.id = source.session_entry_id
join public.sessions session on session.id = entry.session_id
join public.data_quality_batches batch
  on batch.person_id = session.person_id
  and batch.approved_checksum = 'workout-aggregate-rep-split-v1-2026-07-24'
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
  source.id::text,
  'update',
  to_jsonb(source),
  to_jsonb(source) || jsonb_build_object(
    'set_number', 1,
    'reps',
      floor(source.reps / source.aggregate_set_count)
      + case when mod(source.reps, source.aggregate_set_count) >= 1 then 1 else 0 end,
    'data_shape', 'individual',
    'aggregate_set_count', null
  ),
  'Split a reviewed historical total into balanced non-increasing individual sets',
  to_jsonb(source)
from _dq_rep_split_source source
join public.session_entries entry on entry.id = source.session_entry_id
join public.sessions session on session.id = entry.session_id
join public.data_quality_batches batch
  on batch.person_id = session.person_id
  and batch.approved_checksum = 'workout-aggregate-rep-split-v1-2026-07-24';

update public.entry_sets set_row
set
  set_number = 1,
  reps =
    floor(source.reps / source.aggregate_set_count)
    + case when mod(source.reps, source.aggregate_set_count) >= 1 then 1 else 0 end,
  data_shape = 'individual',
  aggregate_set_count = null
from _dq_rep_split_source source
where set_row.id = source.id;

create temporary table _dq_rep_split_inserts
on commit drop
as
select
  gen_random_uuid() as id,
  source.session_entry_id,
  set_index as set_number,
  floor(source.reps / source.aggregate_set_count)
    + case
        when mod(source.reps, source.aggregate_set_count) >= set_index then 1
        else 0
      end as reps,
  source.weight,
  source.duration_seconds,
  source.distance,
  source.distance_unit,
  null::numeric as rpe,
  source.rest_seconds,
  source.assistance_type,
  source.assistance_detail,
  source.quality,
  source.completed,
  null::text as notes,
  source.created_at,
  source.rest_time,
  'individual'::text as data_shape,
  null::integer as aggregate_set_count,
  source.load_semantics,
  source.volume_status,
  source.implement_count
from _dq_rep_split_source source
cross join lateral generate_series(2, source.aggregate_set_count) as set_index;

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
from _dq_rep_split_inserts;

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
  'Created an individual set from a reviewed historical rep total',
  jsonb_build_object('delete_entity', true)
from _dq_rep_split_inserts inserted
join public.session_entries entry on entry.id = inserted.session_entry_id
join public.sessions session on session.id = entry.session_id
join public.data_quality_batches batch
  on batch.person_id = session.person_id
  and batch.approved_checksum = 'workout-aggregate-rep-split-v1-2026-07-24';

update public.data_quality_batches
set
  status = 'applied',
  applied_checksum = approved_checksum,
  applied_at = now()
where approved_checksum = 'workout-aggregate-rep-split-v1-2026-07-24';

commit;
