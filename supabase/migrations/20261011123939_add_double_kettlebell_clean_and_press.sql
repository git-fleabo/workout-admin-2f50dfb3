-- Generic combined movement: each rep includes a fresh clean before its press.
insert into public.exercises(id,activity_type_id,name,equipment,default_metric,circuit_pattern,circuit_dose_per_side,source_sheet,source_row)
values('93d5b53e-0a33-4c4c-b27a-e85ba3e8915f',(select id from public.activity_types where slug='strength' limit 1),'Double Kettlebell Clean and Press','Kettlebell','weight_reps','full_body',false,'kettlebell_variants',13)
on conflict(source_sheet,source_row) do nothing;
