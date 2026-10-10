-- Personal content is imported separately. No book prescriptions or demo rows are seeded.
create or replace function app_private.valid_kettlebell_prescription(p_plan jsonb)
returns boolean language plpgsql immutable security invoker set search_path = public, pg_temp as $$
declare m jsonb; s jsonb; b jsonb; k text; v text; idx jsonb; n integer;
begin
  if jsonb_typeof(p_plan) is distinct from 'object'
     or exists(select 1 from jsonb_object_keys(p_plan) key where key not in ('movements','methodBlocks'))
     or jsonb_typeof(p_plan->'movements') is distinct from 'array' then return false; end if;
  n := jsonb_array_length(p_plan->'movements');
  if n not between 1 and 50 then return false; end if;
  for m in select value from jsonb_array_elements(p_plan->'movements') loop
    if jsonb_typeof(m) is distinct from 'object'
       or exists(select 1 from jsonb_object_keys(m) key where key not in ('exerciseId','exercise','workoutType','trackingMode','targets','sourceDate','reason','restTime','setRows'))
       or length(btrim(m->>'exercise')) not between 1 and 200
       or (m->>'exerciseId') is null
       or (m->>'workoutType' in ('Strength','Conditioning')) is distinct from true
       or (m->>'trackingMode' in ('weight_reps','reps_only','hold','duration','conditioning','carry')) is distinct from true
       or (m->>'sourceDate' = '') is distinct from true
       or jsonb_typeof(m->'reason') is distinct from 'string'
       or length(m->>'reason') > 8000
       or jsonb_typeof(m->'targets') is distinct from 'object'
       or jsonb_typeof(m->'setRows') is distinct from 'array' then return false; end if;
    perform (m->>'exerciseId')::uuid;
    if (m->>'exercise') is null or jsonb_array_length(m->'setRows') not between 1 and 100 then return false; end if;
    foreach k in array array['durationMinutes','distance','rounds','height'] loop
      v := m->'targets'->>k;
      if jsonb_typeof(m->'targets'->k) is distinct from 'string'
         or (v <> '' and (v !~ '^\d+(\.\d+)?$' or v::numeric > 100000)) then return false; end if;
    end loop;
    if jsonb_typeof(m->'targets'->'detail') is distinct from 'string'
       or length(m->'targets'->>'detail') > 8000
       or jsonb_typeof(m->'targets'->'distanceUnit') is distinct from 'string' then return false; end if;
    for s in select value from jsonb_array_elements(m->'setRows') loop
      if jsonb_typeof(s) is distinct from 'object'
         or exists(select 1 from jsonb_object_keys(s) key where key not in ('reps','weight','durationSeconds','rpe','completed'))
         or jsonb_typeof(s->'completed') is distinct from 'boolean' then return false; end if;
      foreach k in array array['reps','weight','durationSeconds','rpe'] loop
        v := s->>k;
        if jsonb_typeof(s->k) is distinct from 'string'
           or length(v) > 32 or (v <> '' and (v !~ '^\d+(\.\d+)?$' or v::numeric > (case when k='rpe' then 10 when k='durationSeconds' then 86400 else 1000 end))) then return false; end if;
      end loop;
      if coalesce(nullif(s->>'reps','')::numeric,0) <= 0 and coalesce(nullif(s->>'durationSeconds','')::numeric,0) <= 0 then return false; end if;
    end loop;
  end loop;
  if p_plan ? 'methodBlocks' then
    if jsonb_typeof(p_plan->'methodBlocks') is distinct from 'array' or jsonb_array_length(p_plan->'methodBlocks') > 30 then return false; end if;
    for b in select value from jsonb_array_elements(p_plan->'methodBlocks') loop
      if jsonb_typeof(b) is distinct from 'object'
         or (b->>'family' in ('exercise_group','timed_density')) is distinct from true
         or coalesce(length(b->>'methodName'),0) not between 1 and 200
         or jsonb_typeof(b->'memberMovementIndexes') is distinct from 'array'
         or jsonb_typeof(b->'config') is distinct from 'object' then return false; end if;
      perform (b->>'trainingMethodId')::uuid;
      if b->>'trainingMethodId' is null then return false; end if;
      if jsonb_array_length(b->'memberMovementIndexes') < (case when b->>'family'='exercise_group' then 2 else 1 end)
         or (select count(distinct value) from jsonb_array_elements(b->'memberMovementIndexes')) <> jsonb_array_length(b->'memberMovementIndexes') then return false; end if;
      for idx in select value from jsonb_array_elements(b->'memberMovementIndexes') loop
        if jsonb_typeof(idx) <> 'number' or idx::text !~ '^\d+$' or idx::text::integer >= n then return false; end if;
      end loop;
      foreach k in array array['rounds','restBetweenMovementsSeconds','restBetweenRoundsSeconds','blockDurationMinutes','workIntervalSeconds','restIntervalSeconds'] loop
        v := b->>k;
        if jsonb_typeof(b->k) is distinct from 'string' or length(v)>32
           or (v <> '' and (v !~ '^\d+(\.\d+)?$' or v::numeric > 86400)) then return false; end if;
      end loop;
    end loop;
  end if;
  return true;
exception when others then return false;
end;
$$;
revoke all on function app_private.valid_kettlebell_prescription(jsonb) from public, anon;
grant execute on function app_private.valid_kettlebell_prescription(jsonb) to authenticated;

create table public.kettlebell_workouts (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  collection_key text not null default 'strong_on' check (collection_key = 'strong_on'),
  category text not null check (category in ('strength','muscle','conditioning')),
  source_number integer not null check (source_number > 0),
  title text not null check (length(btrim(title)) between 1 and 200),
  summary text not null default '' check (length(summary) <= 2000),
  instructions text not null check (length(btrim(instructions)) between 1 and 16000),
  source_reference text not null default '' check (length(source_reference) <= 500),
  bell_count integer not null check (bell_count in (1,2)),
  required_equipment_ids uuid[] not null default '{}',
  duration_minutes numeric check (duration_minutes > 0 and duration_minutes <= 20),
  version integer not null default 1 check (version > 0),
  verified boolean not null default false,
  is_available boolean not null default false,
  prescription jsonb not null check (app_private.valid_kettlebell_prescription(prescription)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id, collection_key, category, source_number)
);
alter table public.kettlebell_workouts enable row level security;
revoke all on public.kettlebell_workouts from anon;
grant select, insert, update, delete on public.kettlebell_workouts to authenticated;
create policy kettlebell_workouts_access on public.kettlebell_workouts to authenticated
using (app_private.person_is_accessible(person_id))
with check (app_private.person_is_accessible(person_id));

create function app_private.version_kettlebell_workout() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if new.id <> old.id or new.person_id <> old.person_id then raise exception 'Workout ownership cannot be changed.'; end if;
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;
create trigger kettlebell_workout_version before update on public.kettlebell_workouts
for each row execute function app_private.version_kettlebell_workout();
revoke all on function app_private.version_kettlebell_workout() from public, anon;
grant execute on function app_private.version_kettlebell_workout() to authenticated;

alter table public.suggested_workouts
add column kettlebell_workout_id uuid references public.kettlebell_workouts(id) on delete restrict,
add column kettlebell_snapshot jsonb,
add column kettlebell_request_id uuid;
alter table public.suggested_workouts add constraint kettlebell_sessions_standalone check (
  (kettlebell_workout_id is null and kettlebell_snapshot is null and kettlebell_request_id is null)
  or (kettlebell_workout_id is not null and kettlebell_snapshot is not null and kettlebell_request_id is not null
      and program_assignment_id is null and program_workout_id is null and goal_id is null and mobility_practice_run_id is null)
);
create unique index kettlebell_session_request_unique
on public.suggested_workouts(person_id,kettlebell_request_id) where kettlebell_request_id is not null;

create function public.start_kettlebell_workout(
  p_workout_id uuid, p_expected_version integer, p_location_id uuid,
  p_bell_count integer, p_request_id uuid, p_suggested_for date
) returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare w public.kettlebell_workouts%rowtype; l public.training_locations%rowtype;
  saved public.suggested_workouts%rowtype; plan_id uuid; m jsonb; s jsonb; b jsonb;
  e_id uuid; b_id uuid; entry_ids uuid[] := '{}'; i integer := 0; j integer; idx jsonb; source text;
begin
  if auth.uid() is null or p_request_id is null or p_suggested_for is null
     or p_bell_count is null or p_bell_count not in (1,2) then raise exception 'Choose a valid workout and location.'; end if;
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
revoke all on function public.start_kettlebell_workout(uuid,integer,uuid,integer,uuid,date) from public,anon;
grant execute on function public.start_kettlebell_workout(uuid,integer,uuid,integer,uuid,date) to authenticated;
