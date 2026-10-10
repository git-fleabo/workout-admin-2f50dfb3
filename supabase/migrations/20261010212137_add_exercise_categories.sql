-- Extra categories supplement the existing default activity_type_id.
create table public.exercise_activity_types (
  -- Separate identity keeps existing exercises -> activity_types API joins unambiguous.
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  activity_type_id uuid not null references public.activity_types(id) on delete cascade,
  unique (exercise_id, activity_type_id)
);
create index exercise_activity_types_activity_type_idx on public.exercise_activity_types(activity_type_id);
alter table public.exercise_activity_types enable row level security;
revoke all on public.exercise_activity_types from public, anon;
grant select, insert, delete on public.exercise_activity_types to authenticated;
create policy exercise_activity_types_read on public.exercise_activity_types for select to authenticated using (true);
create policy exercise_activity_types_insert_admin on public.exercise_activity_types for insert to authenticated
with check ((select app_private.current_person_is_admin()));
create policy exercise_activity_types_delete_admin on public.exercise_activity_types for delete to authenticated
using ((select app_private.current_person_is_admin()));

create function public.set_exercise_categories(p_exercise_id uuid, p_categories text[])
returns void language plpgsql security invoker set search_path='' as $$
declare exercise public.exercises%rowtype; names text[]; category_ids uuid[];
begin
  if auth.uid() is null or not coalesce(app_private.current_person_is_admin(),false) then
    raise exception 'Only Library administrators can edit exercise categories.';
  end if;
  if p_categories is null or cardinality(p_categories)>20
    or exists(select 1 from unnest(p_categories) name where name is null or length(btrim(name)) not between 1 and 100) then
    raise exception 'Choose up to 20 valid categories.';
  end if;
  select * into exercise from public.exercises where id=p_exercise_id for update;
  if not found then raise exception 'The Library exercise was not found.'; end if;
  select coalesce(array_agg(distinct btrim(name)),array[]::text[]) into names from unnest(p_categories) name;
  select coalesce(array_agg(id),array[]::uuid[]) into category_ids from public.activity_types where name=any(names);
  if cardinality(category_ids)<>cardinality(names) then raise exception 'A category changed. Refresh the Library before saving.'; end if;
  delete from public.exercise_activity_types where exercise_id=p_exercise_id;
  insert into public.exercise_activity_types(exercise_id,activity_type_id)
    select p_exercise_id,id from unnest(category_ids) id where id is distinct from exercise.activity_type_id;
end; $$;
revoke all on function public.set_exercise_categories(uuid,text[]) from public, anon;
grant execute on function public.set_exercise_categories(uuid,text[]) to authenticated;
notify pgrst, 'reload schema';
