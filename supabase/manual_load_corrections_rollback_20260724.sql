-- Emergency rollback for migration
-- 20260724173738_apply_manual_load_corrections.sql.
-- Review dependent rows created after the correction before using this file.

begin;

delete from public.entry_sets set_row
using public.data_quality_audit_events event
join public.data_quality_batches batch on batch.id = event.batch_id
where batch.approved_checksum = 'workout-manual-load-and-front-lever-v1-2026-07-24'
  and event.entity_table = 'entry_sets'
  and event.action = 'insert'
  and set_row.id::text = event.entity_id;

update public.entry_sets set_row
set
  session_entry_id = (snapshot.row_value->>'session_entry_id')::uuid,
  set_number = (snapshot.row_value->>'set_number')::integer,
  reps = (snapshot.row_value->>'reps')::numeric,
  weight = (snapshot.row_value->>'weight')::numeric,
  duration_seconds = (snapshot.row_value->>'duration_seconds')::numeric,
  distance = (snapshot.row_value->>'distance')::numeric,
  distance_unit = snapshot.row_value->>'distance_unit',
  rpe = (snapshot.row_value->>'rpe')::numeric,
  rest_seconds = (snapshot.row_value->>'rest_seconds')::integer,
  assistance_type = snapshot.row_value->>'assistance_type',
  assistance_detail = snapshot.row_value->>'assistance_detail',
  quality = snapshot.row_value->>'quality',
  completed = (snapshot.row_value->>'completed')::boolean,
  notes = snapshot.row_value->>'notes',
  created_at = (snapshot.row_value->>'created_at')::timestamptz,
  rest_time = snapshot.row_value->>'rest_time',
  data_shape = snapshot.row_value->>'data_shape',
  aggregate_set_count = (snapshot.row_value->>'aggregate_set_count')::integer,
  load_semantics = snapshot.row_value->>'load_semantics',
  volume_status = snapshot.row_value->>'volume_status',
  implement_count = (snapshot.row_value->>'implement_count')::integer
from app_private.data_quality_snapshots snapshot
join public.data_quality_batches batch on batch.id = snapshot.batch_id
where batch.approved_checksum = 'workout-manual-load-and-front-lever-v1-2026-07-24'
  and snapshot.entity_table = 'entry_sets'
  and set_row.id::text = snapshot.entity_id;

update public.data_quality_batches
set
  status = 'reversed',
  reversed_at = now()
where approved_checksum = 'workout-manual-load-and-front-lever-v1-2026-07-24';

commit;
