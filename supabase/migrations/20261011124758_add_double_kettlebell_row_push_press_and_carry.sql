-- Generic double-bell movements only; no book workouts or person assignments.
insert into public.exercises(id,activity_type_id,name,equipment,default_metric,circuit_pattern,circuit_dose_per_side,source_sheet,source_row)
values
('09a202ad-42de-471a-b227-ab6fe32f2611',(select id from public.activity_types where slug='strength' limit 1),'Double Kettlebell Row','Kettlebell','weight_reps','pull',false,'kettlebell_variants',14),
('f07c55c7-b3a2-4e16-843e-8e4e3312bf0f',(select id from public.activity_types where slug='strength' limit 1),'Double Kettlebell Push Press','Kettlebell','weight_reps','push',false,'kettlebell_variants',15),
('45da76c0-f7be-42dd-9589-e9e4de5970c4',(select id from public.activity_types where slug='strength' limit 1),'Double Kettlebell Farmer Carry','Kettlebell','carry','carry',false,'kettlebell_variants',16)
on conflict(source_sheet,source_row) do nothing;
