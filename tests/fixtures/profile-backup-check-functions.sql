-- Exact pure JSON-check helper functions for the column/constraint snapshot.
create schema app_private;
CREATE OR REPLACE FUNCTION app_private.valid_kettlebell_prescription(p_plan jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
