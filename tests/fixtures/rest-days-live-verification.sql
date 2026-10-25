begin;
do $test$
declare
  person uuid; login uuid; prog uuid:=gen_random_uuid(); assignment uuid:=gen_random_uuid();
  w1 uuid:=gen_random_uuid(); w2 uuid:=gen_random_uuid(); w3 uuid:=gen_random_uuid(); w4 uuid:=gen_random_uuid();
  linked uuid:=gen_random_uuid(); yoga uuid:=gen_random_uuid();
  actual text; original_count bigint; result integer;
begin
  select id,auth_user_id into person,login from public.people where auth_user_id is not null order by created_at limit 1;
  select count(*) into original_count from public.sessions where person_id=person;
  insert into public.programs(id,name,is_template,method_type) values(prog,'Rest day verification (rolled back)',true,'percentage_strength');
  insert into public.program_workouts(id,program_id,name,sequence_index,week_number,day_number) values
    (w1,prog,'Done',1,1,1),(w2,prog,'A',3,1,3),(w3,prog,'B',7,1,5),(w4,prog,'C',10,2,1);
  insert into public.program_assignments(id,program_id,person_id,status,current_workout_index,started_on)
    values(assignment,prog,person,'paused',1,'2090-10-02');
  insert into public.suggested_workouts(id,person_id,program_assignment_id,program_workout_id,status,suggested_for,title)
    values(linked,person,assignment,w2,'pending','2090-10-04','Fixture A');
  insert into public.suggested_workouts(id,person_id,status,suggested_for,title)
    values(yoga,person,'pending','2090-10-04','Fixture yoga');
  perform set_config('request.jwt.claim.sub',login::text,true);
  execute 'set local role authenticated';
  if not app_private.person_is_accessible(person) then raise exception 'fixture profile inaccessible'; end if;
  result:=public.set_training_rest_day(person,'2090-10-04',true);
  if result<>4 then raise exception 'expected 4 shifted workouts, got %',result; end if;
  select string_agg(app_private.programme_session_scheduled_date(assignment,id)::text,',' order by sequence_index)
    into actual from public.program_workouts where program_id=prog;
  if actual<>'2090-10-02,2090-10-06,2090-10-08,2090-10-11' then raise exception 'unexpected dates %',actual; end if;
  if (select suggested_for from public.suggested_workouts where id=linked)<>'2090-10-06'::date
    or (select suggested_for from public.suggested_workouts where id=yoga)<>'2090-10-05'::date then raise exception 'pending links not moved'; end if;
  if public.set_training_rest_day(person,'2090-10-04',true)<>0 then raise exception 'repeat not idempotent'; end if;
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  if exists(select 1 from public.training_rest_days where person_id=person) then raise exception 'RLS leaked rest dates'; end if;
  begin
    perform public.set_training_rest_day(person,'2090-10-04',true);
    raise exception 'wrong profile write allowed';
  exception when others then
    if position('Profile not found' in sqlerrm)=0 then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub',login::text,true);
  if public.set_training_rest_day(person,'2090-10-04',false)<>4 then raise exception 'undo count'; end if;
  select string_agg(app_private.programme_session_scheduled_date(assignment,id)::text,',' order by sequence_index)
    into actual from public.program_workouts where program_id=prog;
  if actual<>'2090-10-02,2090-10-04,2090-10-06,2090-10-09' then raise exception 'undo dates %',actual; end if;
  perform public.set_training_rest_day(person,'2090-10-05',true);
  perform public.set_training_rest_day(person,'2090-10-08',true);
  perform public.set_training_rest_day(person,'2090-10-04',true);
  select string_agg(app_private.programme_session_scheduled_date(assignment,id)::text,',' order by sequence_index)
    into actual from public.program_workouts where program_id=prog;
  if actual<>'2090-10-02,2090-10-06,2090-10-09,2090-10-12' then raise exception 'rest dates not avoided %',actual; end if;
  if (select suggested_for from public.suggested_workouts where id=yoga)<>'2090-10-06'::date then raise exception 'consecutive rests not avoided'; end if;
  perform public.set_training_rest_day(person,'2090-10-04',false);
  perform public.set_training_rest_day(person,'2090-10-05',false);
  perform public.set_training_rest_day(person,'2090-10-08',false);
  if public.set_training_rest_day(person,'2090-10-06',true)<>2 then raise exception 'future date moved earlier work'; end if;
  if app_private.programme_session_scheduled_date(assignment,w2)<>'2090-10-04'::date then raise exception 'earlier date changed'; end if;
  perform public.set_training_rest_day(person,'2090-10-06',false);
  perform public.set_training_rest_day(person,'2090-10-04',true);
  update public.programme_session_dates set scheduled_on='2090-10-12' where assignment_id=assignment and program_workout_id=w4;
  begin
    perform public.set_training_rest_day(person,'2090-10-04',false);
    raise exception 'stale undo allowed';
  exception when others then
    if position('changed or started' in sqlerrm)=0 then raise; end if;
  end;
  if app_private.programme_session_scheduled_date(assignment,w2)<>'2090-10-06'::date then raise exception 'stale undo partially wrote'; end if;
  perform public.set_training_rest_day(person,'2090-10-04',false,false);
  if exists(select 1 from public.training_rest_days where person_id=person and rest_date='2090-10-04') then raise exception 'label removal failed'; end if;
  insert into public.suggested_workouts(person_id,status,suggested_for,title)
    values(person,'pending','2001-01-01','Past rest fixture');
  perform public.set_training_rest_day(person,'2001-01-01',true);
  if exists(select 1 from public.suggested_workouts where person_id=person and title='Past rest fixture'
    and suggested_for<(now() at time zone 'Europe/London')::date) then raise exception 'past work not rolled forward'; end if;
  perform public.set_training_rest_day(person,'2001-01-01',false);
  perform public.set_training_rest_day(person,'2090-10-06',true);
  update public.suggested_workouts set status='accepted' where id=linked;
  begin
    perform public.set_training_rest_day(person,'2090-10-06',false);
    raise exception 'started session undo allowed';
  exception when others then
    if position('changed or started' in sqlerrm)=0 then raise; end if;
  end;
  perform public.set_training_rest_day(person,'2090-10-06',false,false);
  if has_function_privilege('anon','public.set_training_rest_day(uuid,date,boolean,boolean)','EXECUTE')
    then raise exception 'anonymous RPC execution allowed'; end if;
  if (select count(*) from public.sessions where person_id=person)<>original_count then raise exception 'rest counted as workout'; end if;
end $test$;
rollback;
select 'passed: scheduling, spacing, future dates, consecutive rests, saved plans, idempotency, Undo, stale Undo rollback, label removal, RLS, ownership and unchanged workout counts; all fixtures rolled back' as verification;
