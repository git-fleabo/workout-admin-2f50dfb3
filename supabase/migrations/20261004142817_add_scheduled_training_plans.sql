alter table public.suggested_workouts
  add column plan_kind text,
  add column mobility_practice_run_id uuid references public.mobility_practice_runs(id) on delete set null;

alter table public.suggested_workouts
  add constraint suggested_workouts_plan_kind_check
  check (
    plan_kind is null or plan_kind in (
      'strength', 'conditioning', 'climbing', 'yoga', 'mobility', 'other'
    )
  );

create index suggested_workouts_person_schedule_idx
  on public.suggested_workouts (person_id, suggested_for, status)
  where suggested_for is not null;

create index suggested_workouts_mobility_run_idx
  on public.suggested_workouts (mobility_practice_run_id)
  where mobility_practice_run_id is not null;

create function app_private.guard_scheduled_mobility_plan()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.mobility_practice_run_id is null then
    if new.plan_kind = 'mobility' then
      raise exception 'Choose an active mobility practice.';
    end if;
    return new;
  end if;

  if new.plan_kind is distinct from 'mobility' then
    raise exception 'Only mobility plans can use a mobility practice.';
  end if;

  if not exists (
    select 1
    from public.mobility_practice_runs run
    where run.id = new.mobility_practice_run_id
      and run.person_id = new.person_id
      and run.status = 'active'
      and app_private.person_is_accessible(run.person_id)
  ) then
    raise exception 'Choose an active mobility practice.';
  end if;

  return new;
end;
$$;

create trigger guard_scheduled_mobility_plan
before insert or update of person_id, plan_kind, mobility_practice_run_id
on public.suggested_workouts
for each row execute function app_private.guard_scheduled_mobility_plan();

revoke all on function app_private.guard_scheduled_mobility_plan() from public, anon;
grant execute on function app_private.guard_scheduled_mobility_plan() to authenticated;
