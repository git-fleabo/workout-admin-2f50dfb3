-- Prevent pull-up-bar movements from being offered when a circuit is filtered to bodyweight only.
update public.exercises
set equipment = case lower(name)
  when 'weighted pull-up' then 'Pull-up bar / Added weight'
  else 'Pull-up bar'
end,
updated_at = now()
where lower(name) in ('1-arm hang', 'hanging leg raise', 'weighted pull-up');
