-- Personal prescriptions belong to one run. Source templates and completed sessions remain intact.
create table public.personal_programmes (
  assignment_id uuid primary key references public.program_assignments(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 200),
  created_at timestamptz not null default now()
);
create table public.personal_programme_sessions (
  assignment_id uuid not null references public.personal_programmes(assignment_id) on delete cascade,
  program_workout_id uuid not null references public.program_workouts(id),
  name text not null check (length(btrim(name)) between 1 and 200),
  scheduled_on date not null,
  plan jsonb not null,
  revision integer not null default 1,
  primary key (assignment_id, program_workout_id)
);
create index personal_programme_sessions_workout_idx on public.personal_programme_sessions(program_workout_id);
alter table public.personal_programmes enable row level security;
alter table public.personal_programme_sessions enable row level security;
revoke all on public.personal_programmes, public.personal_programme_sessions from anon, authenticated;
grant select, insert on public.personal_programmes to authenticated;
grant select, insert, update on public.personal_programme_sessions to authenticated;
create policy personal_programmes_read on public.personal_programmes for select to authenticated
using (exists (select 1 from public.program_assignments a where a.id = assignment_id and app_private.person_is_accessible(a.person_id)));
create policy personal_programmes_insert on public.personal_programmes for insert to authenticated
with check (exists (select 1 from public.program_assignments a where a.id = assignment_id and a.status = 'paused' and app_private.person_is_accessible(a.person_id)));
create policy personal_sessions_read on public.personal_programme_sessions for select to authenticated
using (exists (select 1 from public.program_assignments a where a.id = assignment_id and app_private.person_is_accessible(a.person_id)));
create policy personal_sessions_insert on public.personal_programme_sessions for insert to authenticated
with check (exists (select 1 from public.program_assignments a where a.id = assignment_id and app_private.person_is_accessible(a.person_id)));
create policy personal_sessions_update on public.personal_programme_sessions for update to authenticated
using (exists (select 1 from public.program_assignments a where a.id = assignment_id and app_private.person_is_accessible(a.person_id)))
with check (exists (select 1 from public.program_assignments a where a.id = assignment_id and app_private.person_is_accessible(a.person_id)));

create function app_private.validate_personal_programme_plan(p_plan jsonb, p_require_targets boolean default false) returns void
language plpgsql security invoker set search_path = '' as $$
declare m jsonb; s jsonb; rule jsonb; field text; target_value text;
begin
  if p_plan is null or p_plan->'version' is distinct from '1'::jsonb or coalesce(p_plan->>'locationKind','') not in ('home','gym')
    or jsonb_typeof(p_plan->'movements') is distinct from 'array' then
    raise exception 'Choose a location and at least one exercise.';
  end if;
  if jsonb_array_length(p_plan->'movements') not between 1 and 30 then raise exception 'Use 1 to 30 exercises.'; end if;
  if (select count(distinct value->>'programmeKey') from jsonb_array_elements(p_plan->'movements')) <> jsonb_array_length(p_plan->'movements') then
    raise exception 'Exercise identities must be unique.';
  end if;
  for m in select value from jsonb_array_elements(p_plan->'movements') loop
    if jsonb_typeof(m->'programmeKey') is distinct from 'string' or jsonb_typeof(m->'exercise') is distinct from 'string'
      or (m ? 'restTime' and jsonb_typeof(m->'restTime') is distinct from 'string')
      or coalesce(length(m->>'programmeKey'),0) not between 1 and 128 or coalesce(length(btrim(m->>'exercise')),0) not between 1 and 200
      or coalesce(length(m->>'reason'),0) > 4000 or coalesce(length(m->>'restTime'),0) > 100
      or m->>'trackingMode' is null or m->>'trackingMode' not in ('weight_reps','reps_only','hold','grip_hold') then
      raise exception 'Use a supported strength exercise and concise guidance.';
    end if;
    if not exists (select 1 from public.exercises e where e.id = (m->>'exerciseId')::uuid) then raise exception 'Choose an exercise from the Library.'; end if;
    if jsonb_typeof(m->'workoutType') is distinct from 'string'
      or lower(m->>'workoutType') <> 'strength' or jsonb_typeof(m->'sourceDate') is distinct from 'string'
      or jsonb_typeof(m->'reason') is distinct from 'string' or jsonb_typeof(m->'targets') is distinct from 'object' then
      raise exception 'Check the exercise description and targets.';
    end if;
    foreach field in array array['durationMinutes','distance','distanceUnit','rounds','height','detail'] loop
      if jsonb_typeof(m->'targets'->field) is distinct from 'string' then raise exception 'Check the exercise targets.'; end if;
    end loop;
    rule := m->'progression';
    foreach field in array array['minReps','maxReps','incrementKg','maxRpe'] loop
      if jsonb_typeof(rule->field) is distinct from 'number' then raise exception 'Check the progression numbers.'; end if;
    end loop;
    if (rule->>'minReps')::numeric <> trunc((rule->>'minReps')::numeric)
      or (rule->>'maxReps')::numeric <> trunc((rule->>'maxReps')::numeric) then raise exception 'Use whole rep targets.'; end if;
    if rule->>'type' is null or rule->>'type' not in ('fixed','double','source')
      or coalesce((rule->>'minReps')::numeric,0) not between 1 and 100
      or coalesce((rule->>'maxReps')::numeric,0) not between (rule->>'minReps')::numeric and 100
      or coalesce((rule->>'incrementKg')::numeric,0) <= 0 or (rule->>'incrementKg')::numeric > 100
      or coalesce((rule->>'maxRpe')::numeric,0) not between 1 and 10
      or (rule->>'type' = 'double' and m->>'trackingMode' <> 'weight_reps') then
      raise exception 'Check the progression range, increment and effort limit.';
    end if;
    if jsonb_typeof(m->'setRows') is distinct from 'array' then raise exception 'Add at least one set.'; end if;
    if jsonb_array_length(m->'setRows') not between 1 and 20 then raise exception 'Use 1 to 20 sets per exercise.'; end if;
    for s in select value from jsonb_array_elements(m->'setRows') loop
      if jsonb_typeof(s->'completed') is distinct from 'boolean' then raise exception 'Check the set targets.'; end if;
      foreach field in array array['reps','weight','durationSeconds','rpe'] loop
        target_value := s->>field;
        if jsonb_typeof(s->field) is distinct from 'string' or (target_value <> '' and (target_value !~ '^\d+(\.\d+)?$' or target_value::numeric > case when field='rpe' then 10 when field='durationSeconds' then 86400 else 1000 end)) then
          raise exception 'Check the set targets.';
        end if;
      end loop;
      if p_require_targets and rule->>'type'<>'source' and (
        m->>'trackingMode' in ('weight_reps','reps_only') and coalesce(nullif(s->>'reps','')::numeric,0)<=0
        or m->>'trackingMode' in ('hold','grip_hold') and coalesce(nullif(s->>'durationSeconds','')::numeric,0)<=0
        or m->>'trackingMode' in ('weight_reps','grip_hold') and nullif(s->>'weight','') is null) then
        raise exception 'Fill in future set targets for %, or choose source programme rules.',m->>'exercise';
      end if;
    end loop;
  end loop;
end; $$;
revoke all on function app_private.validate_personal_programme_plan(jsonb,boolean) from public, anon;
grant execute on function app_private.validate_personal_programme_plan(jsonb,boolean) to authenticated;

-- The same guard applies to direct table writes and RPCs. Lock the run to serialize edits,
-- starts, skips and completions; never allow an edit to rewrite a started prescription.
create function app_private.guard_personal_programme_session() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare a public.program_assignments%rowtype; w public.program_workouts%rowtype;
begin
  if tg_op = 'UPDATE' and (new.assignment_id <> old.assignment_id or new.program_workout_id <> old.program_workout_id) then
    raise exception 'A session cannot be moved to a different run.';
  end if;
  select * into a from public.program_assignments where id = new.assignment_id for update;
  select * into w from public.program_workouts where id = new.program_workout_id and program_id = a.program_id;
  if a.id is null or w.id is null or a.status not in ('active','paused') or w.sequence_index < a.current_workout_index then
    raise exception 'Only future sessions in a current or paused programme can be edited.';
  end if;
  if exists (select 1 from public.suggested_workouts p where p.program_assignment_id = a.id and p.program_workout_id = w.id and p.status in ('accepted','completed','skipped')) then
    raise exception 'This session has already started, completed or been skipped.';
  end if;
  perform app_private.validate_personal_programme_plan(new.plan,a.status='active');
  new.revision := case when tg_op = 'INSERT' then 1 else old.revision + 1 end;
  return new;
end; $$;
create trigger guard_personal_programme_session before insert or update on public.personal_programme_sessions
for each row execute function app_private.guard_personal_programme_session();
revoke all on function app_private.guard_personal_programme_session() from public, anon;
grant execute on function app_private.guard_personal_programme_session() to authenticated;

create function public.create_personal_programme(p_person_id uuid, p_program_id uuid, p_name text, p_started_on date, p_sessions jsonb, p_notes text default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare a_id uuid; item jsonb; expected integer;
begin
  if auth.uid() is null or not app_private.person_is_accessible(p_person_id) then raise exception 'The training profile is not accessible.'; end if;
  if p_started_on is null then raise exception 'Choose a start date.'; end if;
  select count(*) into expected from public.program_workouts w join public.programs p on p.id=w.program_id where p.id=p_program_id and p.is_template;
  if expected = 0 or jsonb_typeof(p_sessions) is distinct from 'array' then raise exception 'Choose a starting programme.'; end if;
  if jsonb_array_length(p_sessions) <> expected or (select count(distinct value->>'workoutId') from jsonb_array_elements(p_sessions)) <> expected then
    raise exception 'Include every session in the starting programme.';
  end if;
  insert into public.program_assignments(program_id,person_id,assigned_by_person_id,status,started_on,notes)
  values(p_program_id,p_person_id,p_person_id,'paused',p_started_on,p_notes) returning id into a_id;
  insert into public.personal_programmes(assignment_id,name) values(a_id,btrim(p_name));
  for item in select value from jsonb_array_elements(p_sessions) loop
    insert into public.personal_programme_sessions(assignment_id,program_workout_id,name,scheduled_on,plan)
    values(a_id,(item->>'workoutId')::uuid,item->>'name',(item->>'scheduledDate')::date,item->'plan');
  end loop;
  return a_id;
end; $$;
revoke all on function public.create_personal_programme(uuid,uuid,text,date,jsonb,text) from public, anon;
grant execute on function public.create_personal_programme(uuid,uuid,text,date,jsonb,text) to authenticated;

create function public.save_personal_programme_sessions(p_assignment_id uuid, p_updates jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare a public.program_assignments%rowtype; item jsonb; changed integer := 0;
begin
  select * into a from public.program_assignments where id=p_assignment_id for update;
  if auth.uid() is null or a.id is null or a.status not in ('active','paused') then raise exception 'This programme cannot be edited.'; end if;
  if jsonb_typeof(p_updates) is distinct from 'array' then raise exception 'Choose sessions to update.'; end if;
  if jsonb_array_length(p_updates) not between 1 and 100 then raise exception 'Choose 1 to 100 sessions to update.'; end if;
  if (select count(distinct value->>'workoutId') from jsonb_array_elements(p_updates)) <> jsonb_array_length(p_updates) then raise exception 'A session can only be updated once.'; end if;
  for item in select value from jsonb_array_elements(p_updates) loop
    update public.personal_programme_sessions set name=item->>'name', scheduled_on=(item->>'scheduledDate')::date, plan=item->'plan'
    where assignment_id=p_assignment_id and program_workout_id=(item->>'workoutId')::uuid and revision=(item->>'revision')::integer;
    if not found then raise exception 'This programme changed elsewhere. Refresh before saving.'; end if;
    changed := changed+1;
  end loop;
  return changed;
end; $$;
revoke all on function public.save_personal_programme_sessions(uuid,jsonb) from public, anon;
grant execute on function public.save_personal_programme_sessions(uuid,jsonb) to authenticated;

create function public.start_personal_programme_session(p_assignment_id uuid, p_workout_id uuid, p_revision integer, p_location_id uuid, p_easier boolean default false)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare a public.program_assignments%rowtype; prescribed public.personal_programme_sessions%rowtype;
  current_id uuid; plan_id uuid; entry_id uuid; m jsonb; s jsonb; movement_index integer := 0; set_index integer; row_count integer; load numeric;
begin
  select * into a from public.program_assignments where id=p_assignment_id for update;
  if auth.uid() is null or a.id is null or a.status <> 'active' then raise exception 'Start or resume this programme first.'; end if;
  select id into current_id from public.program_workouts where program_id=a.program_id order by sequence_index,id offset a.current_workout_index limit 1;
  if current_id is distinct from p_workout_id then raise exception 'This is no longer the next programme session.'; end if;
  select * into prescribed from public.personal_programme_sessions where assignment_id=a.id and program_workout_id=current_id;
  if prescribed.program_workout_id is null or prescribed.revision is distinct from p_revision then raise exception 'The session changed. Refresh Today before starting.'; end if;
  perform app_private.validate_personal_programme_plan(prescribed.plan,true);
  if exists (select 1 from public.suggested_workouts where program_assignment_id=a.id and program_workout_id=current_id and status in ('pending','accepted','completed','skipped')) then raise exception 'This programme session has already been started.'; end if;
  if not exists (select 1 from public.training_locations where id=p_location_id and kind in ('home','gym') and is_active and person_id=a.person_id and app_private.person_is_accessible(person_id)) then raise exception 'Choose an available training location.'; end if;
  insert into public.suggested_workouts(person_id,program_assignment_id,program_workout_id,training_location_id,status,title,basis,suggested_for)
  select a.person_id,a.id,current_id,p_location_id,'accepted',p.name || ' · ' || prescribed.name,
    case when p_easier then 'Personal programme · easier return: one fewer set where possible and about 10% lighter.' else 'Targets from your personal programme. Progression follows each exercise’s saved rule.' end,current_date
  from public.personal_programmes p where p.assignment_id=a.id returning id into plan_id;
  for m in select value from jsonb_array_elements(prescribed.plan->'movements') loop
    insert into public.suggested_workout_entries(suggested_workout_id,exercise_id,name,workout_type,order_index,reason,tracking_mode,target_metrics)
    values(plan_id,(m->>'exerciseId')::uuid,m->>'exercise',m->>'workoutType',movement_index,m->>'reason',m->>'trackingMode',
      jsonb_build_object('rest_time',coalesce(m->>'restTime',''),'progression',m->'progression')) returning id into entry_id;
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
revoke all on function public.start_personal_programme_session(uuid,uuid,integer,uuid,boolean) from public, anon;
grant execute on function public.start_personal_programme_session(uuid,uuid,integer,uuid,boolean) to authenticated;

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
    update public.program_assignments set status='active' where id=next_id;
  end if;
  return next_id;
end;
$$;

revoke all on function public.change_programme_run(uuid, text, date) from public;
revoke all on function public.change_programme_run(uuid, text, date) from anon;
grant execute on function public.change_programme_run(uuid, text, date) to authenticated;

-- Activation validates deliberate targets. Source-driven exercises may remain open-ended;
-- fixed and rep-range exercises must have a usable prescription before arriving at training.
create function app_private.guard_personal_programme_activation() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare session_row record;
begin
  if new.status='active' and old.status<>'active' and exists(select 1 from public.personal_programmes where assignment_id=new.id) then
    if (select count(*) from public.personal_programme_sessions p join public.program_workouts w on w.id=p.program_workout_id
        where p.assignment_id=new.id and w.sequence_index>=new.current_workout_index)
      <> (select count(*) from public.program_workouts w where w.program_id=new.program_id and w.sequence_index>=new.current_workout_index) then
      raise exception 'Include every future session before starting your personal programme.';
    end if;
    for session_row in select plan from public.personal_programme_sessions p join public.program_workouts w on w.id=p.program_workout_id where p.assignment_id=new.id and w.sequence_index>=new.current_workout_index loop
      perform app_private.validate_personal_programme_plan(session_row.plan,true);
    end loop;
  end if;
  return new;
end; $$;
create trigger guard_personal_programme_activation before update on public.program_assignments
for each row execute function app_private.guard_personal_programme_activation();
revoke all on function app_private.guard_personal_programme_activation() from public,anon;
grant execute on function app_private.guard_personal_programme_activation() to authenticated;
