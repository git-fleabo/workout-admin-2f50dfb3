-- A receipt and its session/plan completion commit together. Replaying the same
-- operation returns its original identity, including after a lost response.
create table app_private.workout_save_operations (
  person_id uuid not null references public.people(id) on delete cascade,
  operation_id uuid not null,
  payload_hash text not null,
  session_id uuid references public.sessions(id) on delete set null,
  completed_at timestamptz,
  primary key (person_id, operation_id)
);
create index workout_save_operations_session_idx on app_private.workout_save_operations(session_id);
alter table app_private.workout_save_operations enable row level security;
create policy workout_save_operations_select on app_private.workout_save_operations
for select to authenticated using (app_private.person_is_accessible(person_id));
create policy workout_save_operations_insert on app_private.workout_save_operations
for insert to authenticated with check (app_private.person_is_accessible(person_id));
create policy workout_save_operations_update on app_private.workout_save_operations
for update to authenticated using (app_private.person_is_accessible(person_id))
with check (app_private.person_is_accessible(person_id));
grant select, insert, update on app_private.workout_save_operations to authenticated;
revoke all on app_private.workout_save_operations from anon, public;

create function public.save_workout_once(
  p_operation_id uuid,
  p_person_id uuid,
  p_session jsonb,
  p_entries jsonb,
  p_method_blocks jsonb default '[]'::jsonb,
  p_suggested_workout_id uuid default null,
  p_mobility_run_id uuid default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  receipt app_private.workout_save_operations%rowtype;
  request_payload jsonb;
  saved_id uuid;
begin
  if p_operation_id is null or not app_private.person_is_accessible(p_person_id) then
    raise exception 'The workout operation is not accessible.' using errcode = '42501';
  end if;
  request_payload := jsonb_build_object(
    'session', p_session, 'entries', p_entries, 'method_blocks', p_method_blocks,
    'suggested_workout_id', p_suggested_workout_id, 'mobility_run_id', p_mobility_run_id
  );
  insert into app_private.workout_save_operations(person_id, operation_id, payload_hash)
  values(p_person_id, p_operation_id, encode(sha256(convert_to(request_payload::text, 'UTF8')), 'hex'))
  on conflict (person_id, operation_id) do nothing;
  -- Conflicting inserts wait for the other transaction. Then the row lock and
  -- receipt distinguish an uncommitted attempt from an already confirmed save.
  select * into receipt from app_private.workout_save_operations
  where person_id = p_person_id and operation_id = p_operation_id for update;
  if not found or receipt.payload_hash is distinct from encode(sha256(convert_to(request_payload::text, 'UTF8')), 'hex') then
    raise exception 'This workout save ID was already used with different contents.' using errcode = '22023';
  end if;
  if receipt.completed_at is not null then
    if receipt.session_id is null then
      raise exception 'This saved workout was deleted. It will not be recreated by a retry.' using errcode = '22023';
    end if;
    return receipt.session_id;
  end if;

  if p_mobility_run_id is null then
    saved_id := public.save_workout(p_person_id, p_session, p_entries, p_method_blocks);
  else
    saved_id := public.save_mobility_workout(p_person_id, p_session, p_entries, p_method_blocks, p_mobility_run_id);
  end if;
  if p_suggested_workout_id is not null then
    -- Owner checks here are explicit even for admins with access to more than
    -- one profile. Existing completion verifies current strength progression,
    -- leaves supporting work independent and locks the plan/assignment rows.
    if not exists (select 1 from public.suggested_workouts
      where id = p_suggested_workout_id and person_id = p_person_id) then
      raise exception 'The workout plan does not belong to this training profile.' using errcode = '42501';
    end if;
    perform public.complete_suggested_workout(p_suggested_workout_id, saved_id);
  end if;
  update app_private.workout_save_operations set session_id = saved_id, completed_at = now()
  where person_id = p_person_id and operation_id = p_operation_id;
  return saved_id;
end;
$$;
revoke all on function public.save_workout_once(uuid, uuid, jsonb, jsonb, jsonb, uuid, uuid) from public, anon;
grant execute on function public.save_workout_once(uuid, uuid, jsonb, jsonb, jsonb, uuid, uuid) to authenticated;
