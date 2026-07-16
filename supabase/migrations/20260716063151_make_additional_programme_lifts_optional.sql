update public.program_workout_entries entry
set is_optional = entry.slot_key <> 'main_lift_1',
    updated_at = now()
from public.program_workouts workout
join public.programs program on program.id = workout.program_id
where entry.program_workout_id = workout.id
  and program.name in ('Operator Style Strength Block', 'Fighter Style Strength Block')
  and entry.slot_key in ('main_lift_1', 'main_lift_2', 'main_lift_3', 'main_lift_4');

update public.programs
set description = case name
      when 'Operator Style Strength Block'
        then 'Six-week, three-days-per-week percentage strength template with one required lift and two optional lifts per session.'
      when 'Fighter Style Strength Block'
        then 'Six-week, two-days-per-week percentage strength template with one required lift and three optional lifts per session.'
    end,
    updated_at = now()
where name in ('Operator Style Strength Block', 'Fighter Style Strength Block');
