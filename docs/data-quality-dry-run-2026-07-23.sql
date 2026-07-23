-- Training Admin data-quality audit
-- Project: dvcdghmcqqfvlbzufpyy
-- Captured: 2026-07-23
--
-- This script is intentionally read-only. It enumerates every row included by
-- the Phase 1 report without changing schema or data.

begin transaction read only;
set transaction isolation level repeatable read;

-- 1. Current baseline.
with completed_sessions as (
  select *
  from public.sessions
  where completed is true
),
completed_entries as (
  select entry.*
  from public.session_entries entry
  join completed_sessions session on session.id = entry.session_id
),
completed_sets as (
  select set_row.*
  from public.entry_sets set_row
  join completed_entries entry on entry.id = set_row.session_entry_id
),
completed_metrics as (
  select metric.*
  from public.entry_metrics metric
  join completed_entries entry on entry.id = metric.session_entry_id
),
entry_counts as (
  select session.id, count(entry.id) as entry_count
  from completed_sessions session
  left join completed_entries entry on entry.session_id = session.id
  group by session.id
)
select
  (select count(*) from completed_sessions) as completed_sessions,
  (select count(*) from completed_entries) as movement_entries,
  (select count(*) from completed_sets) as set_records,
  (select count(*) from completed_metrics) as metric_records,
  (select count(*) from completed_entries where exercise_id is null)
    as entries_without_exercise_id,
  (
    select count(*)
    from completed_entries entry
    where not exists (
      select 1 from completed_sets set_row where set_row.session_entry_id = entry.id
    )
      and not exists (
        select 1 from completed_metrics metric where metric.session_entry_id = entry.id
      )
  ) as entries_without_sets_or_metrics,
  (
    select count(*)
    from completed_sets
    where reps is null
      and weight is null
      and duration_seconds is null
      and distance is null
  ) as sets_without_performance_dose,
  (
    select count(*)
    from completed_sets
    where reps is null
      and weight is null
      and duration_seconds is null
      and distance is null
      and rpe is null
  ) as strictly_empty_sets,
  (select count(*) from completed_sets where reps > 12) as sets_reps_gt_12,
  (select count(*) from completed_sets where reps > 20) as sets_reps_gt_20,
  (select count(*) from completed_sets where rpe is not null) as sets_with_rpe,
  (select count(*) from public.exercises where is_active) as active_exercises,
  (select count(*) from public.person_exercises where is_enabled) as enabled_person_exercises,
  (
    select count(distinct exercise_id)
    from completed_entries
    where exercise_id is not null
  ) as canonical_exercises_used,
  (select count(*) from entry_counts where entry_count = 1) as single_entry_sessions,
  (select count(*) from entry_counts where entry_count > 1) as multi_entry_sessions;

-- 2. Every unlinked entry and its reviewed exact alias target.
-- Yoga intentionally has no automatic target because both Yoga Flow and Yoga
-- Class are plausible canonical records.
with reviewed_aliases(alias_name, canonical_exercise_id, confidence, reason) as (
  values
    ('Bouldering Session', 'fa01bd27-c611-4cb1-bb20-1b7c29221362'::uuid, 'high', 'exact canonical name and activity'),
    ('Ring Muscle-Up', '522bcd45-1ef1-439c-9d4b-cf8ba602fed1'::uuid, 'high', 'exact canonical name and activity'),
    ('Ropes/Belay', '6061af94-2718-454e-9289-e1af70bcdeeb'::uuid, 'high', 'exact canonical name and activity'),
    ('Pistol Squat', '6be86902-ae86-435d-9a54-7619f66a0eb8'::uuid, 'high', 'exact canonical name and activity'),
    ('Seated Dumbbell Shoulder Press', '751763a5-b77f-4a57-9f3a-e950ea07b3a8'::uuid, 'high', 'reviewed abbreviation alias'),
    ('Weighted Pull Ups', 'ee6235d3-a2d6-4df7-8984-f5ef474604d5'::uuid, 'high', 'reviewed spelling alias; distinct from Pull-Up'),
    ('Bouldering', 'fa01bd27-c611-4cb1-bb20-1b7c29221362'::uuid, 'high', 'reviewed historical session label'),
    ('Mix', '7fcf58a7-a394-42c8-98f1-75fc1e82412f'::uuid, 'high', 'exact canonical name and activity'),
    ('Yoga', null::uuid, 'manual', 'ambiguous between Yoga Flow and Yoga Class')
)
select
  entry.id as entry_id,
  session.id as session_id,
  session.session_date,
  session.source,
  session.source_sheet,
  session.source_row,
  entry.name as original_name,
  activity.name as entry_activity,
  alias.canonical_exercise_id as proposed_exercise_id,
  exercise.name as proposed_canonical_name,
  alias.confidence,
  alias.reason,
  (select count(*) from public.entry_sets set_row where set_row.session_entry_id = entry.id)
    as set_count,
  (select count(*) from public.entry_metrics metric where metric.session_entry_id = entry.id)
    as metric_count
from public.session_entries entry
join public.sessions session on session.id = entry.session_id
left join public.activity_types activity on activity.id = entry.activity_type_id
left join reviewed_aliases alias on lower(alias.alias_name) = lower(entry.name)
left join public.exercises exercise on exercise.id = alias.canonical_exercise_id
where session.completed
  and entry.exercise_id is null
order by session.session_date, session.source_sheet, session.source_row, entry.name;

-- 3. Every candidate aggregate row. A single physical row whose set_number is
-- greater than one currently overloads set_number as a historical set count.
with set_counts as (
  select entry.id as entry_id, count(set_row.id) as row_count
  from public.session_entries entry
  left join public.entry_sets set_row on set_row.session_entry_id = entry.id
  group by entry.id
)
select
  set_row.id as set_id,
  entry.id as entry_id,
  session.id as session_id,
  session.session_date,
  entry.name,
  set_row.set_number as proposed_aggregate_set_count,
  set_row.reps as total_reps,
  set_row.weight,
  set_row.duration_seconds,
  set_row.distance,
  set_row.rpe,
  session.source,
  session.source_sheet,
  session.source_row
from public.entry_sets set_row
join set_counts counts on counts.entry_id = set_row.session_entry_id
join public.session_entries entry on entry.id = set_row.session_entry_id
join public.sessions session on session.id = entry.session_id
where session.completed
  and counts.row_count = 1
  and set_row.set_number > 1
order by session.session_date, entry.name, set_row.id;

-- 4. Every set with no recorded performance dose. RPE-only rows are retained
-- and identified separately from strictly empty rows.
select
  set_row.id as set_id,
  entry.id as entry_id,
  session.id as session_id,
  session.session_date,
  entry.name,
  activity.name as entry_activity,
  set_row.set_number,
  set_row.rpe,
  set_row.distance_unit,
  case
    when set_row.rpe is not null then 'rpe_only'
    when nullif(btrim(coalesce(set_row.distance_unit, '')), '') is not null then 'unit_only'
    else 'strictly_empty'
  end as quality_issue
from public.entry_sets set_row
join public.session_entries entry on entry.id = set_row.session_entry_id
join public.sessions session on session.id = entry.session_id
left join public.activity_types activity on activity.id = entry.activity_type_id
where session.completed
  and set_row.reps is null
  and set_row.weight is null
  and set_row.duration_seconds is null
  and set_row.distance is null
order by session.session_date, entry.name, set_row.set_number;

-- 5. Every suspicious high-repetition row. All 27 rows are also returned by
-- the aggregate-candidate query; no individual breakdown is inferred.
select
  set_row.id as set_id,
  entry.id as entry_id,
  session.id as session_id,
  session.session_date,
  entry.name,
  set_row.set_number,
  set_row.reps,
  set_row.weight,
  set_row.rpe,
  session.source,
  session.source_sheet,
  session.source_row
from public.entry_sets set_row
join public.session_entries entry on entry.id = set_row.session_entry_id
join public.sessions session on session.id = entry.session_id
where session.completed
  and set_row.reps > 12
order by set_row.reps desc, session.session_date, entry.name;

-- 6. Entries that contain neither sets nor metrics.
select
  entry.id as entry_id,
  session.id as session_id,
  session.session_date,
  entry.name,
  activity.name as entry_activity,
  session.source,
  session.source_sheet,
  session.source_row
from public.session_entries entry
join public.sessions session on session.id = entry.session_id
left join public.activity_types activity on activity.id = entry.activity_type_id
where session.completed
  and not exists (
    select 1 from public.entry_sets set_row where set_row.session_entry_id = entry.id
  )
  and not exists (
    select 1 from public.entry_metrics metric where metric.session_entry_id = entry.id
  )
order by session.session_date, entry.name;

-- 7. Missing duration/RPE prompts. These are quality prompts, not automatic
-- backfill candidates.
select
  id as session_id,
  session_date,
  title,
  source,
  source_sheet,
  source_row,
  duration_minutes,
  rpe
from public.sessions
where completed
  and (duration_minutes is null or rpe is null)
order by session_date, id;

-- 8. Null parent activity, separated into valid mixed sessions and
-- single-activity derivation candidates.
select
  session.id as session_id,
  session.session_date,
  session.title,
  count(distinct entry.activity_type_id) as entry_activity_count,
  string_agg(distinct activity.name, ', ' order by activity.name) as entry_activities,
  case
    when count(distinct entry.activity_type_id) = 1 then 'derive_parent_candidate'
    else 'valid_mixed_session'
  end as classification
from public.sessions session
join public.session_entries entry on entry.session_id = session.id
left join public.activity_types activity on activity.id = entry.activity_type_id
where session.completed
  and session.activity_type_id is null
group by session.id
order by session.session_date, session.id;

-- 9. Native records still carrying spreadsheet labels.
select
  'sessions' as entity,
  session.id as row_id,
  session.session_date as record_date,
  session.source_sheet,
  session.source_row
from public.sessions session
where session.source = 'manual'
  and (session.source_sheet is not null or session.source_row is not null)
union all
select
  'session_entries',
  entry.id,
  session.session_date,
  entry.source_sheet,
  entry.source_row
from public.session_entries entry
join public.sessions session on session.id = entry.session_id
where session.source = 'manual'
  and (entry.source_sheet is not null or entry.source_row is not null)
order by entity, record_date, row_id;

-- 10. Ambiguous dumbbell/implement load semantics.
select
  session.session_date,
  entry.id as entry_id,
  entry.name,
  set_row.id as set_id,
  set_row.set_number,
  set_row.reps,
  set_row.weight,
  coalesce(exercise.equipment, 'orphan') as catalogue_equipment,
  session.source,
  session.source_row
from public.entry_sets set_row
join public.session_entries entry on entry.id = set_row.session_entry_id
join public.sessions session on session.id = entry.session_id
left join public.exercises exercise on exercise.id = entry.exercise_id
where session.completed
  and set_row.weight is not null
  and (
    coalesce(exercise.equipment, '') ilike '%dumbbell%'
    or entry.name ilike '%dumbbell%'
    or entry.name ilike '% db %'
  )
order by session.session_date, entry.name, set_row.set_number;

-- 11. Added-bodyweight candidates. These are high-confidence load-semantics
-- classifications, but the numeric values are not reinterpreted.
select
  session.session_date,
  entry.id as entry_id,
  entry.name,
  set_row.id as set_id,
  set_row.set_number,
  set_row.reps,
  set_row.weight,
  session.source,
  session.source_row
from public.entry_sets set_row
join public.session_entries entry on entry.id = set_row.session_entry_id
join public.sessions session on session.id = entry.session_id
where session.completed
  and lower(entry.name) in ('weighted pull ups', 'weighted pull-up')
order by session.session_date, entry.name;

-- 12. Same-day compatible single-entry groups. "High" is deliberately strict:
-- contiguous imported Workout Log rows, or native rows created within 15
-- minutes, with no recorded duration and no standalone recovery/climbing type.
with singles as (
  select
    session.id,
    session.person_id,
    session.session_date,
    session.source,
    session.source_sheet,
    session.source_row,
    session.created_at,
    session.training_location_id,
    session.duration_minutes,
    session.rpe,
    session.notes,
    (array_agg(entry.name order by entry.order_index))[1] as entry_name,
    (array_agg(activity.name order by entry.order_index))[1] as activity_name,
    count(entry.id) as entry_count
  from public.sessions session
  join public.session_entries entry on entry.session_id = session.id
  left join public.activity_types activity on activity.id = entry.activity_type_id
  where session.completed
  group by session.id
),
compatible as (
  select *
  from singles
  where entry_count = 1
    and activity_name in ('Strength', 'Skills/Calisthenics', 'Grip', 'Conditioning', 'Other')
),
candidate_groups as (
  select
    person_id,
    session_date,
    source,
    source_sheet,
    count(*) as session_count,
    min(source_row) as min_row,
    max(source_row) as max_row,
    min(created_at) as first_created,
    max(created_at) as last_created,
    count(distinct training_location_id)
      filter (where training_location_id is not null) as location_count,
    count(*) filter (where duration_minutes is not null) as duration_count,
    jsonb_agg(
      jsonb_build_object(
        'session_id', id,
        'source_row', source_row,
        'entry', entry_name,
        'activity', activity_name,
        'created_at', created_at,
        'duration_minutes', duration_minutes,
        'rpe', rpe,
        'notes', notes
      )
      order by source_row, created_at
    ) as rows
  from compatible
  group by person_id, session_date, source, source_sheet
  having count(*) > 1
)
select
  session_date,
  source,
  source_sheet,
  session_count,
  case
    when source = 'google_sheets_import'
      and source_sheet = 'Workout Log'
      and min_row is not null
      and max_row - min_row = session_count - 1
      and location_count <= 1
      and duration_count = 0
      then 'high'
    when source = 'manual'
      and source_sheet = 'Workout Log'
      and extract(epoch from (last_created - first_created)) <= 900
      and location_count <= 1
      and duration_count = 0
      then 'high'
    else 'ambiguous'
  end as confidence,
  rows
from candidate_groups
order by session_date, source_sheet;

-- 13. Active canonical names that collide after punctuation/case
-- normalization. The current result is empty.
with normalized as (
  select
    id,
    name,
    activity_type_id,
    regexp_replace(lower(name), '[^a-z0-9]+', '', 'g') as normalized_name
  from public.exercises
  where is_active
)
select
  normalized_name,
  count(*) as candidate_count,
  jsonb_agg(
    jsonb_build_object('exercise_id', id, 'name', name, 'activity_type_id', activity_type_id)
    order by name
  ) as candidates
from normalized
group by normalized_name
having count(*) > 1
order by normalized_name;

rollback;
