alter table public.suggested_workouts
  add column goal_id uuid references public.goals(id) on delete set null;

alter table public.suggested_workouts
  drop constraint if exists suggested_workouts_plan_kind_check,
  add constraint suggested_workouts_plan_kind_check
  check (
    plan_kind is null or plan_kind in (
      'strength', 'conditioning', 'climbing', 'yoga', 'mobility', 'skill', 'other'
    )
  );

create index suggested_workouts_goal_idx
  on public.suggested_workouts (goal_id)
  where goal_id is not null;

create function app_private.guard_programme_support_plan()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.goal_id is not null then
    if new.plan_kind is distinct from 'skill' then
      raise exception 'Only skill plans can use a supporting goal.';
    end if;
    if new.mobility_practice_run_id is not null then
      raise exception 'Choose either a goal or a mobility practice.';
    end if;
    if new.program_assignment_id is null or new.program_workout_id is not null then
      raise exception 'A supporting goal must belong to a programme without replacing a strength session.';
    end if;
    if not exists (
      select 1
      from public.goals goal
      where goal.id = new.goal_id
        and goal.person_id = new.person_id
        and goal.status = 'active'
        and goal.exercise_id is not null
        and app_private.person_is_accessible(goal.person_id)
    ) then
      raise exception 'Choose an accessible active exercise goal.';
    end if;
  end if;

  if new.program_assignment_id is not null and new.program_workout_id is null then
    if new.goal_id is null and new.mobility_practice_run_id is null then
      raise exception 'A programme support plan needs a goal or mobility practice.';
    end if;
    if not exists (
      select 1
      from public.program_assignments assignment
      where assignment.id = new.program_assignment_id
        and assignment.person_id = new.person_id
        and assignment.status in ('active', 'paused')
        and app_private.person_is_accessible(assignment.person_id)
    ) then
      raise exception 'Choose an accessible current programme.';
    end if;
  end if;

  return new;
end;
$$;

create trigger guard_programme_support_plan
before insert or update of person_id, program_assignment_id, program_workout_id,
  plan_kind, goal_id, mobility_practice_run_id
on public.suggested_workouts
for each row execute function app_private.guard_programme_support_plan();

revoke all on function app_private.guard_programme_support_plan() from public, anon;
grant execute on function app_private.guard_programme_support_plan() to authenticated;
