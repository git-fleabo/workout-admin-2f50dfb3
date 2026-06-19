-- Allow signed-in app users to read reusable programme templates.
-- This is read-only and intentionally limited to template rows plus their child workouts/entries.

drop policy if exists programs_select_templates_authenticated on public.programs;
create policy programs_select_templates_authenticated
  on public.programs
  for select
  to authenticated
  using (is_template = true);

drop policy if exists program_workouts_select_template_authenticated on public.program_workouts;
create policy program_workouts_select_template_authenticated
  on public.program_workouts
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.programs p
      where p.id = public.program_workouts.program_id
        and p.is_template = true
    )
  );

drop policy if exists program_workout_entries_select_template_authenticated on public.program_workout_entries;
create policy program_workout_entries_select_template_authenticated
  on public.program_workout_entries
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.program_workouts pw
      join public.programs p on p.id = pw.program_id
      where pw.id = public.program_workout_entries.program_workout_id
        and p.is_template = true
    )
  );
