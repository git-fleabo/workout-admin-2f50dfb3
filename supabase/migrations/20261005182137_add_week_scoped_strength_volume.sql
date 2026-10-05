create or replace function public.apply_programme_strength_week_review(
  p_assignment_id uuid,
  p_programme_week integer,
  p_start_workout_index integer,
  p_end_workout_index integer,
  p_workout_ids uuid[],
  p_recovery_level text,
  p_recommendation_kind text,
  p_adjustments jsonb,
  p_previous_review_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_person_id uuid;
  v_program_id uuid;
  v_method_type text;
  v_current_workout_index integer;
  v_review_id uuid;
  v_workout_count integer;
  v_min_workout_index integer;
  v_max_workout_index integer;
  v_adjustment jsonb;
  v_assignment_exercise_id uuid;
  v_exercise_name text;
  v_automatic_adjustment numeric;
  v_manual_adjustment numeric;
  v_combined_adjustment numeric;
  v_set_adjustment integer;
  v_applied_adjustments jsonb := '[]'::jsonb;
begin
  if p_recovery_level not in ('normal', 'lighter', 'deload') then
    raise exception 'Choose a valid recovery level.' using errcode = '22023';
  end if;
  if p_recommendation_kind not in ('keep', 'reduce', 'restore', 'hold', 'extend') then
    raise exception 'Choose a valid strength review decision.' using errcode = '22023';
  end if;
  if p_start_workout_index < 0 or p_end_workout_index < p_start_workout_index then
    raise exception 'Choose a valid programme workout range.' using errcode = '22023';
  end if;
  if p_workout_ids is null or cardinality(p_workout_ids) = 0 then
    raise exception 'The reviewed programme week needs at least one workout.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_adjustments) <> 'array' or jsonb_array_length(p_adjustments) = 0 then
    raise exception 'The reviewed programme week needs at least one exercise adjustment.' using errcode = '22023';
  end if;

  select
    assignment.person_id,
    assignment.program_id,
    assignment.current_workout_index,
    programme.method_type
  into
    v_person_id,
    v_program_id,
    v_current_workout_index,
    v_method_type
  from public.program_assignments assignment
  join public.programs programme on programme.id = assignment.program_id
  where assignment.id = p_assignment_id
    and assignment.status = 'active'
    and app_private.person_is_accessible(assignment.person_id)
  for update of assignment;

  if not found or v_method_type <> 'adaptive_strength_12_week' then
    raise exception 'The active adaptive strength programme was not found.';
  end if;
  if p_start_workout_index <> v_current_workout_index then
    raise exception 'The programme has moved on. Review the latest upcoming week.';
  end if;

  select count(*), min(workout.sequence_index), max(workout.sequence_index)
  into v_workout_count, v_min_workout_index, v_max_workout_index
  from public.program_workouts workout
  where workout.program_id = v_program_id
    and workout.id = any(p_workout_ids);

  if v_workout_count <> cardinality(p_workout_ids)
    or v_min_workout_index <> p_start_workout_index
    or v_max_workout_index <> p_end_workout_index
    or v_workout_count <> p_end_workout_index - p_start_workout_index + 1
  then
    raise exception 'The reviewed workouts do not match the upcoming programme range.';
  end if;

  if p_previous_review_id is not null and not exists (
    select 1
    from public.programme_strength_week_reviews review
    where review.id = p_previous_review_id
      and review.program_assignment_id = p_assignment_id
      and review.person_id = v_person_id
      and review.status = 'active'
  ) then
    raise exception 'The previous strength review is no longer active.';
  end if;

  for v_adjustment in select value from jsonb_array_elements(p_adjustments)
  loop
    v_assignment_exercise_id := nullif(v_adjustment ->> 'exercise_id', '')::uuid;
    v_manual_adjustment := nullif(v_adjustment ->> 'manual_adjustment_percent', '')::numeric;
    v_combined_adjustment := nullif(v_adjustment ->> 'combined_adjustment_percent', '')::numeric;
    v_set_adjustment := coalesce(nullif(v_adjustment ->> 'set_adjustment', '')::integer, 0);

    if v_assignment_exercise_id is null
      or v_manual_adjustment not in (-5, -2.5, 0, 2.5, 5)
      or v_set_adjustment not in (-1, 0)
    then
      raise exception 'Every strength review adjustment needs a valid exercise, 2.5-point load step and supported set choice.' using errcode = '22023';
    end if;

    select exercise.exercise_name, exercise.load_adjustment_percent
    into v_exercise_name, v_automatic_adjustment
    from public.program_assignment_exercises exercise
    where exercise.id = v_assignment_exercise_id
      and exercise.program_assignment_id = p_assignment_id
      and exercise.is_enabled
    for update;

    if not found then
      raise exception 'A reviewed programme exercise is unavailable.';
    end if;
    if v_combined_adjustment is null
      or v_combined_adjustment <> v_automatic_adjustment + v_manual_adjustment
    then
      raise exception 'The reviewed combined adjustment is stale.';
    end if;

    update public.program_assignment_exercises exercise
    set manual_adjustment_percent = v_manual_adjustment,
        manual_adjusted_at = case when v_manual_adjustment = 0 then null else now() end,
        updated_at = now()
    where exercise.id = v_assignment_exercise_id;

    v_applied_adjustments := v_applied_adjustments || jsonb_build_array(jsonb_build_object(
      'assignment_exercise_id', v_assignment_exercise_id,
      'exercise_name', v_exercise_name,
      'automatic_adjustment_percent', v_automatic_adjustment,
      'manual_adjustment_percent', v_manual_adjustment,
      'combined_adjustment_percent', v_combined_adjustment,
      'set_adjustment', v_set_adjustment
    ));
  end loop;

  if p_previous_review_id is not null then
    update public.programme_strength_week_reviews review
    set status = 'resolved', resolved_at = now()
    where review.id = p_previous_review_id;
  end if;

  update public.programme_strength_week_reviews review
  set status = 'superseded', resolved_at = now()
  where review.program_assignment_id = p_assignment_id
    and review.status = 'active';

  insert into public.programme_strength_week_reviews (
    program_assignment_id,
    person_id,
    previous_review_id,
    programme_week,
    start_workout_index,
    end_workout_index,
    workout_ids,
    recovery_level,
    recommendation_kind,
    applied_adjustments,
    status
  ) values (
    p_assignment_id,
    v_person_id,
    p_previous_review_id,
    p_programme_week,
    p_start_workout_index,
    p_end_workout_index,
    p_workout_ids,
    p_recovery_level,
    p_recommendation_kind,
    v_applied_adjustments,
    'active'
  ) returning id into v_review_id;

  return v_review_id;
end;
$$;
