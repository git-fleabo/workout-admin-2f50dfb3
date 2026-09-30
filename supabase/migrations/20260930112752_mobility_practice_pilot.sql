create table public.mobility_practice_runs (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  skill text not null check (skill in ('pike', 'bridge')),
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  phase text not null default 'setup' check (phase in ('setup', 'phase_1', 'phase_2', 'phase_3')),
  started_on date not null default current_date,
  ended_on date,
  review_on date,
  readiness text not null default 'unchecked'
    check (readiness in ('unchecked', 'ready', 'shoulders_first')),
  readiness_checked_on date,
  readiness_left_deg numeric check (readiness_left_deg between 0 and 360),
  readiness_right_deg numeric check (readiness_right_deg between 0 and 360),
  plan_received boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, person_id),
  check (skill = 'bridge' or readiness = 'unchecked'),
  check (status <> 'archived' or ended_on is not null)
);

create unique index mobility_practice_one_current_per_skill_idx
  on public.mobility_practice_runs (person_id, skill)
  where status in ('active', 'paused');

create trigger mobility_practice_runs_set_updated_at
before update on public.mobility_practice_runs
for each row execute function public.set_updated_at();

create table public.mobility_assessment_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.mobility_practice_runs(id) on delete restrict,
  test_key text not null,
  side text not null default 'none' check (side in ('none', 'left', 'right')),
  measured_on date not null,
  value_numeric numeric,
  value_text text,
  unit text not null check (unit in ('deg', 'cm', 'text')),
  setup_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (unit = 'text' and value_numeric is null and nullif(btrim(value_text), '') is not null)
    or (unit <> 'text' and value_numeric is not null and value_text is null)
  ),
  check (unit <> 'deg' or value_numeric between 0 and 360)
);

create index mobility_assessments_run_test_date_idx
  on public.mobility_assessment_results (run_id, test_key, side, measured_on desc);

create trigger mobility_assessment_results_set_updated_at
before update on public.mobility_assessment_results
for each row execute function public.set_updated_at();

create table public.mobility_practice_drills (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.mobility_practice_runs(id) on delete restrict,
  exercise_id uuid references public.exercises(id) on delete set null,
  name text not null,
  lesson_url text check (
    lesson_url is null or
    lesson_url ~ '^https://www[.]matthewismith[.]com/products/mobility-flexibility-toolkit/[^?#]*$'
  ),
  sort_order integer not null default 0,
  target_sets integer check (target_sets is null or target_sets between 1 and 20),
  target_reps text,
  target_weight_kg numeric check (target_weight_kg is null or target_weight_kg >= 0),
  target_hold_seconds numeric check (target_hold_seconds is null or target_hold_seconds > 0),
  target_detail text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index mobility_drills_run_order_idx
  on public.mobility_practice_drills (run_id, sort_order, created_at);
create index mobility_drills_exercise_idx
  on public.mobility_practice_drills (exercise_id)
  where exercise_id is not null;

create trigger mobility_practice_drills_set_updated_at
before update on public.mobility_practice_drills
for each row execute function public.set_updated_at();

alter table public.sessions
  add column mobility_practice_run_id uuid;

alter table public.sessions
  add constraint sessions_mobility_practice_owner_fkey
  foreign key (mobility_practice_run_id, person_id)
  references public.mobility_practice_runs (id, person_id)
  on delete restrict;

create index sessions_mobility_practice_run_idx
  on public.sessions (mobility_practice_run_id, session_date desc)
  where mobility_practice_run_id is not null;

alter table public.mobility_practice_runs enable row level security;
alter table public.mobility_assessment_results enable row level security;
alter table public.mobility_practice_drills enable row level security;

create policy mobility_practice_runs_accessible
  on public.mobility_practice_runs
  for all to authenticated
  using (app_private.person_is_accessible(person_id))
  with check (app_private.person_is_accessible(person_id));

create policy mobility_assessments_accessible
  on public.mobility_assessment_results
  for all to authenticated
  using (exists (
    select 1 from public.mobility_practice_runs run
    where run.id = run_id and app_private.person_is_accessible(run.person_id)
  ))
  with check (exists (
    select 1 from public.mobility_practice_runs run
    where run.id = run_id and app_private.person_is_accessible(run.person_id)
  ));

create policy mobility_drills_accessible
  on public.mobility_practice_drills
  for all to authenticated
  using (exists (
    select 1 from public.mobility_practice_runs run
    where run.id = run_id and app_private.person_is_accessible(run.person_id)
  ))
  with check (exists (
    select 1 from public.mobility_practice_runs run
    where run.id = run_id and app_private.person_is_accessible(run.person_id)
  ));

grant select, insert, update on public.mobility_practice_runs to authenticated;
grant select, insert, update, delete on public.mobility_assessment_results to authenticated;
grant select, insert, update, delete on public.mobility_practice_drills to authenticated;
grant update (mobility_practice_run_id) on public.sessions to authenticated;

create function public.save_mobility_workout(
  p_person_id uuid,
  p_session jsonb,
  p_entries jsonb,
  p_method_blocks jsonb,
  p_mobility_run_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_session_id uuid;
begin
  if not exists (
    select 1 from public.mobility_practice_runs run
    where run.id = p_mobility_run_id and run.person_id = p_person_id
  ) then
    raise exception 'The mobility practice was not found for this training profile.'
      using errcode = '22023';
  end if;

  saved_session_id := public.save_workout(
    p_person_id, p_session, p_entries, p_method_blocks
  );

  update public.sessions
  set mobility_practice_run_id = p_mobility_run_id
  where id = saved_session_id and person_id = p_person_id;

  if not found then
    raise exception 'The mobility workout could not be linked.';
  end if;
  return saved_session_id;
end;
$$;

revoke all on function public.save_mobility_workout(uuid, jsonb, jsonb, jsonb, uuid) from public;
revoke all on function public.save_mobility_workout(uuid, jsonb, jsonb, jsonb, uuid) from anon;
grant execute on function public.save_mobility_workout(uuid, jsonb, jsonb, jsonb, uuid)
  to authenticated;
