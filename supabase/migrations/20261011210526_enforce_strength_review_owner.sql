-- Qualify the review row in RLS, and enforce owner consistency independently
-- of RLS (including privileged writes and later assignment-owner changes).
alter table public.program_assignments
  add constraint program_assignments_id_person_unique unique (id, person_id);
alter table public.programme_strength_week_reviews
  add constraint programme_strength_week_reviews_assignment_owner_fk
  foreign key (program_assignment_id, person_id)
  references public.program_assignments(id, person_id) on delete cascade;

create index programme_strength_week_reviews_assignment_owner_idx
  on public.programme_strength_week_reviews(program_assignment_id, person_id);

alter policy programme_strength_week_reviews_accessible
on public.programme_strength_week_reviews
using (
  app_private.person_is_accessible(programme_strength_week_reviews.person_id)
  and exists (
    select 1 from public.program_assignments assignment
    where assignment.id = programme_strength_week_reviews.program_assignment_id
      and assignment.person_id = programme_strength_week_reviews.person_id
  )
);

alter policy programme_strength_week_reviews_insertable
on public.programme_strength_week_reviews
with check (
  app_private.person_is_accessible(programme_strength_week_reviews.person_id)
  and exists (
    select 1 from public.program_assignments assignment
    where assignment.id = programme_strength_week_reviews.program_assignment_id
      and assignment.person_id = programme_strength_week_reviews.person_id
      and assignment.status = 'active'
  )
);
alter policy programme_strength_week_reviews_updatable
on public.programme_strength_week_reviews
using (
  app_private.person_is_accessible(programme_strength_week_reviews.person_id)
  and exists (
    select 1 from public.program_assignments assignment
    where assignment.id = programme_strength_week_reviews.program_assignment_id
      and assignment.person_id = programme_strength_week_reviews.person_id
  )
)
with check (
  app_private.person_is_accessible(programme_strength_week_reviews.person_id)
  and exists (
    select 1 from public.program_assignments assignment
    where assignment.id = programme_strength_week_reviews.program_assignment_id
      and assignment.person_id = programme_strength_week_reviews.person_id
  )
);
