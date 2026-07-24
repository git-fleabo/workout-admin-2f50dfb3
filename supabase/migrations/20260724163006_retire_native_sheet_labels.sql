-- Native rows are Supabase-owned. Retire stale transport labels while keeping
-- imported provenance and the private pre-cleanup snapshot untouched.

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
  'update',
  to_jsonb(session),
  to_jsonb(session) || jsonb_build_object('source_sheet', null, 'source_row', null),
  'Retired a stale Google Sheets label from a native Supabase session',
  to_jsonb(session)
from public.sessions session
join public.data_quality_batches batch
  on batch.person_id = session.person_id
  and batch.approved_checksum = 'workout-history-cleanup-v1-2026-07-24'
where session.source = 'manual'
  and session.source_sheet is not null
  and session.source_row is null;

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
  to_jsonb(entry) || jsonb_build_object('source_sheet', null, 'source_row', null),
  'Retired a stale Google Sheets label from a native Supabase movement',
  to_jsonb(entry)
from public.session_entries entry
join public.sessions session on session.id = entry.session_id
join public.data_quality_batches batch
  on batch.person_id = session.person_id
  and batch.approved_checksum = 'workout-history-cleanup-v1-2026-07-24'
where session.source = 'manual'
  and entry.source_sheet is not null
  and entry.source_row is null;

update public.session_entries entry
set
  source_sheet = null,
  source_row = null,
  updated_at = now()
from public.sessions session
where session.id = entry.session_id
  and session.source = 'manual'
  and entry.source_sheet is not null
  and entry.source_row is null;

update public.sessions
set
  source_sheet = null,
  source_row = null,
  updated_at = now()
where source = 'manual'
  and source_sheet is not null
  and source_row is null;
