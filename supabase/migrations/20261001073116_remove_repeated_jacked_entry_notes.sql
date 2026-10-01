-- JACKED's ordinary movement rows all inherited the same programme-wide
-- instruction. Keep that guidance once at programme/workout level while
-- preserving genuinely specific challenge and substitution notes.
update public.program_workout_entries entry
set notes = null
from public.program_workouts workout
join public.programs programme on programme.id = workout.program_id
where entry.program_workout_id = workout.id
  and programme.method_type = 'jacked_dumbbell'
  and entry.notes = 'Use the source programme''s ignitor-set path, box score, Back to JACKED rule and protector/lifeline protocol. Add or remove logger rows as needed and record actual reps and dumbbell load.';

do $$
declare
  repeated_note_count integer;
begin
  select count(*)
  into repeated_note_count
  from public.program_workout_entries entry
  join public.program_workouts workout on workout.id = entry.program_workout_id
  join public.programs programme on programme.id = workout.program_id
  where programme.method_type = 'jacked_dumbbell'
    and entry.notes = 'Use the source programme''s ignitor-set path, box score, Back to JACKED rule and protector/lifeline protocol. Add or remove logger rows as needed and record actual reps and dumbbell load.';

  if repeated_note_count <> 0 then
    raise exception 'JACKED still has % repeated generic movement notes', repeated_note_count;
  end if;
end
$$;
