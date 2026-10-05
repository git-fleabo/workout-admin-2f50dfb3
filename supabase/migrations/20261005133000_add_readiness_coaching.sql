alter table public.coaching_recommendation_decisions
  add column action_details jsonb not null default '{}'::jsonb,
  add constraint coaching_recommendation_decisions_action_details_check
    check (jsonb_typeof(action_details) = 'object'),
  drop constraint coaching_recommendation_decisions_recommendation_type_check,
  add constraint coaching_recommendation_decisions_recommendation_type_check
    check (
      recommendation_type in (
        'move_session', 'skip_support_session', 'adjust_support_dose'
      )
    ),
  drop constraint coaching_recommendation_decisions_decision_shape_check,
  add constraint coaching_recommendation_decisions_decision_shape_check
    check (
      (
        recommendation_type = 'move_session'
        and (
          (decision = 'accepted' and chosen_date is not null)
          or (decision = 'rejected' and chosen_date is null)
        )
      )
      or (
        recommendation_type in ('skip_support_session', 'adjust_support_dose')
        and chosen_date is null
      )
    );

create function public.decide_coaching_recommendation_v3(
  p_recommendation_type text,
  p_recommendation_key text,
  p_suggested_workout_id uuid,
  p_week_start date,
  p_original_date date,
  p_proposed_date date,
  p_chosen_date date,
  p_decision text,
  p_rationale text,
  p_action_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_person_id uuid;
  v_current_date date;
  v_current_status text;
  v_program_assignment_id uuid;
  v_program_workout_id uuid;
  v_goal_id uuid;
  v_mobility_run_id uuid;
  v_plan_kind text;
  v_subject_focus_id text;
  v_decision_id uuid;
  v_entry_count integer;
  v_entry_id uuid;
  v_tracking_mode text;
  v_current_sets integer;
  v_current_value numeric;
  v_max_value numeric;
  v_adjustment text;
  v_from_sets integer;
  v_from_value numeric;
  v_target_sets integer;
  v_target_value numeric;
  v_dose_unit text;
  v_increment numeric;
begin
  if p_recommendation_type not in (
    'move_session', 'skip_support_session', 'adjust_support_dose'
  ) then
    raise exception 'Choose a supported coaching recommendation.' using errcode = '22023';
  end if;
  if p_decision not in ('accepted', 'rejected') then
    raise exception 'Choose accept or reject.' using errcode = '22023';
  end if;
  if p_recommendation_key is null or btrim(p_recommendation_key) = '' then
    raise exception 'The coaching recommendation is missing.' using errcode = '22023';
  end if;
  if p_action_details is null or jsonb_typeof(p_action_details) <> 'object' then
    raise exception 'The coaching action is invalid.' using errcode = '22023';
  end if;
  if p_original_date not between p_week_start and p_week_start + 6
    or p_proposed_date not between p_week_start and p_week_start + 6
    or (p_chosen_date is not null and p_chosen_date not between p_week_start and p_week_start + 6)
  then
    raise exception 'Choose a date inside this training week.' using errcode = '22023';
  end if;
  if (
      p_recommendation_type = 'move_session'
      and (
        (p_decision = 'accepted' and p_chosen_date is null)
        or (p_decision = 'rejected' and p_chosen_date is not null)
      )
    )
    or (
      p_recommendation_type in ('skip_support_session', 'adjust_support_dose')
      and p_chosen_date is not null
    )
  then
    raise exception 'The coaching decision is incomplete.' using errcode = '22023';
  end if;

  select
    workout.person_id,
    workout.suggested_for,
    workout.status,
    workout.program_assignment_id,
    workout.program_workout_id,
    workout.goal_id,
    workout.mobility_practice_run_id,
    workout.plan_kind
  into
    v_person_id,
    v_current_date,
    v_current_status,
    v_program_assignment_id,
    v_program_workout_id,
    v_goal_id,
    v_mobility_run_id,
    v_plan_kind
  from public.suggested_workouts workout
  where workout.id = p_suggested_workout_id
    and workout.program_workout_id is null
    and workout.status in ('pending', 'accepted')
    and app_private.person_is_accessible(workout.person_id)
  for update;

  if not found or v_current_date is distinct from p_original_date then
    raise exception 'This recommendation is out of date. Refresh the week and review it again.';
  end if;

  v_subject_focus_id := case
    when v_goal_id is not null then 'goal:' || v_goal_id::text
    when v_mobility_run_id is not null then 'mobility:' || v_mobility_run_id::text
    else 'kind:' || coalesce(v_plan_kind, 'other')
  end;

  if p_recommendation_type = 'skip_support_session' then
    if v_program_assignment_id is null
      or v_program_workout_id is not null
      or (v_goal_id is null and v_mobility_run_id is null)
    then
      raise exception 'Only programme-linked support work can be reduced.';
    end if;
    if not exists (
      select 1
      from public.coaching_preferences preference
      where preference.person_id = v_person_id
        and v_subject_focus_id = any(preference.maintenance_focus_ids)
        and app_private.person_is_accessible(preference.person_id)
    ) then
      raise exception 'Only a saved maintenance priority can be reduced.';
    end if;
  elsif p_recommendation_type = 'adjust_support_dose' then
    if v_program_assignment_id is null
      or v_program_workout_id is not null
      or v_goal_id is null
      or v_plan_kind is distinct from 'skill'
    then
      raise exception 'Only programme-linked skill support can use a coaching dose change.';
    end if;

    select count(*)::integer
    into v_entry_count
    from public.suggested_workout_entries entry
    where entry.suggested_workout_id = p_suggested_workout_id;

    if v_entry_count <> 1 then
      raise exception 'A coaching dose change needs one support movement.';
    end if;

    select entry.id, entry.tracking_mode
    into v_entry_id, v_tracking_mode
    from public.suggested_workout_entries entry
    where entry.suggested_workout_id = p_suggested_workout_id
    limit 1;

    if v_tracking_mode not in ('reps_only', 'hold', 'grip_hold') then
      raise exception 'This support dose cannot be adjusted automatically.';
    end if;

    perform 1
    from public.suggested_workout_sets set_row
    where set_row.suggested_workout_entry_id = v_entry_id
    for update;

    select
      count(*)::integer,
      min(
        case
          when v_tracking_mode in ('hold', 'grip_hold') then set_row.duration_seconds
          else set_row.reps
        end
      ),
      max(
        case
          when v_tracking_mode in ('hold', 'grip_hold') then set_row.duration_seconds
          else set_row.reps
        end
      )
    into v_current_sets, v_current_value, v_max_value
    from public.suggested_workout_sets set_row
    where set_row.suggested_workout_entry_id = v_entry_id;

    if v_current_sets < 1
      or v_current_value is null
      or v_current_value <> v_max_value
      or exists (
        select 1
        from public.suggested_workout_sets set_row
        join public.suggested_workout_set_segments segment
          on segment.suggested_workout_set_id = set_row.id
        where set_row.suggested_workout_entry_id = v_entry_id
      )
    then
      raise exception 'This support dose is not a simple uniform prescription.';
    end if;

    begin
      v_adjustment := p_action_details ->> 'adjustment';
      v_from_sets := (p_action_details ->> 'from_sets')::integer;
      v_from_value := (p_action_details ->> 'from_value')::numeric;
      v_target_sets := (p_action_details ->> 'target_sets')::integer;
      v_target_value := (p_action_details ->> 'target_value')::numeric;
      v_dose_unit := p_action_details ->> 'dose_unit';
    exception when others then
      raise exception 'The coaching dose details are invalid.' using errcode = '22023';
    end;

    if v_adjustment not in ('progress', 'reduce')
      or v_from_sets is distinct from v_current_sets
      or v_from_value is distinct from v_current_value
      or v_target_sets not between 1 and 6
      or v_target_value < 1
      or v_dose_unit is distinct from (
        case when v_tracking_mode in ('hold', 'grip_hold') then 'seconds' else 'reps' end
      )
    then
      raise exception 'This coaching dose is out of date or outside its safe bounds.';
    end if;

    v_increment := case when v_dose_unit = 'seconds' then 2 else 1 end;
    if v_adjustment = 'progress' and (
      v_target_sets <> v_current_sets
      or v_target_value <> v_current_value + v_increment
    ) then
      raise exception 'Progression is limited to one small dose step.';
    elsif v_adjustment = 'reduce' and (
      (
        v_current_sets > 1
        and (v_target_sets <> v_current_sets - 1 or v_target_value <> v_current_value)
      )
      or (
        v_current_sets = 1
        and (
          v_target_sets <> 1
          or v_target_value <> greatest(1, v_current_value - v_increment)
          or v_target_value >= v_current_value
        )
      )
    ) then
      raise exception 'Reduction is limited to one small dose step.';
    end if;
  end if;

  if p_decision = 'accepted' and p_recommendation_type = 'move_session' then
    update public.suggested_workouts
    set suggested_for = p_chosen_date
    where id = p_suggested_workout_id and person_id = v_person_id;
  elsif p_decision = 'accepted' and p_recommendation_type = 'skip_support_session' then
    update public.suggested_workouts
    set status = 'skipped'
    where id = p_suggested_workout_id
      and person_id = v_person_id
      and status = v_current_status;
  elsif p_decision = 'accepted' and p_recommendation_type = 'adjust_support_dose' then
    delete from public.suggested_workout_sets
    where suggested_workout_entry_id = v_entry_id
      and set_number > v_target_sets;

    update public.suggested_workout_sets
    set reps = case when v_dose_unit = 'reps' then v_target_value else reps end,
        duration_seconds = case
          when v_dose_unit = 'seconds' then v_target_value
          else duration_seconds
        end
    where suggested_workout_entry_id = v_entry_id;
  end if;

  insert into public.coaching_recommendation_decisions (
    person_id, week_start, recommendation_key, recommendation_type,
    suggested_workout_id, subject_focus_id, original_date, proposed_date, chosen_date,
    decision, rationale, action_details
  ) values (
    v_person_id, p_week_start, p_recommendation_key, p_recommendation_type,
    p_suggested_workout_id, v_subject_focus_id, p_original_date, p_proposed_date, p_chosen_date,
    p_decision, p_rationale, p_action_details
  )
  on conflict (person_id, week_start, recommendation_key) do update
  set recommendation_type = excluded.recommendation_type,
      suggested_workout_id = excluded.suggested_workout_id,
      subject_focus_id = excluded.subject_focus_id,
      original_date = excluded.original_date,
      proposed_date = excluded.proposed_date,
      chosen_date = excluded.chosen_date,
      decision = excluded.decision,
      rationale = excluded.rationale,
      action_details = excluded.action_details,
      decided_at = now()
  returning id into v_decision_id;

  return v_decision_id;
end;
$$;

revoke all on function public.decide_coaching_recommendation_v3(
  text, text, uuid, date, date, date, date, text, text, jsonb
) from public;
revoke all on function public.decide_coaching_recommendation_v3(
  text, text, uuid, date, date, date, date, text, text, jsonb
) from anon;
grant execute on function public.decide_coaching_recommendation_v3(
  text, text, uuid, date, date, date, date, text, text, jsonb
) to authenticated;

create or replace function public.decide_coaching_recommendation_v2(
  p_recommendation_type text,
  p_recommendation_key text,
  p_suggested_workout_id uuid,
  p_week_start date,
  p_original_date date,
  p_proposed_date date,
  p_chosen_date date,
  p_decision text,
  p_rationale text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select public.decide_coaching_recommendation_v3(
    p_recommendation_type,
    p_recommendation_key,
    p_suggested_workout_id,
    p_week_start,
    p_original_date,
    p_proposed_date,
    p_chosen_date,
    p_decision,
    p_rationale,
    '{}'::jsonb
  );
$$;

revoke all on function public.decide_coaching_recommendation_v2(
  text, text, uuid, date, date, date, date, text, text
) from public;
revoke all on function public.decide_coaching_recommendation_v2(
  text, text, uuid, date, date, date, date, text, text
) from anon;
grant execute on function public.decide_coaching_recommendation_v2(
  text, text, uuid, date, date, date, date, text, text
) to authenticated;
