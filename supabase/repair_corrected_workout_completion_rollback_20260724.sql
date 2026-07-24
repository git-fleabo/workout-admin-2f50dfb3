begin;

set local statement_timeout = '5s';

update public.sessions
set
  activity_type_id = null,
  completed = false
where id = '26096f13-436a-423f-88c6-49f13d7b35dc'
  and session_date = date '2026-07-24'
  and title = 'Workout'
  and created_at = timestamptz '2026-07-24 17:50:14.89327+00';

drop policy if exists sessions_update_managed on public.sessions;

commit;
