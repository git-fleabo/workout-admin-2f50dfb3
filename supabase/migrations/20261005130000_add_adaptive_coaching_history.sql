alter table public.coaching_recommendation_decisions
  add column subject_focus_id text;

update public.coaching_recommendation_decisions decision
set subject_focus_id = case
  when workout.goal_id is not null then 'goal:' || workout.goal_id::text
  when workout.mobility_practice_run_id is not null then
    'mobility:' || workout.mobility_practice_run_id::text
  else 'kind:' || coalesce(workout.plan_kind, 'other')
end
from public.suggested_workouts workout
where workout.id = decision.suggested_workout_id;

alter table public.coaching_recommendation_decisions
  alter column subject_focus_id set not null,
  add constraint coaching_recommendation_decisions_subject_focus_check
    check (btrim(subject_focus_id) <> ''),
  drop constraint coaching_recommendation_decisions_recommendation_type_check,
  add constraint coaching_recommendation_decisions_recommendation_type_check
    check (recommendation_type in ('move_session', 'skip_support_session')),
  drop constraint coaching_recommendation_decisions_check3,
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
        recommendation_type = 'skip_support_session'
        and chosen_date is null
      )
    );

create index coaching_recommendation_decisions_learning_idx
  on public.coaching_recommendation_decisions (
    person_id, recommendation_type, subject_focus_id, week_start desc
  );

create function public.decide_coaching_recommendation_v2(
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
begin
  if p_recommendation_type not in ('move_session', 'skip_support_session') then
    raise exception 'Choose a supported coaching recommendation.' using errcode = '22023';
  end if;
  if p_decision not in ('accepted', 'rejected') then
    raise exception 'Choose accept or reject.' using errcode = '22023';
  end if;
  if p_recommendation_key is null or btrim(p_recommendation_key) = '' then
    raise exception 'The coaching recommendation is missing.' using errcode = '22023';
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
      p_recommendation_type = 'skip_support_session'
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
  end if;

  insert into public.coaching_recommendation_decisions (
    person_id, week_start, recommendation_key, recommendation_type,
    suggested_workout_id, subject_focus_id, original_date, proposed_date, chosen_date,
    decision, rationale
  ) values (
    v_person_id, p_week_start, p_recommendation_key, p_recommendation_type,
    p_suggested_workout_id, v_subject_focus_id, p_original_date, p_proposed_date, p_chosen_date,
    p_decision, p_rationale
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
      decided_at = now()
  returning id into v_decision_id;

  return v_decision_id;
end;
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

create or replace function public.decide_coaching_recommendation(
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
  select public.decide_coaching_recommendation_v2(
    'move_session',
    p_recommendation_key,
    p_suggested_workout_id,
    p_week_start,
    p_original_date,
    p_proposed_date,
    p_chosen_date,
    p_decision,
    p_rationale
  );
$$;

revoke all on function public.decide_coaching_recommendation(
  text, uuid, date, date, date, date, text, text
) from public;
revoke all on function public.decide_coaching_recommendation(
  text, uuid, date, date, date, date, text, text
) from anon;
grant execute on function public.decide_coaching_recommendation(
  text, uuid, date, date, date, date, text, text
) to authenticated;
