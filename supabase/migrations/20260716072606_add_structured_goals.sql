alter table public.goals
  add column if not exists goal_type text not null default 'legacy',
  add column if not exists exercise_id uuid,
  add column if not exists tracking_mode text,
  add column if not exists goal_metric text,
  add column if not exists target_value numeric,
  add column if not exists target_unit text,
  add column if not exists starting_value numeric,
  add column if not exists deadline date;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'goals_goal_type_check'
      and conrelid = 'public.goals'::regclass
  ) then
    alter table public.goals
      add constraint goals_goal_type_check
      check (goal_type in ('legacy', 'consistency', 'performance', 'duration', 'milestone'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'goals_goal_metric_check'
      and conrelid = 'public.goals'::regclass
  ) then
    alter table public.goals
      add constraint goals_goal_metric_check
      check (
        goal_metric is null
        or goal_metric in (
          'sessions',
          'active_days',
          'minutes',
          'checkins',
          'max_weight',
          'estimated_1rm',
          'reps',
          'hold_seconds',
          'duration_minutes',
          'distance_km',
          'distance_m',
          'rounds',
          'height_cm',
          'problems',
          'completed'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'goals_target_value_check'
      and conrelid = 'public.goals'::regclass
  ) then
    alter table public.goals
      add constraint goals_target_value_check
      check (target_value is null or target_value > 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'goals_exercise_id_fkey'
      and conrelid = 'public.goals'::regclass
  ) then
    alter table public.goals
      add constraint goals_exercise_id_fkey
      foreign key (exercise_id) references public.exercises(id) on delete set null;
  end if;
end $$;

create index if not exists goals_exercise_id_idx
  on public.goals (exercise_id)
  where exercise_id is not null;
