create table public.coaching_recommendation_decisions (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  week_start date not null,
  recommendation_key text not null check (
    btrim(recommendation_key) <> '' and char_length(recommendation_key) <= 200
  ),
  recommendation_type text not null check (recommendation_type in ('move_session')),
  suggested_workout_id uuid not null references public.suggested_workouts(id) on delete restrict,
  original_date date not null,
  proposed_date date not null,
  chosen_date date,
  decision text not null check (decision in ('accepted', 'rejected')),
  rationale text not null check (btrim(rationale) <> ''),
  decided_at timestamptz not null default now(),
  unique (person_id, week_start, recommendation_key),
  check (original_date between week_start and week_start + 6),
  check (proposed_date between week_start and week_start + 6),
  check (chosen_date is null or chosen_date between week_start and week_start + 6),
  check (
    (decision = 'accepted' and chosen_date is not null)
    or (decision = 'rejected' and chosen_date is null)
  )
);

create index coaching_recommendation_decisions_person_week_idx
  on public.coaching_recommendation_decisions (person_id, week_start, decided_at desc);

alter table public.coaching_recommendation_decisions enable row level security;

create policy coaching_recommendation_decisions_accessible
  on public.coaching_recommendation_decisions
  for all to authenticated
  using (app_private.person_is_accessible(person_id))
  with check (app_private.person_is_accessible(person_id));

grant select, insert, update on public.coaching_recommendation_decisions to authenticated;

create function public.decide_coaching_recommendation(
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
  v_decision_id uuid;
begin
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
  if (p_decision = 'accepted' and p_chosen_date is null)
    or (p_decision = 'rejected' and p_chosen_date is not null)
  then
    raise exception 'The coaching decision is incomplete.' using errcode = '22023';
  end if;

  select workout.person_id, workout.suggested_for
    into v_person_id, v_current_date
  from public.suggested_workouts workout
  where workout.id = p_suggested_workout_id
    and workout.program_workout_id is null
    and workout.status in ('pending', 'accepted')
    and app_private.person_is_accessible(workout.person_id)
  for update;

  if not found or v_current_date is distinct from p_original_date then
    raise exception 'This recommendation is out of date. Refresh the week and review it again.';
  end if;

  if p_decision = 'accepted' then
    update public.suggested_workouts
    set suggested_for = p_chosen_date
    where id = p_suggested_workout_id and person_id = v_person_id;
  end if;

  insert into public.coaching_recommendation_decisions (
    person_id, week_start, recommendation_key, recommendation_type,
    suggested_workout_id, original_date, proposed_date, chosen_date,
    decision, rationale
  ) values (
    v_person_id, p_week_start, p_recommendation_key, 'move_session',
    p_suggested_workout_id, p_original_date, p_proposed_date, p_chosen_date,
    p_decision, p_rationale
  )
  on conflict (person_id, week_start, recommendation_key) do update
  set proposed_date = excluded.proposed_date,
      chosen_date = excluded.chosen_date,
      decision = excluded.decision,
      rationale = excluded.rationale,
      decided_at = now()
  returning id into v_decision_id;

  return v_decision_id;
end;
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
