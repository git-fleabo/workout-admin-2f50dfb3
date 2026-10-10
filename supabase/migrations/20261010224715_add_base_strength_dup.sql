-- Additive sequence scaffolds only: no personal exercises, assignments or history.
-- One to four repeated three-week base waves, followed by one three-week peak wave.
do $$
declare weeks integer; program_id uuid; position integer;
begin
  for weeks in 6..15 by 3 loop
    program_id:=md5('base-strength:dup:' || weeks)::uuid;
    insert into public.programs(id,name,description,is_template,method_type,duration_weeks,sessions_per_week,percent_base,rounding_increment)
    values(program_id,'DUP','Personal starting structure from Alex Bromley, Base Strength. Set up through Explore Base Strength.',true,'base_strength_dup',weeks,3,'estimated_1rm',2.5);
    for position in 0..weeks*3-1 loop
      insert into public.program_workouts(id,program_id,name,sequence_index,week_number,day_number,session_number)
      values(md5(program_id::text || ':' || position)::uuid,program_id,'Week ' || (position/3+1) || ' · Session ' || (position%3+1),position,position/3+1,(array[1,3,5])[position%3+1],position%3+1);
    end loop;
  end loop;
end; $$;

-- Extend existing invoker guards without changing the older programme rules.
create or replace function app_private.pause_new_base_strength_run() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.status='active' and exists(select 1 from public.programs where id=new.program_id and method_type in ('base_strength_bullmastiff','base_strength_volume_intensity','base_strength_dup')) then new.status:='paused'; end if;
  return new;
end; $$;
revoke all on function app_private.pause_new_base_strength_run() from public, anon;
grant execute on function app_private.pause_new_base_strength_run() to authenticated;

create or replace function app_private.validate_base_strength_session() returns trigger
language plpgsql security invoker set search_path='' as $$
declare m jsonb; r jsonb; field text; method text; restarted boolean; movements jsonb; expected_reps integer; expected_sets integer; top_load numeric; back_load numeric;
begin
  if not (new.plan ? 'baseStrength') then return new; end if;
  select p.method_type into method from public.program_assignments a join public.programs p on p.id=a.program_id where a.id=new.assignment_id;
  if new.plan->>'baseStrength' not in ('bullmastiff','volume_intensity','dup') or method is distinct from 'base_strength_' || (new.plan->>'baseStrength') then
    raise exception 'Check the Base Strength programme identity.';
  end if;
  select previous_assignment_id is not null into restarted from public.program_assignments where id=new.assignment_id;
  if tg_op='INSERT' and restarted then
    select jsonb_agg(case when value ? 'baseStrength' then
      jsonb_set(case when ((value->'baseStrength'->>'programme'='bullmastiff' and value->'baseStrength'->>'role'='main' and value->'baseStrength'->>'waveWeek' in ('2','3')) or (value->'baseStrength'->>'programme'='dup' and value->'baseStrength'->>'phase'='peak' and value->'baseStrength'->>'role'='main')) and value->'progression'->>'type'='source' then
        jsonb_set(value,'{setRows}',(select jsonb_agg(jsonb_set(s,'{weight}','""'::jsonb)) from jsonb_array_elements(value->'setRows') s))
        else value end,'{baseStrength}',(value->'baseStrength')-'approvedFingerprint') else value end order by n)
      into movements from jsonb_array_elements(new.plan->'movements') with ordinality movement(value,n);
    new.plan:=jsonb_set(new.plan,'{movements}',movements);
  end if;
  for m in select value from jsonb_array_elements(new.plan->'movements') loop
    if not (m ? 'baseStrength') then continue; end if;
    r:=m->'baseStrength';
    if r->>'programme' is distinct from new.plan->>'baseStrength' or coalesce(r->>'phase','') not in ('base','build','peak')
      or coalesce(r->>'role','') not in ('main','variation','accessory') or jsonb_typeof(r->'plusLastSet') is distinct from 'boolean' then
      raise exception 'Check the saved Base Strength rules.';
    end if;
    foreach field in array array['week','wave','waveWeek','incrementKg'] loop
      if jsonb_typeof(r->field) is distinct from 'number' or coalesce(r->>field,'') !~ '^\d+(\.\d+)?$' or (r->>field)::numeric<=0 then
        raise exception 'Check the saved wave and load increment.';
      end if;
    end loop;
    if (r->>'week')::numeric not between 1 and 30 or (r->>'week')::numeric<>trunc((r->>'week')::numeric)
      or (r->>'wave')::numeric not between 1 and 4 or (r->>'wave')::numeric<>trunc((r->>'wave')::numeric)
      or (r->>'waveWeek')::numeric not between 1 and 3 or (r->>'waveWeek')::numeric<>trunc((r->>'waveWeek')::numeric)
      or (r->>'incrementKg')::numeric>100 then raise exception 'Check the saved wave and load increment.'; end if;
    foreach field in array array['referenceMax','percent'] loop
      if not (r ? field) or (r->field <> 'null'::jsonb and
        (jsonb_typeof(r->field) is distinct from 'number' or coalesce(r->>field,'') !~ '^\d+(\.\d+)?$' or (r->>field)::numeric<=0 or (r->>field)::numeric>case when field='percent' then 100 else 1000 end)) then
        raise exception 'Use a positive reference max and percentage, or leave them blank for review.';
      end if;
    end loop;
    if r->>'programme'='dup' then
      if r->>'phase' not in ('base','peak') or r->>'role' not in ('main','accessory') or r->>'plusLastSet'<>'false'
        or r ? 'approvedFingerprint' then raise exception 'Check the saved DUP rules.'; end if;
      if r ? 'backOffPercent' and (r->'backOffPercent' is distinct from '90'::jsonb or r->>'phase'<>'peak' or r->>'role'<>'main') then
        raise exception 'DUP back-off sets require a peak main lift at 90%% of the top-set load.';
      end if;
      if r->>'role'='main' and m->'progression'->>'type'='source' then
        if coalesce(r->>'exposure','') not in ('high','medium','low') or m->>'trackingMode'<>'weight_reps' then raise exception 'Check the DUP exposure and tracking.'; end if;
        if r->>'phase'='peak' then
          if r->'backOffPercent' is distinct from '90'::jsonb or r->'percent' <> 'null'::jsonb then raise exception 'Choose DUP peak loads by RPE.'; end if;
          expected_reps:=case r->>'exposure' when 'high' then 6 when 'medium' then 3 else 1 end;
          expected_sets:=(case r->>'exposure' when 'high' then 3 else 5 end)-(r->>'waveWeek')::integer+2;
          if jsonb_array_length(m->'setRows')<>expected_sets or exists(select 1 from jsonb_array_elements(m->'setRows') s where nullif(s->>'reps','')::numeric is distinct from expected_reps::numeric)
            or nullif(m->'setRows'->0->>'rpe','')::numeric is distinct from (6+(r->>'waveWeek')::integer)::numeric then
            raise exception 'Keep the DUP peak sets, reps and RPE target, or choose personal progression to change them.';
          end if;
          top_load:=nullif(m->'setRows'->0->>'weight','')::numeric;
          back_load:=round(top_load*0.9/(r->>'incrementKg')::numeric)*(r->>'incrementKg')::numeric;
          if (top_load is not null and (top_load<=0 or back_load<=0)) or exists(select 1 from jsonb_array_elements(m->'setRows') with ordinality s(value,n) where n>1 and nullif(value->>'weight','')::numeric is distinct from back_load) then
            raise exception 'Recalculate DUP back-off loads from the selected top-set load before saving.';
          end if;
        end if;
      end if;
    end if;
    if r ? 'approvedFingerprint' and coalesce(r->>'approvedFingerprint','') !~ '^[a-f0-9]{32}$' then raise exception 'Check the progression approval.'; end if;
  end loop;
  return new;
end; $$;
revoke all on function app_private.validate_base_strength_session() from public, anon;
grant execute on function app_private.validate_base_strength_session() to authenticated;

create or replace function public.change_programme_run(
  p_assignment_id uuid,
  p_action text,
  p_started_on date default current_date
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source public.program_assignments%rowtype;
  next_id uuid;
begin
  if p_action is null or p_action not in ('restart', 'end') then
    raise exception 'Choose restart or end.';
  end if;

  select assignment.* into source
  from public.program_assignments assignment
  where assignment.id = p_assignment_id
  for update;

  if not found or source.status not in ('active','paused','complete') or (p_action = 'end' and source.status = 'complete') then
    raise exception 'The active programme could not be found.';
  end if;

  if p_action = 'restart' and p_started_on is null then
    raise exception 'Choose a start date for the new run.';
  end if;

  update public.suggested_workouts
  set status = 'archived'
  where program_assignment_id = source.id
    and status in ('pending', 'accepted');

  update public.program_assignments
  set status = 'archived'
  where id = source.id;

  if p_action = 'end' then
    return source.id;
  end if;

  insert into public.program_assignments (
    program_id, person_id, assigned_by_person_id, status,
    current_workout_index, started_on, cycle_number,
    previous_assignment_id, notes
  ) values (
    source.program_id, source.person_id, source.assigned_by_person_id,
    case when exists(select 1 from public.personal_programmes where assignment_id=source.id) then 'paused' else 'active' end,
    0, p_started_on, source.cycle_number + 1,
    source.id, source.notes
  ) returning id into next_id;

  insert into public.program_assignment_exercises (
    program_assignment_id, slot_key, exercise_id, exercise_name,
    training_max, is_enabled, load_adjustment_percent,
    manual_adjustment_percent, last_decision
  )
  select next_id, slot_key, exercise_id, exercise_name,
         training_max, is_enabled, 0, 0, null
  from public.program_assignment_exercises
  where program_assignment_id = source.id;

  insert into public.program_assignment_exercise_pools (
    program_assignment_id, role, exercise_id, exercise_name, is_enabled
  )
  select next_id, role, exercise_id, exercise_name, is_enabled
  from public.program_assignment_exercise_pools
  where program_assignment_id = source.id;

  if exists (select 1 from public.personal_programmes where assignment_id=source.id) then
    insert into public.personal_programmes(assignment_id,name) select next_id,name from public.personal_programmes where assignment_id=source.id;
    insert into public.personal_programme_sessions(assignment_id,program_workout_id,name,scheduled_on,plan)
    select next_id,program_workout_id,name,scheduled_on + (p_started_on-source.started_on),plan
    from public.personal_programme_sessions where assignment_id=source.id;
    -- Source programmes need a fresh review; ordinary personal restarts retain their existing behaviour.
    if not exists(select 1 from public.programs where id=source.program_id and method_type in ('base_strength_bullmastiff','base_strength_volume_intensity','base_strength_dup')) then
      update public.program_assignments set status='active' where id=next_id;
    end if;
  end if;
  return next_id;
end;
$$;

revoke all on function public.change_programme_run(uuid, text, date) from public;
revoke all on function public.change_programme_run(uuid, text, date) from anon;
grant execute on function public.change_programme_run(uuid, text, date) to authenticated;


notify pgrst, 'reload schema';
