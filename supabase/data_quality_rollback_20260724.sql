-- Emergency rollback for workout-history-cleanup-v1-2026-07-24.
-- Run only after reviewing the selected batch and taking a fresh platform backup.
-- This restores the row-for-row private snapshots and leaves audit events intact.

begin;

create temporary table _rollback_batches on commit drop as
select id, person_id
from public.data_quality_batches
where approved_checksum = 'workout-history-cleanup-v1-2026-07-24'
  and status = 'applied';

do $$
begin
  if not exists (select 1 from _rollback_batches) then
    raise exception 'No applied data-quality cleanup batch was found.';
  end if;
end
$$;

alter table public.sessions
  drop constraint if exists sessions_completed_activity_present;
drop trigger if exists session_entries_validate_exercise_activity
  on public.session_entries;

update public.exercises target
set
  activity_type_id = restored.activity_type_id,
  name = restored.name,
  focus_area = restored.focus_area,
  equipment = restored.equipment,
  default_metric = restored.default_metric,
  suggested_sets = restored.suggested_sets,
  suggested_reps = restored.suggested_reps,
  notes = restored.notes,
  is_active = restored.is_active,
  source_sheet = restored.source_sheet,
  source_row = restored.source_row,
  updated_at = restored.updated_at
from (
  select (jsonb_populate_record(null::public.exercises, snapshot.row_value)).*
  from app_private.data_quality_snapshots snapshot
  join _rollback_batches batch on batch.id = snapshot.batch_id
  where snapshot.entity_table = 'exercises'
) restored
where target.id = restored.id;

insert into public.sessions
select (jsonb_populate_record(null::public.sessions, snapshot.row_value)).*
from app_private.data_quality_snapshots snapshot
join _rollback_batches batch on batch.id = snapshot.batch_id
where snapshot.entity_table = 'sessions'
  and not exists (
    select 1 from public.sessions existing
    where existing.id = snapshot.entity_id::uuid
  );

update public.sessions target
set
  person_id = restored.person_id,
  activity_type_id = restored.activity_type_id,
  session_date = restored.session_date,
  title = restored.title,
  source = restored.source,
  completed = restored.completed,
  duration_minutes = restored.duration_minutes,
  intensity = restored.intensity,
  rpe = restored.rpe,
  notes = restored.notes,
  training_location_id = restored.training_location_id,
  source_sheet = restored.source_sheet,
  source_row = restored.source_row,
  created_at = restored.created_at,
  updated_at = restored.updated_at
from (
  select (jsonb_populate_record(null::public.sessions, snapshot.row_value)).*
  from app_private.data_quality_snapshots snapshot
  join _rollback_batches batch on batch.id = snapshot.batch_id
  where snapshot.entity_table = 'sessions'
) restored
where target.id = restored.id;

insert into public.session_entries
select (jsonb_populate_record(null::public.session_entries, snapshot.row_value)).*
from app_private.data_quality_snapshots snapshot
join _rollback_batches batch on batch.id = snapshot.batch_id
where snapshot.entity_table = 'session_entries'
  and not exists (
    select 1 from public.session_entries existing
    where existing.id = snapshot.entity_id::uuid
  );

update public.session_entries target
set
  session_id = restored.session_id,
  exercise_id = restored.exercise_id,
  activity_type_id = restored.activity_type_id,
  entry_kind = restored.entry_kind,
  name = restored.name,
  progression_level = restored.progression_level,
  order_index = restored.order_index,
  completed = restored.completed,
  notes = restored.notes,
  source_sheet = restored.source_sheet,
  source_row = restored.source_row,
  created_at = restored.created_at,
  updated_at = restored.updated_at
from (
  select (jsonb_populate_record(null::public.session_entries, snapshot.row_value)).*
  from app_private.data_quality_snapshots snapshot
  join _rollback_batches batch on batch.id = snapshot.batch_id
  where snapshot.entity_table = 'session_entries'
) restored
where target.id = restored.id;

update public.entry_sets target
set
  session_entry_id = restored.session_entry_id,
  set_number = restored.set_number,
  reps = restored.reps,
  weight = restored.weight,
  duration_seconds = restored.duration_seconds,
  distance = restored.distance,
  distance_unit = restored.distance_unit,
  rpe = restored.rpe,
  rest_seconds = restored.rest_seconds,
  rest_time = restored.rest_time,
  assistance_type = restored.assistance_type,
  assistance_detail = restored.assistance_detail,
  quality = restored.quality,
  completed = restored.completed,
  notes = restored.notes,
  data_shape = restored.data_shape,
  aggregate_set_count = restored.aggregate_set_count,
  load_semantics = restored.load_semantics,
  volume_status = restored.volume_status,
  implement_count = restored.implement_count,
  created_at = restored.created_at
from (
  select (jsonb_populate_record(null::public.entry_sets, snapshot.row_value)).*
  from app_private.data_quality_snapshots snapshot
  join _rollback_batches batch on batch.id = snapshot.batch_id
  where snapshot.entity_table = 'entry_sets'
) restored
where target.id = restored.id;

delete from public.exercise_aliases
where reason in (
  'Approved exact historical spelling mapping',
  'Historic Yoga could mean Yoga Flow or Yoga Class; no automatic link'
);

create trigger session_entries_validate_exercise_activity
before insert or update of exercise_id, activity_type_id
on public.session_entries
for each row execute function app_private.validate_exercise_activity_pair();

update public.data_quality_batches batch
set
  status = 'reversed',
  reversed_at = now(),
  notes = concat_ws(E'\n', batch.notes, 'Restored from private row snapshots.')
from _rollback_batches selected
where batch.id = selected.id;

commit;
