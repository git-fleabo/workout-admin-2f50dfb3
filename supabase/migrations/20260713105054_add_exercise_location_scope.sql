alter table public.person_exercises
  add column if not exists location_scope text not null default 'both';

alter table public.person_exercises
  drop constraint if exists person_exercises_location_scope_check;

alter table public.person_exercises
  add constraint person_exercises_location_scope_check
  check (location_scope in ('home', 'gym', 'both'));

comment on column public.person_exercises.location_scope is
  'Per-person exercise availability for home, gym, or both training locations.';
