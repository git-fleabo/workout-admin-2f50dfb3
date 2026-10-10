-- Generic movement variants and AMRAP metadata only; no book workouts or person assignments.
insert into public.exercises(id,activity_type_id,name,equipment,default_metric,circuit_pattern,circuit_dose_per_side,source_sheet,source_row)
values
('897428c6-0d67-4c59-a00e-cf778101c34f',(select id from public.activity_types where slug='strength' limit 1),'Single-Arm Kettlebell Squat','Kettlebell','weight_reps','squat',true,'kettlebell_variants',1),
('14f932cd-4754-43cb-96eb-e070b1bc9c5c',(select id from public.activity_types where slug='strength' limit 1),'Single-Arm Kettlebell Swing','Kettlebell','weight_reps','hinge',true,'kettlebell_variants',2),
('7b13d6c3-62f2-4be0-9df2-3fc453a3433e',(select id from public.activity_types where slug='strength' limit 1),'Kettlebell Reverse Turkish Get-Up','Kettlebell','weight_reps','full_body',true,'kettlebell_variants',3),
('86b77b83-7d59-4fd5-b04f-67d89d0e4945',(select id from public.activity_types where slug='strength' limit 1),'Double Kettlebell Clean','Kettlebell','weight_reps','hinge',false,'kettlebell_variants',4),
('8a965035-7de5-4c62-be05-60bdcf8831ae',(select id from public.activity_types where slug='strength' limit 1),'Double Kettlebell Military Press','Kettlebell','weight_reps','push',false,'kettlebell_variants',5),
('7289bdd4-82a1-4cb0-ba81-76fbf64c09f1',(select id from public.activity_types where slug='strength' limit 1),'Double Kettlebell Swing','Kettlebell','weight_reps','hinge',false,'kettlebell_variants',6)
on conflict(source_sheet,source_row) do nothing;

insert into public.training_methods(id,system_key,name,family,description,default_config,is_active)
values('e80beee5-3677-484f-8a3d-6aac5459b61e','amrap','AMRAP','timed_density','Repeat the listed sequence for as many completed rounds as possible within the time limit.','{"mode":"amrap","block_minutes":20}'::jsonb,true)
on conflict(system_key) do nothing;
