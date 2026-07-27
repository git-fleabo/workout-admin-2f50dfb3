-- Guarded, audited repairs for the Data Quality workspace.
--
-- The browser can call only the public SECURITY INVOKER wrapper. The write
-- implementation stays in the non-exposed app_private schema, verifies the
-- signed-in admin and managed person, snapshots the target row, applies one
-- whitelisted repair, and records an immutable audit event in one transaction.

create or replace function app_private.apply_data_quality_fix(
  p_action text,
  p_entity_id uuid,
  p_payload jsonb default '{}'::jsonb
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
  v_entity_table text;
  v_before jsonb;
  v_after jsonb;
  v_reason text;
  v_audit_action text := 'update';
  v_exercise_id uuid;
  v_exercise_name text;
  v_activity_type_id uuid;
  v_session_id uuid;
  v_session_before jsonb;
  v_session_after jsonb;
  v_duration_minutes numeric;
  v_rpe numeric;
  v_load_semantics text;
  v_volume_status text;
  v_implement_count integer;
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

  p_payload := coalesce(p_payload, '{}'::jsonb);

  if p_action = 'link_exercise' then
    v_entity_table := 'session_entries';
    v_reason := 'Linked an unlinked movement to a reviewed canonical exercise';
    v_exercise_id := nullif(p_payload->>'exercise_id', '')::uuid;

    select to_jsonb(entry), session.person_id, session.id
    into v_before, v_target_person_id, v_session_id
    from public.session_entries as entry
    join public.sessions as session on session.id = entry.session_id
    where entry.id = p_entity_id;

    if v_before is null then
      raise exception 'The movement entry no longer exists.'
        using errcode = 'P0002';
    end if;
    if v_before->>'exercise_id' is not null then
      raise exception 'This movement is already linked to an exercise.'
        using errcode = '22023';
    end if;

    select exercise.name, exercise.activity_type_id
    into v_exercise_name, v_activity_type_id
    from public.exercises as exercise
    where exercise.id = v_exercise_id
      and exercise.is_active;

    if v_exercise_name is null or v_activity_type_id is null then
      raise exception 'Choose an active exercise with a valid activity type.'
        using errcode = '22023';
    end if;
  elsif p_action = 'update_session_metadata' then
    v_entity_table := 'sessions';
    v_reason := 'Entered reviewed session duration or final RPE';

    select to_jsonb(session), session.person_id
    into v_before, v_target_person_id
    from public.sessions as session
    where session.id = p_entity_id;

    if v_before is null then
      raise exception 'The workout no longer exists.'
        using errcode = 'P0002';
    end if;

    v_duration_minutes := nullif(p_payload->>'duration_minutes', '')::numeric;
    v_rpe := nullif(p_payload->>'rpe', '')::numeric;
    if v_duration_minutes is null and v_rpe is null then
      raise exception 'Enter a duration or final RPE.'
        using errcode = '22023';
    end if;
    if v_duration_minutes is not null
      and (v_duration_minutes <= 0 or v_duration_minutes > 1440)
    then
      raise exception 'Duration must be between 1 and 1440 minutes.'
        using errcode = '22023';
    end if;
    if v_rpe is not null and (v_rpe < 1 or v_rpe > 10) then
      raise exception 'Final RPE must be between 1 and 10.'
        using errcode = '22023';
    end if;
  elsif p_action = 'classify_load' then
    v_entity_table := 'entry_sets';
    v_reason := 'Recorded reviewed load semantics for an ambiguous set';
    v_load_semantics := nullif(p_payload->>'load_semantics', '');
    v_implement_count := nullif(p_payload->>'implement_count', '')::integer;

    select to_jsonb(set_row), session.person_id
    into v_before, v_target_person_id
    from public.entry_sets as set_row
    join public.session_entries as entry on entry.id = set_row.session_entry_id
    join public.sessions as session on session.id = entry.session_id
    where set_row.id = p_entity_id;

    if v_before is null then
      raise exception 'The set no longer exists.'
        using errcode = 'P0002';
    end if;
    if (v_before->>'weight') is null or (v_before->>'weight')::numeric <= 0 then
      raise exception 'Only a positive recorded load can be classified.'
        using errcode = '22023';
    end if;
    if v_load_semantics not in (
      'total_external_load',
      'per_implement_load',
      'combined_implement_load',
      'added_bodyweight_load',
      'assistance',
      'bodyweight_contribution'
    ) then
      raise exception 'Choose an explicit load meaning.'
        using errcode = '22023';
    end if;
    if v_load_semantics = 'per_implement_load' then
      if v_implement_count is null or v_implement_count <= 0 or v_implement_count > 10 then
        raise exception 'Enter how many implements contributed to the load.'
          using errcode = '22023';
      end if;
    else
      v_implement_count := null;
    end if;
    v_volume_status := case
      when v_load_semantics = 'assistance' then 'not_applicable'
      else 'exact'
    end;
  elsif p_action = 'clear_session_provenance' then
    v_entity_table := 'sessions';
    v_reason := 'Cleared retired spreadsheet fields from a native session';

    select to_jsonb(session), session.person_id
    into v_before, v_target_person_id
    from public.sessions as session
    where session.id = p_entity_id
      and session.source = 'manual'
      and (session.source_sheet is not null or session.source_row is not null);

    if v_before is null then
      raise exception 'The native workout no longer exists.'
        using errcode = 'P0002';
    end if;
  elsif p_action = 'clear_entry_provenance' then
    v_entity_table := 'session_entries';
    v_reason := 'Cleared retired spreadsheet fields from a native movement';

    select to_jsonb(entry), session.person_id
    into v_before, v_target_person_id
    from public.session_entries as entry
    join public.sessions as session on session.id = entry.session_id
    where entry.id = p_entity_id
      and session.source = 'manual'
      and (entry.source_sheet is not null or entry.source_row is not null);

    if v_before is null then
      raise exception 'The native movement no longer exists.'
        using errcode = 'P0002';
    end if;
  elsif p_action = 'delete_empty_set' then
    v_entity_table := 'entry_sets';
    v_reason := 'Removed a reviewed set row with no recorded training data';
    v_audit_action := 'delete';

    select to_jsonb(set_row), session.person_id
    into v_before, v_target_person_id
    from public.entry_sets as set_row
    join public.session_entries as entry on entry.id = set_row.session_entry_id
    join public.sessions as session on session.id = entry.session_id
    where set_row.id = p_entity_id
      and set_row.reps is null
      and set_row.weight is null
      and set_row.duration_seconds is null
      and set_row.distance is null
      and set_row.rpe is null
      and set_row.rest_seconds is null
      and nullif(btrim(set_row.rest_time), '') is null
      and nullif(btrim(set_row.assistance_type), '') is null
      and nullif(btrim(set_row.assistance_detail), '') is null
      and nullif(btrim(set_row.quality), '') is null
      and nullif(btrim(set_row.notes), '') is null
      and not exists (
        select 1
        from public.entry_set_segments as segment
        where segment.entry_set_id = set_row.id
      );

    if v_before is null then
      raise exception 'This set contains recorded information and cannot be removed as empty.'
        using errcode = '22023';
    end if;
  else
    raise exception 'Unsupported data-quality repair action.'
      using errcode = '22023';
  end if;

  if not app_private.person_is_accessible(v_target_person_id) then
    raise exception 'The target training record is not accessible.'
      using errcode = '42501';
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
    v_reason,
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
    v_entity_table,
    p_entity_id::text,
    v_before
  );

  if p_action = 'link_exercise' then
    if (select count(*) from public.session_entries where session_id = v_session_id) = 1 then
      select to_jsonb(session)
      into v_session_before
      from public.sessions as session
      where session.id = v_session_id;

      insert into app_private.data_quality_snapshots (
        batch_id,
        entity_table,
        entity_id,
        row_value
      )
      values (
        v_batch_id,
        'sessions',
        v_session_id::text,
        v_session_before
      );
    end if;

    update public.session_entries
    set
      exercise_id = v_exercise_id,
      activity_type_id = v_activity_type_id,
      name = v_exercise_name
    where id = p_entity_id;

    if v_session_before is not null then
      update public.sessions
      set activity_type_id = v_activity_type_id
      where id = v_session_id;
    end if;
  elsif p_action = 'update_session_metadata' then
    update public.sessions
    set
      duration_minutes = coalesce(v_duration_minutes, duration_minutes),
      rpe = coalesce(v_rpe, rpe)
    where id = p_entity_id;
  elsif p_action = 'classify_load' then
    update public.entry_sets
    set
      load_semantics = v_load_semantics,
      volume_status = v_volume_status,
      implement_count = v_implement_count
    where id = p_entity_id;
  elsif p_action = 'clear_session_provenance' then
    update public.sessions
    set source_sheet = null, source_row = null
    where id = p_entity_id;
  elsif p_action = 'clear_entry_provenance' then
    update public.session_entries
    set source_sheet = null, source_row = null
    where id = p_entity_id;
  elsif p_action = 'delete_empty_set' then
    delete from public.entry_sets
    where id = p_entity_id;
  end if;

  if v_audit_action = 'delete' then
    v_after := null;
  elsif v_entity_table = 'sessions' then
    select to_jsonb(session)
    into v_after
    from public.sessions as session
    where session.id = p_entity_id;
  elsif v_entity_table = 'session_entries' then
    select to_jsonb(entry)
    into v_after
    from public.session_entries as entry
    where entry.id = p_entity_id;
  else
    select to_jsonb(set_row)
    into v_after
    from public.entry_sets as set_row
    where set_row.id = p_entity_id;
  end if;

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
    v_entity_table,
    p_entity_id::text,
    v_audit_action,
    v_before,
    v_after,
    v_reason,
    v_before
  );

  if v_session_before is not null then
    select to_jsonb(session)
    into v_session_after
    from public.sessions as session
    where session.id = v_session_id;

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
      'sessions',
      v_session_id::text,
      'update',
      v_session_before,
      v_session_after,
      'Kept a single-movement session activity aligned with its linked exercise',
      v_session_before
    );
  end if;

  update public.data_quality_batches
  set
    status = 'applied',
    applied_at = now(),
    applied_checksum = p_action || ':' || p_entity_id::text
  where id = v_batch_id;

  return jsonb_build_object(
    'ok', true,
    'batch_id', v_batch_id,
    'action', p_action,
    'entity_table', v_entity_table,
    'entity_id', p_entity_id
  );
end
$$;

revoke all on function app_private.apply_data_quality_fix(text, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function app_private.apply_data_quality_fix(text, uuid, jsonb)
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
  select app_private.apply_data_quality_fix(
    p_action,
    p_entity_id,
    coalesce(p_payload, '{}'::jsonb)
  );
$$;

revoke all on function public.apply_data_quality_fix(text, uuid, jsonb)
  from public, anon;
grant execute on function public.apply_data_quality_fix(text, uuid, jsonb)
  to authenticated;
