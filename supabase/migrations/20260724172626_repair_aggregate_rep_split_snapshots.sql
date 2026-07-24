-- Repair rollback metadata from the aggregate-rep split. The migration used
-- `source` as a row alias, which collided with sessions.source and produced a
-- JSON string instead of the complete original entry_sets row.

begin;

create temporary table _dq_repaired_split_rows
on commit drop
as
select
  event.entity_id,
  to_jsonb(original_set) as after_value,
  to_jsonb(original_set) || jsonb_build_object(
    'reps', sum(current_set.reps),
    'data_shape', 'aggregate',
    'aggregate_set_count', count(current_set.id)
  ) as before_value
from public.data_quality_batches batch
join public.data_quality_audit_events event
  on event.batch_id = batch.id
  and event.entity_table = 'entry_sets'
  and event.action = 'update'
join public.entry_sets original_set
  on original_set.id::text = event.entity_id
join public.entry_sets current_set
  on current_set.session_entry_id = original_set.session_entry_id
where batch.approved_checksum = 'workout-aggregate-rep-split-v1-2026-07-24'
group by event.entity_id, original_set;

do $$
begin
  if (select count(*) from _dq_repaired_split_rows) <> 49 then
    raise exception 'Expected 49 aggregate-rep snapshot repairs.';
  end if;

  if exists (
    select 1
    from _dq_repaired_split_rows repaired
    where jsonb_typeof(repaired.before_value) <> 'object'
      or jsonb_typeof(repaired.after_value) <> 'object'
      or (repaired.before_value->>'data_shape') <> 'aggregate'
      or (repaired.after_value->>'data_shape') <> 'individual'
      or (repaired.before_value->>'reps')::numeric
        < (repaired.before_value->>'aggregate_set_count')::integer
  ) then
    raise exception 'Aggregate-rep snapshot reconstruction failed validation.';
  end if;
end
$$;

update app_private.data_quality_snapshots snapshot
set row_value = repaired.before_value
from _dq_repaired_split_rows repaired
join public.data_quality_batches batch
  on batch.approved_checksum = 'workout-aggregate-rep-split-v1-2026-07-24'
where snapshot.batch_id = batch.id
  and snapshot.entity_table = 'entry_sets'
  and snapshot.entity_id = repaired.entity_id;

update public.data_quality_audit_events event
set
  before_value = repaired.before_value,
  after_value = repaired.after_value,
  reversal_value = repaired.before_value
from _dq_repaired_split_rows repaired
join public.data_quality_batches batch
  on batch.approved_checksum = 'workout-aggregate-rep-split-v1-2026-07-24'
where event.batch_id = batch.id
  and event.entity_table = 'entry_sets'
  and event.entity_id = repaired.entity_id
  and event.action = 'update';

commit;
