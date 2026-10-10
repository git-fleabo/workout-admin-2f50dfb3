-- Generic movement variants and timed-sequence metadata only; no book workouts or person assignments.
insert into public.exercises(id,activity_type_id,name,equipment,default_metric,circuit_pattern,circuit_dose_per_side,source_sheet,source_row)
values
('4219e015-4dec-4c5c-95c4-801e79087ac7',(select id from public.activity_types where slug='strength' limit 1),'Kettlebell Reverse Lunge','Kettlebell','weight_reps','lunge',true,'kettlebell_variants',7),
('99d573c9-9e90-4fcf-a087-7435437d442d',(select id from public.activity_types where slug='strength' limit 1),'Kettlebell Single-Leg Deadlift','Kettlebell','weight_reps','hinge',true,'kettlebell_variants',8),
('de96aff3-ce76-4fa4-a9c5-e7179bf5dea7',(select id from public.activity_types where slug='strength' limit 1),'Kettlebell Swing Burpee','Kettlebell','weight_reps','full_body',true,'kettlebell_variants',9),
('6366595d-21ac-4e86-b96d-0080a47528a3',(select id from public.activity_types where slug='strength' limit 1),'Single-Arm Kettlebell Thruster','Kettlebell','weight_reps','full_body',true,'kettlebell_variants',10),
('40989646-357e-4f7a-a76f-831200b5053f',(select id from public.activity_types where slug='strength' limit 1),'Kettlebell Reverse Lunge to Overhead Press','Kettlebell','weight_reps','full_body',true,'kettlebell_variants',11),
('3dc6b53a-0449-4ca1-bc77-2fd2635d7b08',(select id from public.activity_types where slug='conditioning' limit 1),'Hop in Place','Bodyweight','duration','locomotion',false,'kettlebell_variants',12)
on conflict(source_sheet,source_row) do nothing;

insert into public.training_methods(id,system_key,name,family,description,default_config,is_active)
values('26a66cd6-2219-43e6-a1b4-9266ebf7b95d','timed_sequence','Timed sequence','exercise_group','Follow the ordered movement durations, then rest between complete rounds as prescribed.','{"mode":"timed_sequence"}'::jsonb,true)
on conflict(system_key) do nothing;
