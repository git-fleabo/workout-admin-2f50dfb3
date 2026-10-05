create table public.coaching_preferences (
  person_id uuid primary key references public.people(id) on delete cascade,
  primary_focus_id text not null default 'programme' check (btrim(primary_focus_id) <> ''),
  secondary_focus_ids text[] not null default '{}',
  maintenance_focus_ids text[] not null default '{}',
  weekly_training_days smallint not null default 4 check (weekly_training_days between 1 and 7),
  weekly_minutes integer not null default 300 check (weekly_minutes between 30 and 1680),
  max_demanding_days smallint not null default 3 check (
    max_demanding_days between 1 and 7 and max_demanding_days <= weekly_training_days
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(secondary_focus_ids) <= 2),
  check (not (primary_focus_id = any(secondary_focus_ids))),
  check (not (primary_focus_id = any(maintenance_focus_ids))),
  check (not (secondary_focus_ids && maintenance_focus_ids))
);

create trigger coaching_preferences_set_updated_at
before update on public.coaching_preferences
for each row execute function public.set_updated_at();

alter table public.coaching_preferences enable row level security;

create policy coaching_preferences_accessible
  on public.coaching_preferences
  for all to authenticated
  using (app_private.person_is_accessible(person_id))
  with check (app_private.person_is_accessible(person_id));

grant select, insert, update on public.coaching_preferences to authenticated;
