-- Additive, no legacy backfill: mobility linkage alone does not prove a workout is recovery-only.
alter table public.sessions add column recovery_only boolean not null default false;
grant update (recovery_only) on public.sessions to authenticated;

create table public.recovery_routines (
 id uuid primary key default gen_random_uuid(),
 person_id uuid not null references public.people(id) on delete restrict,
 name text not null check (length(btrim(name)) between 1 and 200),
 purpose text not null default '' check (purpose in ('','Mobility','Prehab','Rehab')),
 area text not null default '', notes text not null default '',
 status text not null default 'active' check (status in ('active','paused','maintenance','archived')),
 templates jsonb not null,
 version integer not null default 1,
 created_at timestamptz not null default now(),
 unique(id,person_id)
);
create index recovery_routines_owner on public.recovery_routines(person_id);

create table public.recovery_sessions (
 id uuid primary key default gen_random_uuid(),
 person_id uuid not null references public.people(id) on delete restrict,
 routine_id uuid, legacy_run_id uuid,
 template_id text not null, routine_name text not null,
 session_date date not null,
 status text not null default 'draft' check (status in ('draft','completed','cancelled','skipped')),
 snapshot jsonb not null, actuals jsonb not null default '[]',
 pain numeric check (pain between 0 and 10), notes text not null default '',
 check_enabled boolean not null default false,
 response text check (response in ('better','same','worse')), response_notes text not null default '',
 suggested_workout_id uuid references public.suggested_workouts(id) on delete restrict,
 version integer not null default 1,
 created_at timestamptz not null default now(), completed_at timestamptz,
 foreign key(routine_id,person_id) references public.recovery_routines(id,person_id) on delete restrict,
 foreign key(legacy_run_id,person_id) references public.mobility_practice_runs(id,person_id) on delete restrict,
 check (num_nonnulls(routine_id,legacy_run_id)=1),
 check ((status='completed')=(completed_at is not null)),
 check (response is null or status='completed')
);
create index recovery_sessions_owner_date on public.recovery_sessions(person_id,session_date desc);
create index recovery_sessions_routine on public.recovery_sessions(routine_id);
create index recovery_sessions_legacy on public.recovery_sessions(legacy_run_id);
create unique index recovery_one_draft on public.recovery_sessions(person_id,coalesce(routine_id,legacy_run_id),template_id) where status='draft';
create unique index recovery_schedule_once on public.recovery_sessions(suggested_workout_id) where status in ('draft','completed','skipped');

alter table public.recovery_routines enable row level security;
alter table public.recovery_sessions enable row level security;
create policy recovery_routines_owner on public.recovery_routines for all to authenticated
 using (app_private.person_is_accessible(person_id)) with check (app_private.person_is_accessible(person_id));
create policy recovery_sessions_owner on public.recovery_sessions for all to authenticated
 using (app_private.person_is_accessible(person_id)) with check (app_private.person_is_accessible(person_id));
revoke all on public.recovery_routines, public.recovery_sessions from public, anon, authenticated;
grant select,insert,update on public.recovery_routines, public.recovery_sessions to authenticated;

-- Validate stored templates at the database boundary as well as in the editor.
create function app_private.validate_recovery_template(t jsonb) returns void language plpgsql set search_path='' as $$
declare e jsonb; d jsonb;
begin
 if jsonb_typeof(t) is distinct from 'object' or nullif(btrim(t->>'id'),'') is null
 or nullif(btrim(t->>'name'),'') is null or coalesce(t->>'mode','') not in ('quick','measured')
 or jsonb_typeof(t->'weekdays') is distinct from 'array' or jsonb_typeof(t->'exercises') is distinct from 'array'
 or coalesce((t->>'minutes')::numeric,0) not between 1 and 300
 or jsonb_typeof(t->'nextMorning') is distinct from 'boolean' then raise exception 'Invalid recovery template.'; end if;
 if jsonb_array_length(t->'exercises') not between 1 and 40 then raise exception 'Add 1 to 40 exercises.'; end if;
 if (select count(*) from jsonb_array_elements(t->'exercises')) <> (select count(distinct value->>'id') from jsonb_array_elements(t->'exercises')) then raise exception 'Duplicate exercise identity.'; end if;
 for d in select value from jsonb_array_elements(t->'weekdays') loop
   if d::text !~ '^[0-6]$' then raise exception 'Invalid weekday.'; end if;
 end loop;
 for e in select value from jsonb_array_elements(t->'exercises') loop
  if nullif(btrim(e->>'id'),'') is null or nullif(btrim(e->>'name'),'') is null
   or coalesce((e->>'sets')::numeric,0) not between 1 and 20 or (e->>'sets')::text !~ '^[0-9]+$'
   or coalesce(e->>'side','') not in ('none','left','right','each')
   or coalesce(e->>'load','') not in ('total','per_hand','bodyweight','unloaded')
   or (nullif(e->>'source','') is not null and e->>'source' !~* '^https?://')
   or ((e->>'weight') is not null and not ((e->>'weight')::numeric between 0 and 100000))
   or ((e->>'hold') is not null and not ((e->>'hold')::numeric between 0 and 100000))
   then raise exception 'Invalid recovery exercise.'; end if;
 end loop;
end $$;

create function app_private.guard_recovery_routine() returns trigger language plpgsql set search_path='' as $$
declare t jsonb;
begin
 if tg_op='UPDATE' then
  if new.id<>old.id or new.person_id<>old.person_id or new.created_at<>old.created_at then raise exception 'Routine identity cannot change.'; end if;
  new.version := old.version+1;
 end if;
 if jsonb_typeof(new.templates) is distinct from 'array' or jsonb_array_length(new.templates) not between 1 and 12 then raise exception 'Add 1 to 12 session templates.'; end if;
 if (select count(*) from jsonb_array_elements(new.templates)) <> (select count(distinct value->>'id') from jsonb_array_elements(new.templates)) then raise exception 'Duplicate template identity.'; end if;
 for t in select value from jsonb_array_elements(new.templates) loop perform app_private.validate_recovery_template(t); end loop;
 return new;
end $$;
create trigger guard_recovery_routine before insert or update on public.recovery_routines for each row execute function app_private.guard_recovery_routine();

create function app_private.guard_recovery_session() returns trigger language plpgsql set search_path='' as $$
declare a jsonb; e jsonb; k text;
begin
 if tg_op='UPDATE' then
  if (to_jsonb(new)-array['actuals','pain','notes','status','response','response_notes','version','completed_at','check_enabled']) is distinct from
     (to_jsonb(old)-array['actuals','pain','notes','status','response','response_notes','version','completed_at','check_enabled']) then raise exception 'Session identity and targets are immutable.'; end if;
  if old.status<>'draft' and (to_jsonb(new)-array['response','response_notes','version']) is distinct from (to_jsonb(old)-array['response','response_notes','version']) then raise exception 'Completed or cancelled results cannot be replaced.'; end if;
  new.version:=old.version+1;
 else
  if new.status<>'draft' then raise exception 'Start a draft first.'; end if;
 end if;
 perform app_private.validate_recovery_template(new.snapshot);
 if jsonb_typeof(new.actuals) is distinct from 'array' or jsonb_array_length(new.actuals)>1600 then raise exception 'Invalid actual results.'; end if;
 if new.snapshot->>'mode'='quick' and new.actuals<>'[]'::jsonb then raise exception 'Quick practice does not record sets.'; end if;
 if (select count(*) from jsonb_array_elements(new.actuals)) <> (select count(distinct (value->>'exerciseId',value->>'side',value->>'set')) from jsonb_array_elements(new.actuals)) then raise exception 'Duplicate actual set.'; end if;
 for a in select value from jsonb_array_elements(new.actuals) loop
  select value into e from jsonb_array_elements(new.snapshot->'exercises') where value->>'id'=a->>'exerciseId';
  if e is null or coalesce((a->>'set')::int,0) not between 1 and (e->>'sets')::int
   or coalesce(a->>'side','') not in ('none','left','right')
   or (e->>'side'='each' and a->>'side' not in ('left','right'))
   or (e->>'side'<>'each' and a->>'side'<>e->>'side') then raise exception 'Actual set does not match the exercise.'; end if;
  foreach k in array array['reps','weight','hold'] loop
   if a->>k is not null and not ((a->>k)::numeric between 0 and 100000) then raise exception 'Invalid actual number.'; end if;
  end loop;
 end loop;
 if new.status='completed' and new.snapshot->>'mode'='measured' and new.actuals='[]'::jsonb then raise exception 'Record actual work or cancel this session.'; end if;
 if new.suggested_workout_id is not null and not exists (
  select 1 from public.suggested_workouts w where w.id=new.suggested_workout_id and w.person_id=new.person_id
  and w.mobility_practice_run_id=new.legacy_run_id and w.plan_kind='mobility' and w.program_workout_id is null
 ) then raise exception 'Scheduled practice ownership or provenance mismatch.'; end if;
 if new.status in ('cancelled','skipped') and new.actuals<>'[]'::jsonb then raise exception 'A skipped or cancelled session cannot contain actual work.'; end if;
 return new;
end $$;
create trigger guard_recovery_session before insert or update on public.recovery_sessions for each row execute function app_private.guard_recovery_session();

-- Locks the source to make concurrent/retried starts return the same unfinished session.
create function public.start_recovery_session(p_person_id uuid,p_routine_id uuid,p_legacy_run_id uuid,p_template_id text,p_date date,p_schedule_id uuid default null)
returns public.recovery_sessions language plpgsql security invoker set search_path='' as $$
declare r public.recovery_routines; m public.mobility_practice_runs; s public.recovery_sessions; t jsonb; n text;
begin
 if not app_private.person_is_accessible(p_person_id) or num_nonnulls(p_routine_id,p_legacy_run_id)<>1 then raise exception 'Recovery routine not available.'; end if;
 if p_routine_id is not null then
  select * into r from public.recovery_routines where id=p_routine_id and person_id=p_person_id for update;
  if not found then raise exception 'Recovery routine not available.'; end if;
  select * into s from public.recovery_sessions where routine_id=r.id and template_id=p_template_id and status='draft';
  if found then return s; end if;
  if r.status not in ('active','maintenance') then raise exception 'Activate the routine before starting.'; end if;
  select value into t from jsonb_array_elements(r.templates) where value->>'id'=p_template_id;
  n:=r.name;
 else
  select * into m from public.mobility_practice_runs where id=p_legacy_run_id and person_id=p_person_id for update;
  if not found then raise exception 'Toolkit practice not available.'; end if;
  select * into s from public.recovery_sessions where legacy_run_id=m.id and status='draft';
  if found then return s; end if;
  if m.status<>'active' then raise exception 'Resume the practice before starting.'; end if;
  if p_template_id<>'legacy' then raise exception 'Invalid toolkit template.'; end if;
  n:=case m.skill when 'pike' then 'Pike & Head to Toe' when 'pancake' then 'Pancake' when 'side_split' then 'Side Split' when 'front_split' then 'Front Split' when 'shoulder' then 'Shoulder Mobility & Flexibility' else initcap(replace(m.skill,'_',' ')) end;
  t:=jsonb_build_object('id','legacy','name','Practice','mode','measured','minutes',15,'weekdays','[]'::jsonb,'notes',coalesce(m.notes,''),'nextMorning',false,'progression','',
   'exercises',(select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'exerciseId',d.exercise_id,'name',d.name,'sets',coalesce(d.target_sets,1),'reps',coalesce(d.target_reps,''),'weight',d.target_weight_kg,'hold',d.target_hold_seconds,'side','none','load','total','setup',coalesce(d.target_detail,''),'source',coalesce(d.lesson_url,'')) order by d.sort_order,d.created_at),'[]'::jsonb) from public.mobility_practice_drills d where d.run_id=m.id and d.is_active));
 end if;
 if t is null then raise exception 'Session template not found.'; end if;
 if p_schedule_id is not null then
  select * into s from public.recovery_sessions where suggested_workout_id=p_schedule_id and status in ('completed','skipped');
  if found then return s; end if;
  if not exists(select 1 from public.suggested_workouts where id=p_schedule_id and status in ('pending','accepted')) then raise exception 'Scheduled practice is no longer available.'; end if;
 end if;
 insert into public.recovery_sessions(person_id,routine_id,legacy_run_id,template_id,routine_name,session_date,snapshot,check_enabled,suggested_workout_id)
 values(p_person_id,p_routine_id,p_legacy_run_id,p_template_id,n,p_date,t,(t->>'nextMorning')::boolean,p_schedule_id) returning * into s;
 return s;
end $$;
revoke all on function public.start_recovery_session(uuid,uuid,uuid,text,date,uuid) from public,anon;
grant execute on function public.start_recovery_session(uuid,uuid,uuid,text,date,uuid) to authenticated;

-- The original schedule is retained; the recovery session links to it exactly once.
-- No strength completion function, programme index or prescription is touched.
create function app_private.complete_recovery_schedule() returns trigger language plpgsql set search_path='' as $$
begin
 if old.status='draft' and new.status in ('completed','skipped') and new.suggested_workout_id is not null then
  update public.suggested_workouts set status=case when new.status='completed' then 'completed' else 'archived' end
  where id=new.suggested_workout_id and person_id=new.person_id and program_workout_id is null;
 end if;
 return new;
end $$;
create trigger complete_recovery_schedule after update on public.recovery_sessions for each row execute function app_private.complete_recovery_schedule();
