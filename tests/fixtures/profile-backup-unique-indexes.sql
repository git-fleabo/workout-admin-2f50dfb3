-- Unique indexes outside pg_constraint, from the same schema snapshot.
CREATE UNIQUE INDEX data_quality_batches_person_checksum_uidx ON public.data_quality_batches USING btree (person_id, approved_checksum) WHERE (approved_checksum IS NOT NULL);
CREATE UNIQUE INDEX entry_sets_entry_set_number_uidx ON public.entry_sets USING btree (session_entry_id, set_number);
CREATE UNIQUE INDEX equipment_items_person_name_unique ON public.equipment_items USING btree (person_id, lower(name));
CREATE UNIQUE INDEX exercise_aliases_activity_uidx ON public.exercise_aliases USING btree (normalized_alias, activity_type_id) WHERE ((activity_type_id IS NOT NULL) AND (status = 'reviewed'::text));
CREATE UNIQUE INDEX exercise_aliases_global_uidx ON public.exercise_aliases USING btree (normalized_alias) WHERE ((activity_type_id IS NULL) AND (status = 'reviewed'::text));
CREATE UNIQUE INDEX mobility_practice_one_current_per_skill_idx ON public.mobility_practice_runs USING btree (person_id, skill) WHERE (status = ANY (ARRAY['active'::text, 'paused'::text]));
CREATE UNIQUE INDEX person_exercises_quick_log_order_uidx ON public.person_exercises USING btree (person_id, quick_log_order) WHERE is_quick_log;
CREATE UNIQUE INDEX program_assignments_one_active_per_person_uidx ON public.program_assignments USING btree (person_id) WHERE (status = 'active'::text);
CREATE UNIQUE INDEX kettlebell_session_request_unique ON public.suggested_workouts USING btree (person_id, kettlebell_request_id) WHERE (kettlebell_request_id IS NOT NULL);
CREATE UNIQUE INDEX suggested_workouts_open_programme_session_uidx ON public.suggested_workouts USING btree (program_assignment_id, program_workout_id) WHERE ((program_assignment_id IS NOT NULL) AND (program_workout_id IS NOT NULL) AND (status = ANY (ARRAY['pending'::text, 'accepted'::text])));
