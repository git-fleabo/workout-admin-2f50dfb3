-- Attribute a library exercise to the signed-in person's toolkit collection.
-- Course media and instructions remain on the provider's site.
alter table public.person_exercises
  add column toolkit_section text,
  add column toolkit_lesson_url text;

alter table public.person_exercises
  add constraint person_exercises_toolkit_section_check
    check (toolkit_section is null or toolkit_section in ('pike', 'bridge')),
  add constraint person_exercises_toolkit_lesson_url_check
    check (
      toolkit_lesson_url is null or
      (
        toolkit_section is not null and
        toolkit_lesson_url ~ '^https://www[.]matthewismith[.]com/products/mobility-flexibility-toolkit/categories/[0-9]+/posts/[0-9]+$'
      )
    );

create index person_exercises_toolkit_section_idx
  on public.person_exercises (person_id, toolkit_section)
  where toolkit_section is not null;
