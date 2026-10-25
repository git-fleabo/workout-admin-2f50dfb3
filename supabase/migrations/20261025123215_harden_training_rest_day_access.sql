-- An authenticated account without a linked profile produces NULL from the
-- shared access helper. Reject that explicitly before attempting any writes.
do $$
declare definition text;
begin
  definition := pg_get_functiondef('public.set_training_rest_day(uuid,date,boolean,boolean)'::regprocedure);
  if position('not app_private.person_is_accessible(p_person_id)' in definition)=0 then
    raise exception 'Unexpected rest-day function definition; review the access guard.';
  end if;
  execute replace(definition,
    'not app_private.person_is_accessible(p_person_id)',
    'app_private.person_is_accessible(p_person_id) is not true');
end $$;
notify pgrst, 'reload schema';
