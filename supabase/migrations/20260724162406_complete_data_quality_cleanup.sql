-- Approved data-quality cleanup.
-- The immutable private snapshots created first are the rollback source.

create table if not exists app_private.data_quality_snapshots (
  batch_id uuid not null references public.data_quality_batches(id) on delete restrict,
  entity_table text not null,
  entity_id text not null,
  row_value jsonb not null,
  captured_at timestamptz not null default now(),
  primary key (batch_id, entity_table, entity_id)
);

revoke all on table app_private.data_quality_snapshots from public, anon, authenticated;

create unique index if not exists data_quality_batches_person_checksum_uidx
  on public.data_quality_batches (person_id, approved_checksum)
  where approved_checksum is not null;

insert into public.data_quality_batches (
  person_id,
  batch_kind,
  status,
  approved_checksum,
  notes
)
select distinct
  session.person_id,
  'historical_workout_normalisation',
  'planned',
  'workout-history-cleanup-v1-2026-07-24',
  'Approved cleanup after the 2026-07-23 dry run. Private snapshots are the rollback source.'
from public.sessions session
on conflict (person_id, approved_checksum) where approved_checksum is not null
do nothing;

insert into app_private.data_quality_snapshots (batch_id, entity_table, entity_id, row_value)
select batch.id, 'sessions', session.id::text, to_jsonb(session)
from public.data_quality_batches batch
join public.sessions session on session.person_id = batch.person_id
where batch.approved_checksum = 'workout-history-cleanup-v1-2026-07-24'
on conflict do nothing;

insert into app_private.data_quality_snapshots (batch_id, entity_table, entity_id, row_value)
select batch.id, 'session_entries', entry.id::text, to_jsonb(entry)
from public.data_quality_batches batch
join public.sessions session on session.person_id = batch.person_id
join public.session_entries entry on entry.session_id = session.id
where batch.approved_checksum = 'workout-history-cleanup-v1-2026-07-24'
on conflict do nothing;

insert into app_private.data_quality_snapshots (batch_id, entity_table, entity_id, row_value)
select batch.id, 'entry_sets', set_row.id::text, to_jsonb(set_row)
from public.data_quality_batches batch
join public.sessions session on session.person_id = batch.person_id
join public.session_entries entry on entry.session_id = session.id
join public.entry_sets set_row on set_row.session_entry_id = entry.id
where batch.approved_checksum = 'workout-history-cleanup-v1-2026-07-24'
on conflict do nothing;

insert into app_private.data_quality_snapshots (batch_id, entity_table, entity_id, row_value)
select batch.id, 'entry_metrics', metric.id::text, to_jsonb(metric)
from public.data_quality_batches batch
join public.sessions session on session.person_id = batch.person_id
join public.session_entries entry on entry.session_id = session.id
join public.entry_metrics metric on metric.session_entry_id = entry.id
where batch.approved_checksum = 'workout-history-cleanup-v1-2026-07-24'
on conflict do nothing;

insert into app_private.data_quality_snapshots (batch_id, entity_table, entity_id, row_value)
select batch.id, 'goals', goal.id::text, to_jsonb(goal)
from public.data_quality_batches batch
join public.goals goal on goal.person_id = batch.person_id
where batch.approved_checksum = 'workout-history-cleanup-v1-2026-07-24'
on conflict do nothing;

insert into app_private.data_quality_snapshots (batch_id, entity_table, entity_id, row_value)
select batch.id, 'one_rm_tests', test.id::text, to_jsonb(test)
from public.data_quality_batches batch
join public.one_rm_tests test on test.person_id = batch.person_id
where batch.approved_checksum = 'workout-history-cleanup-v1-2026-07-24'
on conflict do nothing;

insert into app_private.data_quality_snapshots (batch_id, entity_table, entity_id, row_value)
select batch.id, 'exercises', exercise.id::text, to_jsonb(exercise)
from public.data_quality_batches batch
cross join public.exercises exercise
where batch.approved_checksum = 'workout-history-cleanup-v1-2026-07-24'
on conflict do nothing;

-- Use one canonical climbing model and one canonical mobility model.
update public.exercises
set
  name = 'Seated Dumbbell Shoulder Press',
  updated_at = now()
where id = '751763a5-b77f-4a57-9f3a-e950ea07b3a8'
  and name is distinct from 'Seated Dumbbell Shoulder Press';

update public.exercises
set
  activity_type_id = (
    select id from public.activity_types where name = 'Strength'
  ),
  updated_at = now()
where id = '112e9964-4792-45d5-a427-e02ba3073788'
  and activity_type_id is distinct from (
    select id from public.activity_types where name = 'Strength'
  );

insert into public.exercise_aliases (
  alias_name,
  exercise_id,
  status,
  reason
)
select alias_name, exercise_id, 'reviewed', 'Approved exact historical spelling mapping'
from (
  values
    ('Seated DB Shoulder Press', '751763a5-b77f-4a57-9f3a-e950ea07b3a8'::uuid),
    ('Weighted Pull Ups', 'ee6235d3-a2d6-4df7-8984-f5ef474604d5'::uuid),
    ('Pull Ups', '63a0e18a-6b4f-4d19-9f63-242679d91974'::uuid),
    ('Bouldering', 'fa01bd27-c611-4cb1-bb20-1b7c29221362'::uuid)
) as mapping(alias_name, exercise_id)
where not exists (
  select 1
  from public.exercise_aliases existing
  where existing.normalized_alias =
    regexp_replace(lower(btrim(mapping.alias_name)), '[^a-z0-9]+', '', 'g')
    and existing.activity_type_id is null
    and existing.status = 'reviewed'
);

-- Audit and resolve only reviewed exact aliases. The original imported name is
-- retained in before_value and the immutable private snapshot.
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
    'exercise_id', alias.exercise_id,
    'activity_type_id', exercise.activity_type_id,
    'name', exercise.name
  ),
  'Resolved an approved exact exercise alias',
  to_jsonb(entry)
from public.session_entries entry
join public.sessions session on session.id = entry.session_id
join public.data_quality_batches batch
  on batch.person_id = session.person_id
  and batch.approved_checksum = 'workout-history-cleanup-v1-2026-07-24'
join public.exercise_aliases alias
  on alias.normalized_alias =
    regexp_replace(lower(btrim(entry.name)), '[^a-z0-9]+', '', 'g')
  and alias.activity_type_id is null
  and alias.status = 'reviewed'
join public.exercises exercise on exercise.id = alias.exercise_id
where entry.exercise_id is distinct from alias.exercise_id
   or entry.activity_type_id is distinct from exercise.activity_type_id
   or entry.name is distinct from exercise.name;

update public.session_entries entry
set
  exercise_id = alias.exercise_id,
  activity_type_id = exercise.activity_type_id,
  name = exercise.name,
  updated_at = now()
from public.exercise_aliases alias
join public.exercises exercise on exercise.id = alias.exercise_id
where alias.normalized_alias =
    regexp_replace(lower(btrim(entry.name)), '[^a-z0-9]+', '', 'g')
  and alias.activity_type_id is null
  and alias.status = 'reviewed'
  and (
    entry.exercise_id is distinct from alias.exercise_id
    or entry.activity_type_id is distinct from exercise.activity_type_id
    or entry.name is distinct from exercise.name
  );

-- Existing linked entries inherit the reviewed canonical activity. This fixes
-- Strength/Other, Bouldering/Climbing and Stretching/Mobility mismatches.
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
  to_jsonb(entry) || jsonb_build_object('activity_type_id', exercise.activity_type_id),
  'Inherited activity type from the linked canonical exercise',
  to_jsonb(entry)
from public.session_entries entry
join public.sessions session on session.id = entry.session_id
join public.data_quality_batches batch
  on batch.person_id = session.person_id
  and batch.approved_checksum = 'workout-history-cleanup-v1-2026-07-24'
join public.exercises exercise on exercise.id = entry.exercise_id
where entry.activity_type_id is distinct from exercise.activity_type_id;

update public.session_entries entry
set
  activity_type_id = exercise.activity_type_id,
  updated_at = now()
from public.exercises exercise
where exercise.id = entry.exercise_id
  and entry.activity_type_id is distinct from exercise.activity_type_id;

-- Explicitly classify the historical one-row/multi-set import shape. Never
-- synthesize individual sets or divide total repetitions.
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
    'data_shape', 'aggregate',
    'aggregate_set_count', set_row.set_number,
    'set_number', 1
  ),
  'Marked a reviewed one-row historical total as aggregate data',
  to_jsonb(set_row)
from public.entry_sets set_row
join public.session_entries entry on entry.id = set_row.session_entry_id
join public.sessions session on session.id = entry.session_id
join public.data_quality_batches batch
  on batch.person_id = session.person_id
  and batch.approved_checksum = 'workout-history-cleanup-v1-2026-07-24'
where set_row.set_number > 1
  and (
    set_row.reps is not null
    or set_row.weight is not null
    or set_row.duration_seconds is not null
    or set_row.distance is not null
  )
  and not exists (
    select 1
    from public.entry_sets sibling
    where sibling.session_entry_id = set_row.session_entry_id
      and sibling.id <> set_row.id
  );

update public.entry_sets set_row
set
  data_shape = 'aggregate',
  aggregate_set_count = set_row.set_number,
  set_number = 1
where set_row.set_number > 1
  and (
    set_row.reps is not null
    or set_row.weight is not null
    or set_row.duration_seconds is not null
    or set_row.distance is not null
  )
  and not exists (
    select 1
    from public.entry_sets sibling
    where sibling.session_entry_id = set_row.session_entry_id
      and sibling.id <> set_row.id
  );

update public.entry_sets set_row
set
  data_shape = 'individual',
  aggregate_set_count = null
where data_shape = 'unknown'
  and (
    set_number = 1
    or exists (
      select 1
      from public.entry_sets sibling
      where sibling.session_entry_id = set_row.session_entry_id
        and sibling.id <> set_row.id
    )
  );

update public.entry_sets set_row
set
  load_semantics = case
    when set_row.weight is null or set_row.weight <= 0 then 'none'
    when lower(entry.name) = 'weighted pull-up' then 'added_bodyweight_load'
    when coalesce(exercise.equipment, '') ilike '%dumbbell%' then 'unknown'
    when coalesce(exercise.equipment, '') ilike '%barbell%'
      or coalesce(exercise.equipment, '') ilike '%machine%'
      then 'total_external_load'
    else 'unknown'
  end,
  volume_status = case
    when set_row.weight is null or set_row.weight <= 0 then 'not_applicable'
    when lower(entry.name) = 'weighted pull-up' then 'exact'
    when coalesce(exercise.equipment, '') ilike '%dumbbell%' then 'ambiguous'
    when coalesce(exercise.equipment, '') ilike '%barbell%'
      or coalesce(exercise.equipment, '') ilike '%machine%'
      then 'exact'
    else 'ambiguous'
  end,
  implement_count = null
from public.session_entries entry
left join public.exercises exercise on exercise.id = entry.exercise_id
where entry.id = set_row.session_entry_id;

-- Materialise the exact high-confidence grouping rule from the reviewed dry
-- run. Standalone climbing, yoga, class and mobility work never enters it.
create temporary table _dq_group_members (
  session_id uuid primary key,
  target_session_id uuid not null
) on commit drop;

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
groups as (
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
    count(*) filter (where duration_minutes is not null) as duration_count
  from compatible
  group by person_id, session_date, source, source_sheet
  having count(*) > 1
),
approved_groups as (
  select *
  from groups
  where (
    source = 'google_sheets_import'
    and source_sheet = 'Workout Log'
    and min_row is not null
    and max_row - min_row = session_count - 1
    and location_count <= 1
    and duration_count = 0
  ) or (
    source = 'manual'
    and source_sheet = 'Workout Log'
    and extract(epoch from (last_created - first_created)) <= 900
    and location_count <= 1
    and duration_count = 0
  )
),
members as (
  select
    compatible.*,
    first_value(compatible.id) over (
      partition by
        compatible.person_id,
        compatible.session_date,
        compatible.source,
        compatible.source_sheet
      order by compatible.source_row nulls last, compatible.created_at, compatible.id
    ) as target_session_id
  from compatible
  join approved_groups using (person_id, session_date, source, source_sheet)
)
insert into _dq_group_members (session_id, target_session_id)
select id, target_session_id
from members;

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
  'sessions',
  session.id::text,
  case when member.session_id = member.target_session_id then 'update' else 'move' end,
  to_jsonb(session),
  jsonb_build_object('target_session_id', member.target_session_id),
  'Consolidated a reviewed high-confidence same-workout group',
  to_jsonb(session)
from _dq_group_members member
join public.sessions session on session.id = member.session_id
join public.data_quality_batches batch
  on batch.person_id = session.person_id
  and batch.approved_checksum = 'workout-history-cleanup-v1-2026-07-24';

update public.session_entries entry
set session_id = member.target_session_id
from _dq_group_members member
where entry.session_id = member.session_id
  and member.session_id <> member.target_session_id;

with ordered as (
  select
    entry.id,
    row_number() over (
      partition by entry.session_id
      order by
        coalesce(entry.source_row, 2147483647),
        entry.created_at,
        entry.order_index,
        entry.id
    ) - 1 as next_order
  from public.session_entries entry
  where entry.session_id in (
    select distinct target_session_id from _dq_group_members
  )
)
update public.session_entries entry
set order_index = ordered.next_order
from ordered
where entry.id = ordered.id;

with rollup as (
  select
    member.target_session_id,
    max(session.rpe) as merged_rpe,
    string_agg(distinct nullif(btrim(session.notes), ''), E'\n')
      filter (where nullif(btrim(session.notes), '') is not null) as merged_notes,
    string_agg(distinct session.rpe::text, ', ' order by session.rpe::text)
      filter (where session.rpe is not null) as source_rpes
  from _dq_group_members member
  join public.sessions session on session.id = member.session_id
  group by member.target_session_id
)
update public.sessions target
set
  rpe = rollup.merged_rpe,
  notes = concat_ws(
    E'\n',
    rollup.merged_notes,
    case
      when rollup.source_rpes is not null
        then 'Historical merged session RPE values: ' || rollup.source_rpes
    end
  ),
  title = 'Workout',
  updated_at = now()
from rollup
where target.id = rollup.target_session_id;

delete from public.sessions session
using _dq_group_members member
where session.id = member.session_id
  and member.session_id <> member.target_session_id;

-- Derive every completed parent activity. Mixed sessions use an explicit
-- category rather than an uncategorised null.
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

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.sessions'::regclass
      and conname = 'sessions_completed_activity_present'
  ) then
    alter table public.sessions
      add constraint sessions_completed_activity_present
      check (not completed or activity_type_id is not null) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.entry_sets'::regclass
      and conname = 'entry_sets_set_number_positive'
  ) then
    alter table public.entry_sets
      add constraint entry_sets_set_number_positive
      check (set_number > 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.entry_sets'::regclass
      and conname = 'entry_sets_nonnegative_values'
  ) then
    alter table public.entry_sets
      add constraint entry_sets_nonnegative_values
      check (
        coalesce(reps, 0) >= 0
        and coalesce(weight, 0) >= 0
        and coalesce(duration_seconds, 0) >= 0
        and coalesce(distance, 0) >= 0
      ) not valid;
  end if;
end
$$;

alter table public.sessions
  validate constraint sessions_completed_activity_present;
alter table public.entry_sets
  validate constraint entry_sets_set_number_positive;
alter table public.entry_sets
  validate constraint entry_sets_nonnegative_values;

create unique index if not exists entry_sets_entry_set_number_uidx
  on public.entry_sets (session_entry_id, set_number);

alter table public.entry_sets
  alter column data_shape set default 'individual';

update public.data_quality_batches
set
  status = 'applied',
  applied_checksum = approved_checksum,
  applied_at = coalesce(applied_at, now())
where approved_checksum = 'workout-history-cleanup-v1-2026-07-24'
  and status <> 'reversed';
