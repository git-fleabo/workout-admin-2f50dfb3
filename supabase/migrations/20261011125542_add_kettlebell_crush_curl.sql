-- Generic movement only; no book workouts or person assignments.
insert into public.exercises(id,activity_type_id,name,equipment,default_metric,circuit_pattern,circuit_dose_per_side,source_sheet,source_row)
values('1ae6e485-f4cd-47b5-a996-527a45473cb5',(select id from public.activity_types where slug='strength' limit 1),'Kettlebell Crush Curl','Kettlebell','weight_reps','pull',false,'kettlebell_variants',17)
on conflict(source_sheet,source_row) do nothing;
