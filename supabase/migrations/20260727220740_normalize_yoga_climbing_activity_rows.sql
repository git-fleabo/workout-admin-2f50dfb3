-- Yoga and Climbing use activity-level duration and RPE, not strength-style
-- sets. This repair preserves an RPE-only set as an entry metric before
-- removing the redundant set row. The existing repair dispatcher remains the
-- sole browser-facing mutation boundary.

create or replace function app_private.delete_redundant_activity_set(
  p_entity_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_person_id uuid;
  v_target_person_id uuid;
  v_batch_id uuid;
  v_entry_id uuid;
  v_activity_name text;
  v_before jsonb;
  v_duration_minutes numeric;
  v_session_rpe numeric;
  v_set_rpe numeric;
  v_metric_rpe numeric;
  v_preserved_rpe numeric;
  v_metric_id uuid;
  v_metric_after jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in before repairing training data.'
      using errcode = '42501';
  end if;

  v_current_person_id := app_private.current_person_id();
  if v_current_person_id is null or not app_private.current_person_is_admin() then
    raise exception 'Only an approved training-data administrator can apply repairs.'
      using errcode = '42501';
  end if;

  select
    to_jsonb(set_row),
    session.person_id,
    entry.id,
    activity.name,
    session.rpe,
    set_row.rpe,
    coalesce(
      (
        select metric.metric_value
        from public.entry_metrics as metric
        where metric.session_entry_id = entry.id
          and metric.metric_key = 'duration_minutes'
          and metric.metric_value > 0
        order by metric.created_at, metric.id
        limit 1
      ),
      (
        select metric.metric_value * 60
        from public.entry_metrics as metric
        where metric.session_entry_id = entry.id
          and metric.metric_key = 'hours'
          and metric.metric_value > 0
        order by metric.created_at, metric.id
        limit 1
      ),
      session.duration_minutes
    ),
    (
      select metric.metric_value
      from public.entry_metrics as metric
      where metric.session_entry_id = entry.id
        and metric.metric_key = 'rpe'
        and metric.metric_value is not null
      order by metric.created_at, metric.id
      limit 1
    )
  into
    v_before,
    v_target_person_id,
    v_entry_id,
    v_activity_name,
    v_session_rpe,
    v_set_rpe,
    v_duration_minutes,
    v_metric_rpe
  from public.entry_sets as set_row
  join public.session_entries as entry on entry.id = set_row.session_entry_id
  join public.sessions as session on session.id = entry.session_id
  join public.activity_types as activity on activity.id = entry.activity_type_id
  where set_row.id = p_entity_id;

  if v_before is null then
    raise exception 'The set no longer exists.'
      using errcode = 'P0002';
  end if;
  if not app_private.person_is_accessible(v_target_person_id) then
    raise exception 'The target training record is not accessible.'
      using errcode = '42501';
  end if;
  if lower(btrim(v_activity_name)) not in ('climbing', 'yoga') then
    raise exception 'Only Yoga and Climbing activity rows can use this repair.'
      using errcode = '22023';
  end if;
  if
    (v_before->>'reps') is not null
    or (v_before->>'weight') is not null
    or (v_before->>'duration_seconds') is not null
    or (v_before->>'distance') is not null
    or (v_before->>'rest_seconds') is not null
    or nullif(btrim(v_before->>'rest_time'), '') is not null
    or nullif(btrim(v_before->>'assistance_type'), '') is not null
    or nullif(btrim(v_before->>'assistance_detail'), '') is not null
    or nullif(btrim(v_before->>'quality'), '') is not null
    or nullif(btrim(v_before->>'notes'), '') is not null
    or exists (
      select 1
      from public.entry_set_segments as segment
      where segment.entry_set_id = p_entity_id
    )
  then
    raise exception 'This set contains set-based training data and cannot be removed.'
      using errcode = '22023';
  end if;
  if v_duration_minutes is null or v_duration_minutes <= 0 then
    raise exception 'Record the activity duration before removing its redundant set.'
      using errcode = '22023';
  end if;
  if v_metric_rpe is not null and v_set_rpe is not null and v_metric_rpe <> v_set_rpe then
    raise exception 'The activity and set RPE values conflict. Review them before repairing.'
      using errcode = '22023';
  end if;

  v_preserved_rpe := coalesce(v_metric_rpe, v_set_rpe, v_session_rpe);
  if v_preserved_rpe is null or v_preserved_rpe < 1 or v_preserved_rpe > 10 then
    raise exception 'Record an RPE between 1 and 10 before removing the redundant set.'
      using errcode = '22023';
  end if;

  insert into public.data_quality_batches (
    person_id,
    batch_kind,
    status,
    notes,
    created_by
  )
  values (
    v_target_person_id,
    'interactive_repair',
    'planned',
    'Normalized a Yoga or Climbing activity to duration and RPE without sets',
    v_current_person_id
  )
  returning id into v_batch_id;

  insert into app_private.data_quality_snapshots (
    batch_id,
    entity_table,
    entity_id,
    row_value
  )
  values (
    v_batch_id,
    'entry_sets',
    p_entity_id::text,
    v_before
  );

  if v_metric_rpe is null then
    insert into public.entry_metrics (
      session_entry_id,
      metric_key,
      metric_value
    )
    values (
      v_entry_id,
      'rpe',
      v_preserved_rpe
    )
    returning id into v_metric_id;

    select to_jsonb(metric)
    into v_metric_after
    from public.entry_metrics as metric
    where metric.id = v_metric_id;

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
    values (
      v_batch_id,
      v_target_person_id,
      'entry_metrics',
      v_metric_id::text,
      'insert',
      null,
      v_metric_after,
      'Preserved activity RPE outside the redundant set row',
      null
    );
  end if;

  delete from public.entry_sets
  where id = p_entity_id;

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
  values (
    v_batch_id,
    v_target_person_id,
    'entry_sets',
    p_entity_id::text,
    'delete',
    v_before,
    null,
    'Removed a redundant set from a duration-and-RPE activity',
    v_before
  );

  update public.data_quality_batches
  set
    status = 'applied',
    applied_at = now(),
    applied_checksum = 'delete_redundant_activity_set:' || p_entity_id::text
  where id = v_batch_id;

  return jsonb_build_object(
    'ok', true,
    'batch_id', v_batch_id,
    'action', 'delete_redundant_activity_set',
    'entity_table', 'entry_sets',
    'entity_id', p_entity_id
  );
end
$$;

revoke all on function app_private.delete_redundant_activity_set(uuid)
  from public, anon, authenticated;
grant execute on function app_private.delete_redundant_activity_set(uuid)
  to authenticated;

create or replace function public.apply_data_quality_fix(
  p_action text,
  p_entity_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select case
    when p_action = 'delete_redundant_activity_set'
      then app_private.delete_redundant_activity_set(p_entity_id)
    else app_private.apply_data_quality_fix(
      p_action,
      p_entity_id,
      coalesce(p_payload, '{}'::jsonb)
    )
  end;
$$;

revoke all on function public.apply_data_quality_fix(text, uuid, jsonb)
  from public, anon;
grant execute on function public.apply_data_quality_fix(text, uuid, jsonb)
  to authenticated;
