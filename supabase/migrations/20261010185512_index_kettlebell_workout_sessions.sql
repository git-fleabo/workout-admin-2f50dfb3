-- Cover source lookups and the catalogue foreign key without touching workout data.
create index suggested_workouts_kettlebell_workout_idx
on public.suggested_workouts(kettlebell_workout_id);
