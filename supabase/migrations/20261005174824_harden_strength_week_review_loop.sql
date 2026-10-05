alter function public.apply_programme_strength_week_review(
  uuid, integer, integer, integer, uuid[], text, text, jsonb, uuid
) security invoker;

create index programme_strength_week_reviews_previous_idx
  on public.programme_strength_week_reviews (previous_review_id)
  where previous_review_id is not null;

create policy programme_strength_week_reviews_insertable
  on public.programme_strength_week_reviews
  for insert to authenticated
  with check (
    app_private.person_is_accessible(person_id)
    and exists (
      select 1
      from public.program_assignments assignment
      where assignment.id = program_assignment_id
        and assignment.person_id = person_id
        and assignment.status = 'active'
    )
  );

create policy programme_strength_week_reviews_updatable
  on public.programme_strength_week_reviews
  for update to authenticated
  using (
    app_private.person_is_accessible(person_id)
    and exists (
      select 1
      from public.program_assignments assignment
      where assignment.id = program_assignment_id
        and assignment.person_id = person_id
    )
  )
  with check (
    app_private.person_is_accessible(person_id)
    and exists (
      select 1
      from public.program_assignments assignment
      where assignment.id = program_assignment_id
        and assignment.person_id = person_id
    )
  );

grant insert, update on public.programme_strength_week_reviews to authenticated;
