-- Corrections reuse the validated save writer in a single transaction.
-- Existing public save signatures and the original session identity stay stable.
create policy session_entries_delete_managed on public.session_entries
for delete to authenticated using (
  exists (select 1 from public.sessions session
    where session.id = session_entries.session_id
      and app_private.person_is_accessible(session.person_id))
);
create policy session_method_blocks_delete_managed on public.session_method_blocks
for delete to authenticated using (
  exists (select 1 from public.sessions session
    where session.id = session_method_blocks.session_id
      and app_private.person_is_accessible(session.person_id))
);
grant delete on public.session_entries, public.session_method_blocks to authenticated;

create or replace function app_private.write_workout(
  p_person_id uuid,
  p_session jsonb,
  p_entries jsonb,
  p_method_blocks jsonb,
  p_existing_session_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session_id uuid;
  v_entry_id uuid;
  v_set_id uuid;
  v_block_id uuid;
  v_entry jsonb;
  v_set jsonb;
  v_metric jsonb;
  v_segment jsonb;
  v_block jsonb;
  v_member jsonb;
  v_entry_ids jsonb := '{}'::jsonb;
  v_client_id text;
  v_activity_type_id uuid;
  v_exercise_id uuid;
  v_parent_activity_type_id uuid;
  v_completed boolean := coalesce((p_session->>'completed')::boolean, true);
begin
  if not app_private.person_is_accessible(p_person_id) then
    raise exception 'The requested training profile is not accessible.'
      using errcode = '42501';
  end if;

  if p_entries is null or jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) = 0 then
    raise exception 'A workout requires at least one movement.'
      using errcode = '22023';
  end if;

  if p_existing_session_id is null then
  insert into public.sessions (
    person_id,
    activity_type_id,
    session_date,
    title,
    source,
    completed,
    duration_minutes,
    intensity,
    rpe,
    notes,
    training_location_id,
    source_sheet,
    source_row
  )
  values (
    p_person_id,
    nullif(p_session->>'activity_type_id', '')::uuid,
    (p_session->>'session_date')::date,
    nullif(btrim(p_session->>'title'), ''),
    'manual',
    false,
    nullif(p_session->>'duration_minutes', '')::numeric,
    nullif(p_session->>'intensity', ''),
    nullif(p_session->>'rpe', '')::numeric,
    nullif(p_session->>'notes', ''),
    nullif(p_session->>'training_location_id', '')::uuid,
    null,
    null
  )
  returning id into v_session_id;

  else
    select session.id into v_session_id
    from public.sessions session
    where session.id = p_existing_session_id and session.person_id = p_person_id
    for update;
    if not found then
      raise exception 'The original workout was not found for this training profile.'
        using errcode = '42501';
    end if;

    -- Cascades remove old sets, segments, metrics and block members. The parent
    -- survives, retaining every plan, review, source and mobility reference.
    delete from public.session_method_blocks where session_id = v_session_id;
    delete from public.session_entries where session_id = v_session_id;
    update public.sessions set
      activity_type_id = nullif(p_session->>'activity_type_id', '')::uuid,
      session_date = (p_session->>'session_date')::date,
      title = nullif(btrim(p_session->>'title'), ''),
      completed = false,
      duration_minutes = nullif(p_session->>'duration_minutes', '')::numeric,
      intensity = nullif(p_session->>'intensity', ''),
      rpe = nullif(p_session->>'rpe', '')::numeric,
      notes = nullif(p_session->>'notes', ''),
      training_location_id = nullif(p_session->>'training_location_id', '')::uuid
    where id = v_session_id;
    if not found then
      raise exception 'The workout correction could not be saved.';
    end if;
  end if;

  for v_entry in select value from jsonb_array_elements(p_entries)
  loop
    v_activity_type_id := nullif(v_entry->>'activity_type_id', '')::uuid;
    v_exercise_id := nullif(v_entry->>'exercise_id', '')::uuid;
    v_client_id := nullif(v_entry->>'client_id', '');

    if v_activity_type_id is null
      or not exists (
        select 1 from public.activity_types where id = v_activity_type_id
      )
    then
      raise exception 'Every movement requires a valid activity type.'
        using errcode = '22023';
    end if;

    if v_exercise_id is not null and not exists (
      select 1
      from public.exercises
      where id = v_exercise_id
        and is_active
        and (activity_type_id is null or activity_type_id = v_activity_type_id)
    ) then
      raise exception 'A movement references an invalid exercise or activity pairing.'
        using errcode = '22023';
    end if;

    insert into public.session_entries (
      session_id,
      exercise_id,
      activity_type_id,
      entry_kind,
      name,
      progression_level,
      order_index,
      completed,
      notes,
      source_sheet,
      source_row
    )
    values (
      v_session_id,
      v_exercise_id,
      v_activity_type_id,
      nullif(v_entry->>'entry_kind', ''),
      btrim(v_entry->>'name'),
      nullif(v_entry->>'progression_level', ''),
      coalesce((v_entry->>'order_index')::integer, 0),
      coalesce((v_entry->>'completed')::boolean, true),
      nullif(v_entry->>'notes', ''),
      null,
      null
    )
    returning id into v_entry_id;

    if v_client_id is not null then
      v_entry_ids := v_entry_ids || jsonb_build_object(v_client_id, v_entry_id::text);
    end if;

    for v_set in
      select value from jsonb_array_elements(coalesce(v_entry->'sets', '[]'::jsonb))
    loop
      insert into public.entry_sets (
        session_entry_id,
        set_number,
        reps,
        weight,
        duration_seconds,
        distance,
        distance_unit,
        rpe,
        rest_time,
        assistance_type,
        assistance_detail,
        quality,
        completed,
        notes,
        data_shape,
        aggregate_set_count,
        load_semantics,
        volume_status,
        implement_count
      )
      values (
        v_entry_id,
        nullif(v_set->>'set_number', '')::integer,
        nullif(v_set->>'reps', '')::numeric,
        nullif(v_set->>'weight', '')::numeric,
        nullif(v_set->>'duration_seconds', '')::numeric,
        nullif(v_set->>'distance', '')::numeric,
        nullif(v_set->>'distance_unit', ''),
        nullif(v_set->>'rpe', '')::numeric,
        nullif(v_set->>'rest_time', ''),
        nullif(v_set->>'assistance_type', ''),
        nullif(v_set->>'assistance_detail', ''),
        nullif(v_set->>'quality', ''),
        coalesce((v_set->>'completed')::boolean, true),
        nullif(v_set->>'notes', ''),
        coalesce(nullif(v_set->>'data_shape', ''), 'individual'),
        nullif(v_set->>'aggregate_set_count', '')::integer,
        coalesce(nullif(v_set->>'load_semantics', ''), 'unknown'),
        coalesce(nullif(v_set->>'volume_status', ''), 'unknown'),
        nullif(v_set->>'implement_count', '')::integer
      )
      returning id into v_set_id;

      for v_segment in
        select value from jsonb_array_elements(coalesce(v_set->'segments', '[]'::jsonb))
      loop
        insert into public.entry_set_segments (
          entry_set_id,
          training_method_id,
          method_name,
          segment_index,
          reps,
          weight,
          rpe,
          rest_after_seconds,
          range_of_motion,
          config
        )
        values (
          v_set_id,
          (v_segment->>'training_method_id')::uuid,
          v_segment->>'method_name',
          coalesce((v_segment->>'segment_index')::integer, 0),
          nullif(v_segment->>'reps', '')::numeric,
          nullif(v_segment->>'weight', '')::numeric,
          nullif(v_segment->>'rpe', '')::numeric,
          nullif(v_segment->>'rest_after_seconds', '')::integer,
          nullif(v_segment->>'range_of_motion', ''),
          coalesce(v_segment->'config', '{}'::jsonb)
        );
      end loop;
    end loop;

    for v_metric in
      select value from jsonb_array_elements(coalesce(v_entry->'metrics', '[]'::jsonb))
    loop
      insert into public.entry_metrics (
        session_entry_id,
        metric_key,
        metric_value,
        metric_text,
        metric_unit
      )
      values (
        v_entry_id,
        v_metric->>'metric_key',
        nullif(v_metric->>'metric_value', '')::numeric,
        nullif(v_metric->>'metric_text', ''),
        nullif(v_metric->>'metric_unit', '')
      );
    end loop;
  end loop;

  for v_block in
    select value from jsonb_array_elements(coalesce(p_method_blocks, '[]'::jsonb))
  loop
    insert into public.session_method_blocks (
      session_id,
      training_method_id,
      method_name,
      family,
      order_index,
      rounds,
      rest_between_movements_seconds,
      rest_between_rounds_seconds,
      block_duration_seconds,
      work_interval_seconds,
      rest_interval_seconds,
      completed_rounds,
      config
    )
    values (
      v_session_id,
      (v_block->>'training_method_id')::uuid,
      v_block->>'method_name',
      v_block->>'family',
      coalesce((v_block->>'order_index')::integer, 0),
      nullif(v_block->>'rounds', '')::integer,
      nullif(v_block->>'rest_between_movements_seconds', '')::integer,
      nullif(v_block->>'rest_between_rounds_seconds', '')::integer,
      nullif(v_block->>'block_duration_seconds', '')::integer,
      nullif(v_block->>'work_interval_seconds', '')::integer,
      nullif(v_block->>'rest_interval_seconds', '')::integer,
      nullif(v_block->>'completed_rounds', '')::integer,
      coalesce(v_block->'config', '{}'::jsonb)
    )
    returning id into v_block_id;

    for v_member in
      select value from jsonb_array_elements(coalesce(v_block->'member_client_ids', '[]'::jsonb))
    loop
      if not (v_entry_ids ? (v_member #>> '{}')) then
        raise exception 'A training-method block references an unknown movement.'
          using errcode = '22023';
      end if;

      insert into public.session_method_block_entries (
        block_id,
        session_entry_id,
        sequence_index
      )
      values (
        v_block_id,
        (v_entry_ids->>(v_member #>> '{}'))::uuid,
        coalesce((
          select count(*)::integer
          from public.session_method_block_entries
          where block_id = v_block_id
        ), 0)
      );
    end loop;
  end loop;

  select
    case
      when count(distinct activity_type_id) = 1 then min(activity_type_id::text)::uuid
      else (
        select id from public.activity_types where slug = 'mixed-training'
      )
    end
  into v_parent_activity_type_id
  from public.session_entries
  where session_id = v_session_id;

  update public.sessions
  set
    activity_type_id = v_parent_activity_type_id,
    completed = v_completed
  where id = v_session_id;

  return v_session_id;
end
$$;

revoke all on function app_private.write_workout(uuid, jsonb, jsonb, jsonb, uuid) from public, anon;
grant execute on function app_private.write_workout(uuid, jsonb, jsonb, jsonb, uuid) to authenticated;

create or replace function public.save_workout(
  p_person_id uuid, p_session jsonb, p_entries jsonb,
  p_method_blocks jsonb default '[]'::jsonb
) returns uuid language sql security invoker set search_path = '' as $$
  select app_private.write_workout(p_person_id, p_session, p_entries, p_method_blocks, null);
$$;

create function public.correct_workout(
  p_session_id uuid, p_person_id uuid, p_session jsonb, p_entries jsonb,
  p_method_blocks jsonb default '[]'::jsonb
) returns uuid language plpgsql security invoker set search_path = '' as $$
begin
  if p_session_id is null then
    raise exception 'Missing workout session id.' using errcode = '22023';
  end if;
  return app_private.write_workout(p_person_id, p_session, p_entries, p_method_blocks, p_session_id);
end;
$$;
revoke all on function public.correct_workout(uuid, uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.correct_workout(uuid, uuid, jsonb, jsonb, jsonb) to authenticated;
