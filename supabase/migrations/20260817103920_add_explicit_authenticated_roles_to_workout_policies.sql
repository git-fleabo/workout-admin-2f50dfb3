-- Make the existing authenticated-only table grants explicit in the policies.
-- ALTER POLICY changes only the target role; existing USING/WITH CHECK predicates remain unchanged.

alter policy suggested_workouts_select_accessible
  on public.suggested_workouts to authenticated;
alter policy suggested_workouts_insert_accessible
  on public.suggested_workouts to authenticated;
alter policy suggested_workouts_update_accessible
  on public.suggested_workouts to authenticated;
alter policy suggested_workouts_delete_accessible
  on public.suggested_workouts to authenticated;

alter policy suggested_workout_entries_select_accessible
  on public.suggested_workout_entries to authenticated;
alter policy suggested_workout_entries_insert_accessible
  on public.suggested_workout_entries to authenticated;
alter policy suggested_workout_entries_update_accessible
  on public.suggested_workout_entries to authenticated;
alter policy suggested_workout_entries_delete_accessible
  on public.suggested_workout_entries to authenticated;

alter policy suggested_workout_sets_select_accessible
  on public.suggested_workout_sets to authenticated;
alter policy suggested_workout_sets_insert_accessible
  on public.suggested_workout_sets to authenticated;
alter policy suggested_workout_sets_update_accessible
  on public.suggested_workout_sets to authenticated;
alter policy suggested_workout_sets_delete_accessible
  on public.suggested_workout_sets to authenticated;

alter policy suggested_workout_set_segments_select_accessible
  on public.suggested_workout_set_segments to authenticated;
alter policy suggested_workout_set_segments_insert_accessible
  on public.suggested_workout_set_segments to authenticated;

alter policy suggested_workout_method_blocks_select_accessible
  on public.suggested_workout_method_blocks to authenticated;
alter policy suggested_workout_method_blocks_insert_accessible
  on public.suggested_workout_method_blocks to authenticated;

alter policy suggested_workout_method_block_entries_select_accessible
  on public.suggested_workout_method_block_entries to authenticated;
alter policy suggested_workout_method_block_entries_insert_accessible
  on public.suggested_workout_method_block_entries to authenticated;

alter policy training_methods_select_accessible
  on public.training_methods to authenticated;
alter policy training_methods_insert_accessible
  on public.training_methods to authenticated;
alter policy training_methods_update_accessible
  on public.training_methods to authenticated;
alter policy training_methods_delete_accessible
  on public.training_methods to authenticated;

alter policy person_training_methods_select_accessible
  on public.person_training_methods to authenticated;
alter policy person_training_methods_insert_accessible
  on public.person_training_methods to authenticated;
alter policy person_training_methods_update_accessible
  on public.person_training_methods to authenticated;
alter policy person_training_methods_delete_accessible
  on public.person_training_methods to authenticated;

alter policy session_method_blocks_select_accessible
  on public.session_method_blocks to authenticated;
alter policy session_method_blocks_insert_accessible
  on public.session_method_blocks to authenticated;

alter policy session_method_block_entries_select_accessible
  on public.session_method_block_entries to authenticated;
alter policy session_method_block_entries_insert_accessible
  on public.session_method_block_entries to authenticated;
