insert into public.training_methods (system_key, name, family, description, default_config)
values
  ('eccentrics', 'Eccentrics', 'set_method', 'Emphasises a deliberately slow, controlled lowering phase.', '{"segments":2,"eccentric_seconds":4,"rest_between_segments_seconds":60}'::jsonb),
  ('pyramid', 'Pyramid', 'set_method', 'Changes load and reps step by step through an ascending or descending sequence.', '{"segments":4,"direction":"ascending","rest_between_segments_seconds":90}'::jsonb),
  ('negatives', 'Negatives', 'set_method', 'Records eccentric-only repetitions using a controlled lowering phase.', '{"segments":3,"eccentric_seconds":5,"rest_between_segments_seconds":90}'::jsonb)
on conflict (system_key) do update
set
  name = excluded.name,
  family = excluded.family,
  description = excluded.description,
  default_config = excluded.default_config,
  is_active = true;
