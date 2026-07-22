alter table public.suggested_workout_entries
  add column if not exists tracking_mode text,
  add column if not exists target_metrics jsonb not null default '{}'::jsonb;

alter table public.suggested_workout_entries
  drop constraint if exists suggested_workout_entries_tracking_mode_check,
  add constraint suggested_workout_entries_tracking_mode_check
    check (
      tracking_mode is null or tracking_mode in (
        'weight_reps',
        'reps_only',
        'hold',
        'grip_hold',
        'distance_time',
        'duration',
        'conditioning',
        'carry',
        'mobility_position',
        'power',
        'climbing'
      )
    ),
  drop constraint if exists suggested_workout_entries_target_metrics_object_check,
  add constraint suggested_workout_entries_target_metrics_object_check
    check (jsonb_typeof(target_metrics) = 'object');

alter table public.suggested_workout_sets
  add column if not exists duration_seconds numeric;

alter table public.suggested_workout_sets
  drop constraint if exists suggested_workout_sets_duration_seconds_check,
  add constraint suggested_workout_sets_duration_seconds_check
    check (duration_seconds is null or duration_seconds >= 0);

comment on column public.suggested_workout_entries.tracking_mode is
  'Canonical movement tracking mode used to render and hand off planned targets.';
comment on column public.suggested_workout_entries.target_metrics is
  'Movement-level planned targets such as duration_minutes, distance, distance_unit, rounds, height, and detail.';
comment on column public.suggested_workout_sets.duration_seconds is
  'Per-set planned hold or work duration in seconds.';
