create index if not exists data_quality_audit_events_person_idx
  on public.data_quality_audit_events (person_id);

create index if not exists data_quality_batches_created_by_idx
  on public.data_quality_batches (created_by)
  where created_by is not null;

create index if not exists exercise_aliases_activity_type_idx
  on public.exercise_aliases (activity_type_id)
  where activity_type_id is not null;

create index if not exists exercise_aliases_reviewed_by_idx
  on public.exercise_aliases (reviewed_by)
  where reviewed_by is not null;
