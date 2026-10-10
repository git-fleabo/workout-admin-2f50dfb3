-- Generic EMOM metadata only; no book workouts or person assignments.
insert into public.training_methods(id,system_key,name,family,description,default_config,is_active)
values('14fc6f55-f9b3-4162-8cdf-dd9b7f3755ee','emom','EMOM','timed_density','Start the assigned movement at the top of each minute; rest for the remainder of the minute after completing its target.','{"mode":"emom","interval_seconds":60,"block_minutes":20}'::jsonb,true)
on conflict(system_key) do nothing;
