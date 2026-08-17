-- These tables are authenticated-only. RLS policies do not replace table-level
-- privilege checks, so remove the anon role's inherited/default privileges too.
revoke all privileges on table
  public.suggested_workouts,
  public.suggested_workout_entries,
  public.suggested_workout_sets,
  public.suggested_workout_set_segments,
  public.suggested_workout_method_blocks,
  public.suggested_workout_method_block_entries,
  public.training_methods,
  public.person_training_methods,
  public.session_method_blocks,
  public.session_method_block_entries
from anon;
