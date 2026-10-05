create table public.coaching_recommendation_outcomes (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null unique
    references public.coaching_recommendation_decisions(id) on delete cascade,
  outcome_rating text not null
    check (outcome_rating in ('too_easy', 'right', 'too_hard')),
  recorded_at timestamptz not null default now()
);

alter table public.coaching_recommendation_outcomes enable row level security;

create policy coaching_recommendation_outcomes_accessible
  on public.coaching_recommendation_outcomes
  for all to authenticated
  using (
    exists (
      select 1
      from public.coaching_recommendation_decisions decision
      where decision.id = decision_id
        and app_private.person_is_accessible(decision.person_id)
    )
  )
  with check (
    exists (
      select 1
      from public.coaching_recommendation_decisions decision
      where decision.id = decision_id
        and app_private.person_is_accessible(decision.person_id)
    )
  );

grant select, insert, update on public.coaching_recommendation_outcomes to authenticated;

create function public.record_coaching_recommendation_outcome(
  p_decision_id uuid,
  p_outcome_rating text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_outcome_id uuid;
  v_recommendation_type text;
  v_week_start date;
  v_workout_status text;
  v_completed_session_id uuid;
begin
  if p_outcome_rating not in ('too_easy', 'right', 'too_hard') then
    raise exception 'Choose too easy, about right or too hard.' using errcode = '22023';
  end if;

  select
    decision.recommendation_type,
    decision.week_start,
    workout.status,
    workout.completed_session_id
  into
    v_recommendation_type,
    v_week_start,
    v_workout_status,
    v_completed_session_id
  from public.coaching_recommendation_decisions decision
  join public.suggested_workouts workout on workout.id = decision.suggested_workout_id
  where decision.id = p_decision_id
    and decision.decision = 'accepted'
    and app_private.person_is_accessible(decision.person_id)
    and app_private.person_is_accessible(workout.person_id)
  for update of decision, workout;

  if not found then
    raise exception 'This coaching review is unavailable.';
  end if;

  if v_recommendation_type in ('move_session', 'adjust_support_dose')
    and (v_workout_status <> 'completed' or v_completed_session_id is null)
  then
    raise exception 'Complete the reviewed session before rating the result.';
  end if;

  if v_recommendation_type = 'skip_support_session'
    and (v_workout_status <> 'skipped' or current_date <= v_week_start + 6)
  then
    raise exception 'Review this reduction after the training week has ended.';
  end if;

  insert into public.coaching_recommendation_outcomes (
    decision_id, outcome_rating
  ) values (
    p_decision_id, p_outcome_rating
  )
  on conflict (decision_id) do update
  set outcome_rating = excluded.outcome_rating,
      recorded_at = now()
  returning id into v_outcome_id;

  return v_outcome_id;
end;
$$;

revoke all on function public.record_coaching_recommendation_outcome(uuid, text) from public;
revoke all on function public.record_coaching_recommendation_outcome(uuid, text) from anon;
grant execute on function public.record_coaching_recommendation_outcome(uuid, text) to authenticated;
