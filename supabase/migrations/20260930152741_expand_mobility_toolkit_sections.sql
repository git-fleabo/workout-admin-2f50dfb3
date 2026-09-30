-- One library exercise can appear in several toolkit skills, each with its own lesson.
create table public.person_exercise_toolkit_lessons (
  person_id uuid not null,
  exercise_id uuid not null,
  skill text not null check (skill in (
    'pike', 'pancake', 'side_split', 'front_split', 'shoulder', 'bridge'
  )),
  lesson_url text not null check (
    lesson_url ~ '^https://www[.]matthewismith[.]com/products/mobility-flexibility-toolkit/categories/[0-9]+/posts/[0-9]+$'
  ),
  primary key (person_id, exercise_id, skill),
  foreign key (person_id, exercise_id)
    references public.person_exercises (person_id, exercise_id) on delete cascade
);

create index person_exercise_toolkit_lessons_skill_idx
  on public.person_exercise_toolkit_lessons (person_id, skill);

alter table public.person_exercise_toolkit_lessons enable row level security;

create policy person_exercise_toolkit_lessons_select
  on public.person_exercise_toolkit_lessons
  for select to authenticated
  using (app_private.person_is_accessible(person_id));

grant select on public.person_exercise_toolkit_lessons to authenticated;

insert into public.person_exercise_toolkit_lessons (person_id, exercise_id, skill, lesson_url)
select person_id, exercise_id, toolkit_section, toolkit_lesson_url
from public.person_exercises
where toolkit_section is not null and toolkit_lesson_url is not null;

alter table public.mobility_practice_runs
  drop constraint mobility_practice_runs_skill_check,
  add constraint mobility_practice_runs_skill_check
    check (skill in ('pike', 'pancake', 'side_split', 'front_split', 'shoulder', 'bridge'));
