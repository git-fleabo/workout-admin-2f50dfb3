-- Resolve orphan entries whose names are already exact canonical catalogue
-- names. This is deterministic equality after punctuation/case normalization,
-- not fuzzy matching. Yoga remains an explicit manual-review alias.

insert into public.exercise_aliases (
  alias_name,
  exercise_id,
  activity_type_id,
  status,
  reason
)
select
  'Yoga',
  exercise.id,
  activity.id,
  'manual_review',
  'Historic Yoga could mean Yoga Flow or Yoga Class; no automatic link'
from public.exercises exercise
join public.activity_types activity on activity.id = exercise.activity_type_id
where exercise.name = 'Yoga Flow'
  and not exists (
    select 1 from public.exercise_aliases alias
    where alias.normalized_alias = 'yoga'
      and alias.status = 'manual_review'
  );

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
  'session_entries',
  entry.id::text,
  'update',
  to_jsonb(entry),
  to_jsonb(entry) || jsonb_build_object(
    'exercise_id', exercise.id,
    'activity_type_id', exercise.activity_type_id,
    'name', exercise.name
  ),
  'Linked an exact canonical catalogue name',
  to_jsonb(entry)
from public.session_entries entry
join public.sessions session on session.id = entry.session_id
join public.data_quality_batches batch
  on batch.person_id = session.person_id
  and batch.approved_checksum = 'workout-history-cleanup-v1-2026-07-24'
join public.exercises exercise
  on exercise.is_active
  and regexp_replace(lower(btrim(exercise.name)), '[^a-z0-9]+', '', 'g') =
    regexp_replace(lower(btrim(entry.name)), '[^a-z0-9]+', '', 'g')
where entry.exercise_id is null
  and not exists (
    select 1
    from public.exercises candidate
    where candidate.is_active
      and regexp_replace(lower(btrim(candidate.name)), '[^a-z0-9]+', '', 'g') =
        regexp_replace(lower(btrim(entry.name)), '[^a-z0-9]+', '', 'g')
      and candidate.id <> exercise.id
  );

update public.session_entries entry
set
  exercise_id = exercise.id,
  activity_type_id = exercise.activity_type_id,
  name = exercise.name,
  updated_at = now()
from public.exercises exercise
where entry.exercise_id is null
  and exercise.is_active
  and regexp_replace(lower(btrim(exercise.name)), '[^a-z0-9]+', '', 'g') =
    regexp_replace(lower(btrim(entry.name)), '[^a-z0-9]+', '', 'g')
  and not exists (
    select 1
    from public.exercises candidate
    where candidate.is_active
      and regexp_replace(lower(btrim(candidate.name)), '[^a-z0-9]+', '', 'g') =
        regexp_replace(lower(btrim(entry.name)), '[^a-z0-9]+', '', 'g')
      and candidate.id <> exercise.id
  );

with derived as (
  select
    session.id,
    case
      when count(distinct entry.activity_type_id) = 1
        then min(entry.activity_type_id::text)::uuid
      when count(entry.id) > 1
        then (select id from public.activity_types where slug = 'mixed-training')
      else coalesce(
        session.activity_type_id,
        (select id from public.activity_types where name = 'Other')
      )
    end as activity_type_id
  from public.sessions session
  left join public.session_entries entry on entry.session_id = session.id
  where session.completed
  group by session.id
)
update public.sessions session
set activity_type_id = derived.activity_type_id
from derived
where session.id = derived.id
  and session.activity_type_id is distinct from derived.activity_type_id;
