-- Initial seed for the single-user admin app migration.
-- This creates Noam as the first tracked person and assigns the full admin app.

with inserted_person as (
  insert into public.people (display_name, notes)
  select 'Noam', 'Initial person imported from the Google Sheets admin app.'
  where not exists (
    select 1
    from public.people
    where display_name = 'Noam'
      and email is null
  )
  returning id
),
noam as (
  select id from inserted_person
  union all
  select id
  from public.people
  where display_name = 'Noam'
    and email is null
  order by id
  limit 1
),
full_admin as (
  select id
  from public.app_profiles
  where slug = 'full-training-admin'
)
insert into public.person_app_profiles (person_id, app_profile_id, is_default)
select noam.id, full_admin.id, true
from noam, full_admin
on conflict (person_id, app_profile_id) do update
set is_default = excluded.is_default;

with noam as (
  select id
  from public.people
  where display_name = 'Noam'
    and email is null
  order by id
  limit 1
)
insert into public.admin_people (admin_person_id, managed_person_id, role)
select id, id, 'admin'
from noam
on conflict (admin_person_id, managed_person_id) do update
set role = excluded.role;
