-- Shared, non-personal sequence scaffolds. Prescriptions and exercise choices live in
-- the existing person-scoped personal_programme_sessions, saved paused by the existing RPC.
do $$
declare method text; weeks integer; days integer; program_id uuid; position integer;
begin
  foreach method in array array['volume_intensity','bullmastiff'] loop
    for weeks in 18..30 by 3 loop
      if method='bullmastiff' and weeks<>18 then continue; end if;
      days := case when method='bullmastiff' then 4 else 3 end;
      program_id := md5('base-strength:' || method || ':' || weeks)::uuid;
      insert into public.programs(id,name,description,is_template,method_type,duration_weeks,sessions_per_week,percent_base,rounding_increment)
      values(program_id,case when method='bullmastiff' then 'Bullmastiff' else 'Volume/Intensity' end,
        'Personal starting structure from Alex Bromley, Base Strength. Set up through Explore Base Strength.',true,
        'base_strength_' || method,weeks,days,'estimated_1rm',2.5);
      for position in 0..weeks*days-1 loop
        insert into public.program_workouts(id,program_id,name,sequence_index,week_number,day_number,session_number)
        values(md5(program_id::text || ':' || position)::uuid,program_id,'Week ' || (position/days+1) || ' · Session ' || (position%days+1),
          position,position/days+1,case when days=4 then (array[1,2,4,5])[position%days+1] else (array[1,3,5])[position%days+1] end,position%days+1);
      end loop;
    end loop;
  end loop;
end; $$;

-- New runs, including restarts, require an explicit start after personal review.
create function app_private.pause_new_base_strength_run() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.status='active' and exists(select 1 from public.programs where id=new.program_id and method_type in ('base_strength_bullmastiff','base_strength_volume_intensity')) then new.status:='paused'; end if;
  return new;
end; $$;
revoke all on function app_private.pause_new_base_strength_run() from public, anon;
grant execute on function app_private.pause_new_base_strength_run() to authenticated;
create trigger pause_new_base_strength_run before insert on public.program_assignments for each row execute function app_private.pause_new_base_strength_run();

create function app_private.validate_base_strength_session() returns trigger
language plpgsql security invoker set search_path='' as $$
declare m jsonb; r jsonb; field text; method text; restarted boolean; movements jsonb;
begin
  if not (new.plan ? 'baseStrength') then return new; end if;
  select p.method_type into method from public.program_assignments a join public.programs p on p.id=a.program_id where a.id=new.assignment_id;
  if new.plan->>'baseStrength' not in ('bullmastiff','volume_intensity') or method is distinct from 'base_strength_' || (new.plan->>'baseStrength') then
    raise exception 'Check the Base Strength programme identity.';
  end if;
  select previous_assignment_id is not null into restarted from public.program_assignments where id=new.assignment_id;
  if tg_op='INSERT' and restarted then
    select jsonb_agg(case when value ? 'baseStrength' then
      jsonb_set(case when value->'baseStrength'->>'programme'='bullmastiff' and value->'baseStrength'->>'role'='main' and value->'baseStrength'->>'waveWeek' in ('2','3') and value->'progression'->>'type'='source' then
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
    if r ? 'approvedFingerprint' and coalesce(r->>'approvedFingerprint','') !~ '^[a-f0-9]{32}$' then raise exception 'Check the progression approval.'; end if;
  end loop;
  return new;
end; $$;
revoke all on function app_private.validate_base_strength_session() from public, anon;
grant execute on function app_private.validate_base_strength_session() to authenticated;
create trigger validate_base_strength_session before insert or update on public.personal_programme_sessions
for each row execute function app_private.validate_base_strength_session();

-- The review reads only the preceding linked programme exposure, never a standalone
-- log, supporting workout, earlier run or matching exercise name. No writes here.
create function public.review_base_strength_progression(p_assignment_id uuid,p_workout_id uuid,p_programme_key text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.program_assignments%rowtype; target public.personal_programme_sessions%rowtype;
  previous public.personal_programme_sessions%rowtype; m jsonb; source_m jsonb; rule jsonb; source_rule jsonb;
  linked public.suggested_workouts%rowtype; expected_entry public.suggested_workout_entries%rowtype;
  actual public.session_entries%rowtype; sets jsonb; planned jsonb; fingerprint text; result jsonb;
  matches integer; expected integer; source_index integer; load numeric; reps numeric; reference_max numeric; increment numeric; next_load numeric; extra numeric;
begin
  select * into a from public.program_assignments where id=p_assignment_id;
  if auth.uid() is null or a.id is null or not app_private.person_is_accessible(a.person_id) then raise exception 'This programme is not accessible.'; end if;
  select * into target from public.personal_programme_sessions where assignment_id=a.id and program_workout_id=p_workout_id;
  select value into m from jsonb_array_elements(target.plan->'movements') where value->>'programmeKey'=p_programme_key;
  rule:=m->'baseStrength';
  result:=jsonb_build_object('kind','review','load',null,'revision',target.revision,'fingerprint','');
  if a.status not in ('active','paused') or target.program_workout_id is null or
    app_private.programme_workout_position(p_workout_id)<a.current_workout_index or
    exists(select 1 from public.suggested_workouts where program_assignment_id=a.id and program_workout_id=p_workout_id and status in ('pending','accepted','completed','skipped')) then
    return result || jsonb_build_object('detail','Only an unstarted future session can receive a load decision.');
  end if;
  if rule->>'programme' is distinct from 'bullmastiff' or rule->>'role' is distinct from 'main' or m->'progression'->>'type' is distinct from 'source' then
    return result || jsonb_build_object('detail','Follow this session’s saved targets or review them in the editor.');
  end if;
  select count(*) into matches from public.personal_programme_sessions s cross join lateral jsonb_array_elements(s.plan->'movements') movement
  where s.assignment_id=a.id and movement->>'programmeKey'=p_programme_key and movement->'baseStrength'->>'week'=(((rule->>'week')::integer)-1)::text;
  if matches<>1 then return result || jsonb_build_object('detail','Complete the preceding programme week for this lift before reviewing progression.'); end if;
  select s.* into previous from public.personal_programme_sessions s
    cross join lateral jsonb_array_elements(s.plan->'movements') movement(value)
    where s.assignment_id=a.id and movement.value->>'programmeKey'=p_programme_key and movement.value->'baseStrength'->>'week'=(((rule->>'week')::integer)-1)::text;
  select value into source_m from jsonb_array_elements(previous.plan->'movements') where value->>'programmeKey'=p_programme_key;
  source_rule:=source_m->'baseStrength';
  if source_m->>'exerciseId' is distinct from m->>'exerciseId' or source_rule->>'role' is distinct from 'main' or source_rule->>'programme' is distinct from 'bullmastiff'
    or source_m->'progression'->>'type' is distinct from 'source' then
    return result || jsonb_build_object('detail','The exercise or progression rule changed. Review the starting load for this choice.');
  end if;
  select count(*) into matches from public.suggested_workouts where program_assignment_id=a.id and program_workout_id=previous.program_workout_id and status='completed';
  if matches<>1 then return result || jsonb_build_object('detail','Complete the preceding linked programme session first.'); end if;
  select * into linked from public.suggested_workouts where program_assignment_id=a.id and program_workout_id=previous.program_workout_id and status='completed';
  if not exists(select 1 from public.sessions where id=linked.completed_session_id and person_id=a.person_id and completed) then
    return result || jsonb_build_object('detail','The linked workout log is incomplete.');
  end if;
  select count(*) into matches from public.suggested_workout_entries e where e.suggested_workout_id=linked.id and e.target_metrics->>'programme_key'=p_programme_key and e.exercise_id=(m->>'exerciseId')::uuid;
  if matches<>1 then return result || jsonb_build_object('detail','The original programme prescription could not be matched.'); end if;
  select * into expected_entry from public.suggested_workout_entries e where e.suggested_workout_id=linked.id and e.target_metrics->>'programme_key'=p_programme_key and e.exercise_id=(m->>'exerciseId')::uuid;
  source_index:=expected_entry.order_index;
  select count(*) into matches from public.session_entries where session_id=linked.completed_session_id and exercise_id=expected_entry.exercise_id and order_index=source_index;
  if matches<>1 then return result || jsonb_build_object('detail','Match the actual sets to this programme movement before calculating progression.'); end if;
  select * into actual from public.session_entries where session_id=linked.completed_session_id and exercise_id=expected_entry.exercise_id and order_index=source_index;
  select jsonb_agg(to_jsonb(s) || jsonb_build_object('segments',(select coalesce(jsonb_agg(to_jsonb(segment) order by segment.id),'[]'::jsonb) from public.entry_set_segments segment where segment.entry_set_id=s.id)) order by s.set_number,s.id)
    into sets from public.entry_sets s where s.session_entry_id=actual.id;
  select jsonb_agg(to_jsonb(s) order by s.set_number,s.id) into planned from public.suggested_workout_sets s where s.suggested_workout_entry_id=expected_entry.id;
  expected:=jsonb_array_length(source_m->'setRows');
  fingerprint:=md5(jsonb_build_object('linked',to_jsonb(linked),'entry',to_jsonb(expected_entry),'actual',to_jsonb(actual),'sets',sets,'planned',planned,'source',source_m,
    'targetRule',rule-'approvedFingerprint','exercise',m->>'exerciseId','targetReps',(select jsonb_agg(value->>'reps') from jsonb_array_elements(m->'setRows')))::text);
  result:=result || jsonb_build_object('fingerprint',fingerprint,'previousSessionId',linked.completed_session_id);
  if expected_entry.target_metrics->'base_strength' is distinct from source_rule or actual.completed is not true or coalesce(jsonb_array_length(sets),0)<>expected or coalesce(jsonb_array_length(planned),0)<>expected
    or exists(select 1 from jsonb_array_elements(sets) s where s->>'completed'<>'true' or s->>'data_shape' is distinct from 'individual'
      or coalesce((s->>'aggregate_set_count')::integer,1)<>1 or coalesce(s->>'load_semantics','') not in ('total_external_load','per_implement_load','combined_implement_load','added_bodyweight_load')
      or nullif(s->>'reps','') is null or (s->>'reps')::numeric<>trunc((s->>'reps')::numeric) or (s->>'reps')::numeric<0 or (s->>'reps')::numeric>1000
      or nullif(s->>'weight','') is null or (s->>'weight')::numeric<=0 or jsonb_array_length(s->'segments')<>0)
    or (select count(distinct value->>'load_semantics') from jsonb_array_elements(sets))<>1
    or (select count(distinct (value->>'weight')::numeric) from jsonb_array_elements(sets))<>1
    or exists(select 1 from jsonb_array_elements(sets) with ordinality s(value,n) where (s.value->>'set_number')::integer<>s.n)
    or exists(select 1 from jsonb_array_elements(planned) with ordinality s(value,n) where (s.value->>'set_number')::integer<>s.n
      or (s.value->>'reps')::numeric is distinct from nullif(source_m->'setRows'->(s.n::integer-1)->>'reps','')::numeric
      or (s.value->>'weight')::numeric is distinct from nullif(source_m->'setRows'->(s.n::integer-1)->>'weight','')::numeric)
    or coalesce(expected_entry.target_metrics->>'strength_review_id','')<>'' then
    return result || jsonb_build_object('detail','Use every prescribed working set with comparable individual loads. Easier, adjusted, incomplete or special-method workouts need a separate review.');
  end if;
  if exists(select 1 from jsonb_array_elements(sets) with ordinality s(value,n) where
    (s.value->>'reps')::numeric < nullif(source_m->'setRows'->(s.n::integer-1)->>'reps','')::numeric) then
    return result || jsonb_build_object('detail','A working set missed its rep target. Review the load and recovery before increasing.');
  end if;
  load:=(sets->0->>'weight')::numeric; reps:=(sets->(expected-1)->>'reps')::numeric;
  increment:=(rule->>'incrementKg')::numeric;
  result:=result || jsonb_build_object('previousLoad',load,'previousReps',reps);
  if (rule->>'waveWeek')::integer=1 then
    if source_rule->>'waveWeek' is distinct from '3' or not (
      (rule->>'phase'=source_rule->>'phase' and (rule->>'wave')::integer=(source_rule->>'wave')::integer+1)
      or (source_rule->>'phase'='base' and source_rule->>'wave'='3' and rule->>'phase'='peak' and rule->>'wave'='1')) then
      return result || jsonb_build_object('detail','The wave order changed. Review this starting load separately.');
    end if;
    reference_max:=nullif(rule->>'referenceMax','')::numeric;
    if reference_max is null or nullif(rule->>'percent','') is null then return result || jsonb_build_object('detail','Reassess and enter this phase’s estimated max before choosing the next wave’s starting load.'); end if;
    next_load:=round(reference_max*(rule->>'percent')::numeric/100/increment)*increment;
    return result || jsonb_build_object('kind','reset','load',next_load,'detail','Reset to ' || (rule->>'percent') || '% of this phase’s estimated max. Plus-set increases do not carry across waves.');
  end if;
  if rule->>'phase' is distinct from source_rule->>'phase' or rule->>'wave' is distinct from source_rule->>'wave'
    or (rule->>'waveWeek')::integer<>(source_rule->>'waveWeek')::integer+1 or source_rule->>'plusLastSet' is distinct from 'true'
    or nullif(rule->>'referenceMax','')::numeric is distinct from nullif(source_rule->>'referenceMax','')::numeric then
    return result || jsonb_build_object('detail','The wave or reference max changed. Review the starting load rather than carrying a plus-set increase.');
  end if;
  reference_max:=nullif(source_rule->>'referenceMax','')::numeric;
  if reference_max is null or nullif(source_m->'setRows'->(expected-1)->>'reps','') is null then return result || jsonb_build_object('detail','Enter a reference max and prescribed rep target first.'); end if;
  extra:=reps-(source_m->'setRows'->(expected-1)->>'reps')::numeric;
  next_load:=case when extra=0 then load else greatest(load,round((load+extra*reference_max/100)/increment)*increment) end;
  if next_load>1000 then return result || jsonb_build_object('detail','Review this load; it exceeds the supported range.'); end if;
  return result || jsonb_build_object('kind',case when next_load>load then 'increase' else 'hold' end,'load',next_load,
    'detail',extra || ' extra reps × 1% of ' || reference_max || ' kg, added to the actual ' || load || ' kg load before rounding.');
end; $$;
revoke all on function public.review_base_strength_progression(uuid,uuid,text) from public, anon;
grant execute on function public.review_base_strength_progression(uuid,uuid,text) to authenticated;

create function public.apply_base_strength_progression(p_assignment_id uuid,p_workout_id uuid,p_programme_key text,p_revision integer,p_fingerprint text)
returns integer language plpgsql security invoker set search_path='' as $$
declare review jsonb; prescribed public.personal_programme_sessions%rowtype; working jsonb;
begin
  perform 1 from public.program_assignments where id=p_assignment_id for update;
  select * into prescribed from public.personal_programme_sessions where assignment_id=p_assignment_id and program_workout_id=p_workout_id for update;
  review:=public.review_base_strength_progression(p_assignment_id,p_workout_id,p_programme_key);
  if prescribed.revision is distinct from p_revision or review->>'fingerprint' is distinct from p_fingerprint or coalesce(p_fingerprint,'')='' then
    raise exception 'The programme or workout log changed. Refresh the load review before applying it.';
  end if;
  if review->>'kind' not in ('increase','hold','reset') or nullif(review->>'load','') is null or (review->>'load')::numeric<=0 then raise exception 'This load needs a separate review.'; end if;
  select jsonb_agg(case when value->>'programmeKey'=p_programme_key then
    jsonb_set(jsonb_set(value,'{setRows}',(select jsonb_agg(jsonb_set(s,'{weight}',to_jsonb(review->>'load'))) from jsonb_array_elements(value->'setRows') s)),
      '{baseStrength,approvedFingerprint}',to_jsonb(p_fingerprint)) else value end order by n)
    into working from jsonb_array_elements(prescribed.plan->'movements') with ordinality movement(value,n);
  update public.personal_programme_sessions set plan=jsonb_set(plan,'{movements}',working)
    where assignment_id=p_assignment_id and program_workout_id=p_workout_id;
  return prescribed.revision+1;
end; $$;
revoke all on function public.apply_base_strength_progression(uuid,uuid,text,integer,text) from public, anon;
grant execute on function public.apply_base_strength_progression(uuid,uuid,text,integer,text) to authenticated;

-- Keep source metadata in the immutable started prescription as well as the logger guidance.
create function app_private.capture_base_strength_entry() returns trigger
language plpgsql security invoker set search_path='' as $$
declare m jsonb;
begin
  select movement.value into m from public.suggested_workouts w join public.personal_programme_sessions s
    on s.assignment_id=w.program_assignment_id and s.program_workout_id=w.program_workout_id
    cross join lateral jsonb_array_elements(s.plan->'movements') movement(value)
    where w.id=new.suggested_workout_id and movement.value->>'programmeKey'=new.target_metrics->>'programme_key';
  if m ? 'baseStrength' then new.target_metrics:=new.target_metrics || jsonb_build_object('base_strength',m->'baseStrength'); end if;
  return new;
end; $$;
revoke all on function app_private.capture_base_strength_entry() from public, anon;
grant execute on function app_private.capture_base_strength_entry() to authenticated;
create trigger capture_base_strength_entry before insert on public.suggested_workout_entries for each row execute function app_private.capture_base_strength_entry();

create function app_private.guard_base_strength_start() returns trigger
language plpgsql security invoker set search_path='' as $$
declare plan jsonb; m jsonb; review jsonb;
begin
  if new.program_workout_id is null or new.status not in ('pending','accepted') then return new; end if;
  select s.plan into plan from public.personal_programme_sessions s where s.assignment_id=new.program_assignment_id and s.program_workout_id=new.program_workout_id;
  if not (plan ? 'baseStrength') then return new; end if;
  for m in select value from jsonb_array_elements(plan->'movements') loop
    if m->'progression'->>'type'='source' and m->'baseStrength'->>'role' in ('main','variation') and nullif(m->'baseStrength'->>'percent','') is not null and nullif(m->'baseStrength'->>'referenceMax','') is null then
      raise exception 'Reassess the estimated max for % before using percentage loads.',m->>'exercise';
    end if;
    if (m->>'trackingMode'='weight_reps' and exists(select 1 from jsonb_array_elements(m->'setRows') s where coalesce(s->>'weight','')=''))
      or (not coalesce((m->'baseStrength'->>'plusLastSet')::boolean,false) and exists(select 1 from jsonb_array_elements(m->'setRows') s where coalesce(nullif(s->>'reps','')::numeric,0)<=0)) then
      raise exception 'Review the load and targets for % in My Programme before starting.',m->>'exercise';
    end if;
    if m->'baseStrength' ? 'approvedFingerprint' then
      review:=public.review_base_strength_progression(new.program_assignment_id,new.program_workout_id,m->>'programmeKey');
      if review->>'fingerprint' is distinct from m->'baseStrength'->>'approvedFingerprint' or review->>'kind'='review'
        or exists(select 1 from jsonb_array_elements(m->'setRows') s where (s->>'weight')::numeric is distinct from (review->>'load')::numeric) then
        raise exception 'The approved plus-set decision changed. Review this load again before starting.';
      end if;
    end if;
  end loop;
  return new;
end; $$;
revoke all on function app_private.guard_base_strength_start() from public, anon;
grant execute on function app_private.guard_base_strength_start() to authenticated;
create trigger guard_base_strength_start before insert on public.suggested_workouts for each row execute function app_private.guard_base_strength_start();

-- Calendar waves remain the backbone; generic weekly reductions are not source progression.
create function app_private.guard_base_strength_coach() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if exists(select 1 from public.personal_programme_sessions where assignment_id=new.program_assignment_id and plan ? 'baseStrength') then
    raise exception 'Review Base Strength sessions directly in My Programme; its waves use source progression.';
  end if;
  return new;
end; $$;
revoke all on function app_private.guard_base_strength_coach() from public, anon;
grant execute on function app_private.guard_base_strength_coach() to authenticated;
create trigger guard_base_strength_coach before insert or update on public.programme_strength_week_reviews for each row execute function app_private.guard_base_strength_coach();
-- Preserve the existing lifecycle and only change activation for these source runs.
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
    if not exists(select 1 from public.programs where id=source.program_id and method_type in ('base_strength_bullmastiff','base_strength_volume_intensity')) then
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
