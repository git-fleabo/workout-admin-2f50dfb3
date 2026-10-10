-- Personal reviews use the existing week-review history. Original personal
-- prescriptions stay untouched: snapshots contain a separate temporary plan.
create function app_private.personal_strength_review_plan(p_plan jsonb, p_adjustments jsonb)
returns jsonb language plpgsql immutable security invoker set search_path = '' as $$
declare m jsonb; adjustment jsonb; s jsonb; movements jsonb := '[]'; sets jsonb;
  load_percent numeric; set_adjustment integer; row_index integer; row_count integer; adjusted numeric;
begin
  if jsonb_typeof(p_adjustments) is distinct from 'array' then raise exception 'Choose valid personal strength adjustments.'; end if;
  for adjustment in select value from jsonb_array_elements(p_adjustments) where value ? 'personal_key' loop
    if (adjustment->>'load_adjustment_percent')::numeric is null or (adjustment->>'load_adjustment_percent')::numeric not in (-5,-2.5,0)
      or (adjustment->>'set_adjustment')::integer is null or (adjustment->>'set_adjustment')::integer not in (-1,0) then
      raise exception 'Use saved loads, a 2.5 or 5 percent reduction, and at most one fewer set.';
    end if;
  end loop;
  for m in select value from jsonb_array_elements(p_plan->'movements') loop
    select value into adjustment from jsonb_array_elements(p_adjustments)
      where value->>'programme_key'=m->>'programmeKey' and (value->>'exercise_id')::uuid=(m->>'exerciseId')::uuid;
    if adjustment is null then movements := movements || jsonb_build_array(m); continue; end if;
    load_percent := (adjustment->>'load_adjustment_percent')::numeric;
    set_adjustment := (adjustment->>'set_adjustment')::integer;
    sets := '[]'; row_index := 0; row_count := jsonb_array_length(m->'setRows');
    for s in select value from jsonb_array_elements(m->'setRows') loop
      row_index := row_index+1;
      if set_adjustment=-1 and row_count>1 and row_index=row_count then continue; end if;
      if m->>'trackingMode' in ('weight_reps','grip_hold') and load_percent<>0 and coalesce(nullif(s->>'weight','')::numeric,0)>0 then
        adjusted := round((s->>'weight')::numeric * (1+load_percent/100),2);
        if adjusted>0 then s := jsonb_set(s,'{weight}',to_jsonb(trim(trailing '.' from trim(trailing '0' from adjusted::text)))); end if;
      end if;
      sets := sets || jsonb_build_array(s);
    end loop;
    movements := movements || jsonb_build_array(jsonb_set(m,'{setRows}',sets));
  end loop;
  return jsonb_set(p_plan,'{movements}',movements);
end; $$;
revoke all on function app_private.personal_strength_review_plan(jsonb,jsonb) from public, anon;
grant execute on function app_private.personal_strength_review_plan(jsonb,jsonb) to authenticated;

create function public.apply_personal_strength_week_review(
  p_assignment_id uuid, p_current_workout_index integer, p_sessions jsonb,
  p_recovery_level text, p_recommendation_kind text, p_adjustments jsonb,
  p_previous_review_id uuid default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare a public.program_assignments%rowtype; session_row public.personal_programme_sessions%rowtype;
  item jsonb; adjustment jsonb; snapshot jsonb; snapshots jsonb := '[]'; stored_adjustments jsonb := '[]';
  eligible uuid[]; requested uuid[]; first_week integer; session_limit integer; review_id uuid; previous_id uuid;
  first_position integer; last_position integer; count_matches integer; expected_keys jsonb;
begin
  select * into a from public.program_assignments where id=p_assignment_id for update;
  if auth.uid() is null or a.id is null or a.status<>'active' or not app_private.person_is_accessible(a.person_id)
    or not exists(select 1 from public.personal_programmes where assignment_id=a.id) then
    raise exception 'The active personal programme was not found.';
  end if;
  if p_current_workout_index is distinct from a.current_workout_index then raise exception 'The programme moved on. Refresh before applying the week.'; end if;
  if p_recovery_level is null or p_recovery_level not in ('normal','lighter','deload') or p_recommendation_kind is null or p_recommendation_kind not in ('keep','reduce','restore','hold','extend') then raise exception 'Choose a valid strength review.'; end if;
  if jsonb_typeof(p_sessions) is distinct from 'array' or jsonb_array_length(p_sessions) not between 1 and 100 then raise exception 'Choose the exact upcoming personal week.'; end if;
  if jsonb_typeof(p_adjustments) is distinct from 'array' or jsonb_array_length(p_adjustments) not between 1 and 210 then raise exception 'Review every movement in the personal week.'; end if;
  select id into previous_id from public.programme_strength_week_reviews where program_assignment_id=a.id and status='active';
  if previous_id is distinct from p_previous_review_id then raise exception 'The strength review changed elsewhere. Refresh before applying it.'; end if;
  if previous_id is not null and exists(select 1 from public.programme_strength_week_reviews where id=previous_id and end_workout_index>=a.current_workout_index) then
    raise exception 'Finish the applied strength week before reviewing another change.';
  end if;

  select w.week_number into first_week from public.program_workouts w
  where w.program_id=a.program_id and app_private.programme_workout_position(w.id)>=a.current_workout_index
    and not exists(select 1 from public.suggested_workouts p where p.program_assignment_id=a.id and p.program_workout_id=w.id and p.status in ('accepted','completed','skipped'))
  order by w.sequence_index,w.id limit 1;
  select greatest(1,coalesce(sessions_per_week,1)) into session_limit from public.programs where id=a.program_id;
  select array_agg(id order by sequence_index,id) into eligible from (
    select w.id,w.sequence_index from public.program_workouts w
    where w.program_id=a.program_id and app_private.programme_workout_position(w.id)>=a.current_workout_index
      and (first_week is null or w.week_number=first_week)
      and not exists(select 1 from public.suggested_workouts p where p.program_assignment_id=a.id and p.program_workout_id=w.id and p.status in ('accepted','completed','skipped'))
    order by w.sequence_index,w.id limit case when first_week is null then session_limit else 100 end
  ) upcoming;
  select array_agg((value->>'workout_id')::uuid order by ordinal) into requested from jsonb_array_elements(p_sessions) with ordinality x(value,ordinal);
  if eligible is null or requested is distinct from eligible then raise exception 'The preview no longer matches the exact upcoming week. Refresh before applying it.'; end if;
  select min(app_private.programme_workout_position(id)),max(app_private.programme_workout_position(id)) into first_position,last_position from public.program_workouts where id=any(eligible);

  for item in select value from jsonb_array_elements(p_sessions) loop
    select * into session_row from public.personal_programme_sessions where assignment_id=a.id and program_workout_id=(item->>'workout_id')::uuid for update;
    if session_row.program_workout_id is null or session_row.revision is distinct from (item->>'revision')::integer then raise exception 'A personal session changed. Refresh the preview before applying it.'; end if;
    snapshots := snapshots || jsonb_build_array(jsonb_build_object('workout_id',session_row.program_workout_id,'revision',session_row.revision,'name',session_row.name,'scheduled_date',session_row.scheduled_on,'base_plan',session_row.plan));
  end loop;
  select jsonb_agg(jsonb_build_object('programme_key',programme_key,'exercise_id',exercise_id)) into expected_keys from (
    select distinct m->>'programmeKey' programme_key,(m->>'exerciseId')::uuid exercise_id
    from jsonb_array_elements(snapshots) s cross join lateral jsonb_array_elements(s->'base_plan'->'movements') m
  ) keys;
  if jsonb_array_length(expected_keys)<>jsonb_array_length(p_adjustments) or
    (select count(distinct (value->>'programme_key',(value->>'exercise_id')::uuid)) from jsonb_array_elements(p_adjustments))<>jsonb_array_length(p_adjustments) then raise exception 'Review each personal movement exactly once.'; end if;
  for adjustment in select value from jsonb_array_elements(p_adjustments) loop
    select count(*) into count_matches from jsonb_array_elements(expected_keys) k where k->>'programme_key'=adjustment->>'programme_key' and (k->>'exercise_id')::uuid=(adjustment->>'exercise_id')::uuid;
    if count_matches<>1 then raise exception 'A reviewed personal movement changed. Refresh the preview.'; end if;
    select m into item from jsonb_array_elements(snapshots) s cross join lateral jsonb_array_elements(s->'base_plan'->'movements') m
      where m->>'programmeKey'=adjustment->>'programme_key' and (m->>'exerciseId')::uuid=(adjustment->>'exercise_id')::uuid limit 1;
    stored_adjustments := stored_adjustments || jsonb_build_array(jsonb_build_object(
      'personal_key',(item->>'programmeKey') || ':' || ((item->>'exerciseId')::uuid)::text,
      'programme_key',item->>'programmeKey','exercise_id',(item->>'exerciseId')::uuid,'exercise_name',item->>'exercise',
      'load_adjustment_percent', (adjustment->>'load_adjustment_percent')::numeric,'set_adjustment',(adjustment->>'set_adjustment')::integer));
  end loop;
  expected_keys := '[]';
  for snapshot in select value from jsonb_array_elements(snapshots) loop
    item := app_private.personal_strength_review_plan(snapshot->'base_plan',stored_adjustments);
    perform app_private.validate_personal_programme_plan(item,true);
    expected_keys := expected_keys || jsonb_build_array(snapshot || jsonb_build_object('plan',item));
  end loop;
  if previous_id is not null then update public.programme_strength_week_reviews set status='resolved',resolved_at=now() where id=previous_id; end if;
  insert into public.programme_strength_week_reviews(program_assignment_id,person_id,previous_review_id,programme_week,start_workout_index,end_workout_index,workout_ids,recovery_level,recommendation_kind,applied_adjustments)
  values(a.id,a.person_id,previous_id,first_week,first_position,last_position,eligible,p_recovery_level,p_recommendation_kind,jsonb_build_array(jsonb_build_object('personal_sessions',expected_keys)) || stored_adjustments)
  returning id into review_id;
  return review_id;
end; $$;
revoke all on function public.apply_personal_strength_week_review(uuid,integer,jsonb,text,text,jsonb,uuid) from public, anon;
grant execute on function public.apply_personal_strength_week_review(uuid,integer,jsonb,text,text,jsonb,uuid) to authenticated;

-- An explicit edit clears temporary changes for the still-unstarted week.
-- Started targets remain in their existing suggested-workout snapshots.
create function app_private.expire_personal_strength_review_after_edit() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  update public.programme_strength_week_reviews r set status='superseded',resolved_at=now()
  where r.program_assignment_id=new.assignment_id and r.status='active' and exists(
    select 1 from jsonb_array_elements(r.applied_adjustments) metadata
    cross join lateral jsonb_array_elements(coalesce(metadata->'personal_sessions','[]'::jsonb)) snapshot
    where (snapshot->>'workout_id')::uuid=new.program_workout_id
  );
  return new;
end; $$;
revoke all on function app_private.expire_personal_strength_review_after_edit() from public, anon;
grant execute on function app_private.expire_personal_strength_review_after_edit() to authenticated;
create trigger expire_personal_strength_review_after_edit after update on public.personal_programme_sessions
for each row execute function app_private.expire_personal_strength_review_after_edit();

drop function public.start_personal_programme_session(uuid,uuid,integer,uuid,boolean);
create function public.start_personal_programme_session(p_assignment_id uuid, p_workout_id uuid, p_revision integer, p_location_id uuid, p_easier boolean default false, p_strength_review_id uuid default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare a public.program_assignments%rowtype; prescribed public.personal_programme_sessions%rowtype;
  working_plan jsonb; review_row public.programme_strength_week_reviews%rowtype; snapshot jsonb;
  current_id uuid; plan_id uuid; entry_id uuid; m jsonb; s jsonb; movement_index integer := 0; set_index integer; row_count integer; load numeric;
begin
  select * into a from public.program_assignments where id=p_assignment_id for update;
  if auth.uid() is null or a.id is null or a.status <> 'active' then raise exception 'Start or resume this programme first.'; end if;
  select id into current_id from public.program_workouts where program_id=a.program_id order by sequence_index,id offset a.current_workout_index limit 1;
  if current_id is distinct from p_workout_id then raise exception 'This is no longer the next programme session.'; end if;
  select * into prescribed from public.personal_programme_sessions where assignment_id=a.id and program_workout_id=current_id;
  if prescribed.program_workout_id is null or prescribed.revision is distinct from p_revision then raise exception 'The session changed. Refresh Today before starting.'; end if;
  working_plan := prescribed.plan;
  select * into review_row from public.programme_strength_week_reviews where program_assignment_id=a.id and status='active' and current_id=any(workout_ids);
  if review_row.id is not null then
    select snapshot_record.value into snapshot from jsonb_array_elements(review_row.applied_adjustments) metadata
      cross join lateral jsonb_array_elements(coalesce(metadata->'personal_sessions','[]'::jsonb)) snapshot_record(value)
      where (snapshot_record.value->>'workout_id')::uuid=current_id;
    if snapshot is not null and (snapshot->>'revision')::integer=prescribed.revision and snapshot->'base_plan'=prescribed.plan and snapshot->>'name'=prescribed.name and (snapshot->>'scheduled_date')::date=prescribed.scheduled_on then
      working_plan := app_private.personal_strength_review_plan(prescribed.plan,review_row.applied_adjustments);
    else review_row.id := null;
    end if;
  end if;
  if review_row.id is distinct from p_strength_review_id then raise exception 'The strength review changed. Refresh Today before starting.'; end if;
  perform app_private.validate_personal_programme_plan(working_plan,true);
  if exists (select 1 from public.suggested_workouts where program_assignment_id=a.id and program_workout_id=current_id and status in ('pending','accepted','completed','skipped')) then raise exception 'This programme session has already been started.'; end if;
  if not exists (select 1 from public.training_locations where id=p_location_id and kind in ('home','gym') and is_active and person_id=a.person_id and app_private.person_is_accessible(person_id)) then raise exception 'Choose an available training location.'; end if;
  insert into public.suggested_workouts(person_id,program_assignment_id,program_workout_id,training_location_id,status,title,basis,suggested_for)
  select a.person_id,a.id,current_id,p_location_id,'accepted',p.name || ' · ' || prescribed.name,
    case when p_easier then 'Personal programme · easier return: one fewer set where possible and about 10% lighter.' when review_row.id is not null then 'Approved personal strength-week targets. Your original prescriptions and progression rules are retained.' else 'Targets from your personal programme. Progression follows each exercise’s saved rule.' end,current_date
  from public.personal_programmes p where p.assignment_id=a.id returning id into plan_id;
  for m in select value from jsonb_array_elements(working_plan->'movements') loop
    insert into public.suggested_workout_entries(suggested_workout_id,exercise_id,name,workout_type,order_index,reason,tracking_mode,target_metrics)
    values(plan_id,(m->>'exerciseId')::uuid,m->>'exercise',m->>'workoutType',movement_index,m->>'reason',m->>'trackingMode',
      jsonb_build_object('rest_time',coalesce(m->>'restTime',''),'progression',m->'progression','programme_key',m->>'programmeKey','strength_review_id',review_row.id)) returning id into entry_id;
    movement_index := movement_index+1;
    set_index := 0;
    row_count := jsonb_array_length(m->'setRows');
    for s in select value from jsonb_array_elements(m->'setRows') loop
      set_index := set_index+1;
      if p_easier and row_count>1 and set_index=row_count then continue; end if;
      load := nullif(s->>'weight','')::numeric;
      if p_easier then load := round(load*0.9,2); end if;
      insert into public.suggested_workout_sets(suggested_workout_entry_id,set_number,reps,weight,duration_seconds,rpe,completed)
      values(entry_id,set_index,nullif(s->>'reps','')::numeric,load,nullif(s->>'durationSeconds','')::numeric,nullif(s->>'rpe','')::numeric,true);
    end loop;
  end loop;
  return plan_id;
end; $$;
revoke all on function public.start_personal_programme_session(uuid,uuid,integer,uuid,boolean,uuid) from public, anon;
grant execute on function public.start_personal_programme_session(uuid,uuid,integer,uuid,boolean,uuid) to authenticated;

notify pgrst, 'reload schema';
