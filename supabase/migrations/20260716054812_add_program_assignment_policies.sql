grant select, insert, update, delete on table public.program_assignments to authenticated;

drop policy if exists program_assignments_select_managed on public.program_assignments;
create policy program_assignments_select_managed
  on public.program_assignments
  for select
  to authenticated
  using (app_private.person_is_accessible(person_id));

drop policy if exists program_assignments_insert_managed on public.program_assignments;
create policy program_assignments_insert_managed
  on public.program_assignments
  for insert
  to authenticated
  with check (
    app_private.person_is_accessible(person_id)
    and exists (
      select 1
      from public.programs p
      where p.id = program_id
        and p.is_template = true
    )
  );

drop policy if exists program_assignments_update_managed on public.program_assignments;
create policy program_assignments_update_managed
  on public.program_assignments
  for update
  to authenticated
  using (app_private.person_is_accessible(person_id))
  with check (
    app_private.person_is_accessible(person_id)
    and exists (
      select 1
      from public.programs p
      where p.id = program_id
        and p.is_template = true
    )
  );

drop policy if exists program_assignments_delete_managed on public.program_assignments;
create policy program_assignments_delete_managed
  on public.program_assignments
  for delete
  to authenticated
  using (app_private.person_is_accessible(person_id));
