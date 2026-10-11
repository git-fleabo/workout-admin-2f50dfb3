-- Weight variety is independent of how many bells are lifted simultaneously.
alter table public.kettlebell_workouts add column required_bell_weights integer not null default 1 check (required_bell_weights in (1,3));
drop function public.start_kettlebell_workout(uuid,integer,uuid,integer,uuid,date);
create function public.start_kettlebell_workout(
  p_workout_id uuid, p_expected_version integer, p_location_id uuid,
  p_bell_count integer, p_request_id uuid, p_suggested_for date, p_bell_weight_count integer default 1
) returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare w public.kettlebell_workouts%rowtype; l public.training_locations%rowtype;
  saved public.suggested_workouts%rowtype; plan_id uuid; m jsonb; s jsonb; b jsonb;
  e_id uuid; b_id uuid; entry_ids uuid[] := '{}'; i integer := 0; j integer; idx jsonb; source text;
begin
  if auth.uid() is null or p_request_id is null or p_suggested_for is null
     or p_bell_count is null or p_bell_count not in (1,2)
     or p_bell_weight_count is null or p_bell_weight_count not in (1,3) then raise exception 'Choose a valid workout and location.'; end if;
  select * into w from public.kettlebell_workouts where id=p_workout_id for share;
  if not found then raise exception 'This kettlebell workout is unavailable.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(w.person_id::text||p_request_id::text,0));
  select * into saved from public.suggested_workouts where person_id=w.person_id and kettlebell_request_id=p_request_id;
  if found then
    if saved.kettlebell_workout_id <> p_workout_id or saved.training_location_id <> p_location_id then raise exception 'This selection has already been started.'; end if;
    if saved.status <> 'accepted' then raise exception 'This workout has already been completed or cancelled.'; end if;
    return saved.id;
  end if;
  if not w.verified or not w.is_available then raise exception 'This kettlebell workout is unavailable.'; end if;
  if w.version is distinct from p_expected_version then raise exception 'This workout changed. Choose it again before starting.'; end if;
  select * into l from public.training_locations where id=p_location_id and person_id=w.person_id and is_active and kind in ('home','gym') for share;
  if not found then raise exception 'Choose an available training location.'; end if;
  if p_bell_weight_count < w.required_bell_weights then
    raise exception 'This chain requires light, medium and heavy kettlebells.';
  end if;
  if p_bell_count < w.bell_count or not exists (
    select 1 from public.training_location_equipment a join public.equipment_items e on e.id=a.equipment_item_id
    where a.location_id=l.id and e.person_id=w.person_id and e.is_active and e.circuit_group='kettlebell'
  ) or exists (
    select 1 from unnest(w.required_equipment_ids) required_id where not exists (
      select 1 from public.training_location_equipment a join public.equipment_items e on e.id=a.equipment_item_id
      where a.location_id=l.id and e.id=required_id and e.person_id=w.person_id and e.is_active
    )
  ) then raise exception 'This location does not have the required equipment.'; end if;
  for m in select value from jsonb_array_elements(w.prescription->'movements') loop
    if not exists (
      select 1 from public.exercises e join public.person_exercises pe on pe.exercise_id=e.id
      where e.id=(m->>'exerciseId')::uuid and e.is_active and pe.person_id=w.person_id and pe.is_enabled
    ) then raise exception 'Enable the required exercises before starting this workout.'; end if;
  end loop;
  source := 'Strong ON! · '||w.category||' '||w.source_number||' · '||w.source_reference;
  insert into public.suggested_workouts(person_id,training_location_id,status,title,basis,suggested_for,plan_kind,
    kettlebell_workout_id,kettlebell_request_id,kettlebell_snapshot)
  values(w.person_id,l.id,'accepted',w.title||' · Strong ON! '||w.category||' '||w.source_number,
    source||'. Standalone kettlebell workout.',p_suggested_for,
    case when w.category='conditioning' then 'conditioning' else 'strength' end,
    w.id,p_request_id,to_jsonb(w)) returning id into plan_id;
  for m in select value from jsonb_array_elements(w.prescription->'movements') loop
    insert into public.suggested_workout_entries(suggested_workout_id,exercise_id,name,workout_type,order_index,reason,tracking_mode,target_metrics)
    values(plan_id,(m->>'exerciseId')::uuid,m->>'exercise',m->>'workoutType',i,
      source||case when i=0 then E'\n\n'||w.instructions else '' end||E'\n\n'||(m->>'reason'),m->>'trackingMode',
      jsonb_strip_nulls(jsonb_build_object(
        'duration_minutes',nullif(m->'targets'->>'durationMinutes','')::numeric,
        'distance',nullif(m->'targets'->>'distance','')::numeric,
        'distance_unit',nullif(m->'targets'->>'distanceUnit',''),
        'rounds',nullif(m->'targets'->>'rounds','')::numeric,
        'height',nullif(m->'targets'->>'height','')::numeric,
        'detail',m->'targets'->>'detail','rest_time',m->>'restTime'
      ))) returning id into e_id;
    entry_ids := array_append(entry_ids,e_id);
    i := i+1; j := 1;
    for s in select value from jsonb_array_elements(m->'setRows') loop
      insert into public.suggested_workout_sets(suggested_workout_entry_id,set_number,reps,weight,duration_seconds,rpe,completed)
      values(e_id,j,nullif(s->>'reps','')::numeric,nullif(s->>'weight','')::numeric,
        nullif(s->>'durationSeconds','')::numeric,nullif(s->>'rpe','')::numeric,false);
      j := j+1;
    end loop;
  end loop;
  i := 0;
  for b in select value from jsonb_array_elements(coalesce(w.prescription->'methodBlocks','[]'::jsonb)) loop
    if not exists(select 1 from public.training_methods where id=(b->>'trainingMethodId')::uuid and is_active
      and family=b->>'family' and (person_id is null or person_id=w.person_id)) then raise exception 'A required training method is unavailable.'; end if;
    insert into public.suggested_workout_method_blocks(suggested_workout_id,training_method_id,method_name,family,order_index,rounds,
      rest_between_movements_seconds,rest_between_rounds_seconds,block_duration_seconds,work_interval_seconds,rest_interval_seconds,config)
    values(plan_id,(b->>'trainingMethodId')::uuid,b->>'methodName',b->>'family',i,nullif(b->>'rounds','')::integer,
      nullif(b->>'restBetweenMovementsSeconds','')::integer,nullif(b->>'restBetweenRoundsSeconds','')::integer,
      round(nullif(b->>'blockDurationMinutes','')::numeric*60)::integer,nullif(b->>'workIntervalSeconds','')::integer,
      nullif(b->>'restIntervalSeconds','')::integer,b->'config') returning id into b_id;
    i := i+1; j := 0;
    for idx in select value from jsonb_array_elements(b->'memberMovementIndexes') loop
      insert into public.suggested_workout_method_block_entries(block_id,suggested_workout_entry_id,sequence_index)
      values(b_id,entry_ids[idx::text::integer+1],j); j := j+1;
    end loop;
  end loop;
  return plan_id;
end;
$$;
revoke all on function public.start_kettlebell_workout(uuid,integer,uuid,integer,uuid,date,integer) from public,anon;
grant execute on function public.start_kettlebell_workout(uuid,integer,uuid,integer,uuid,date,integer) to authenticated;
