-- Day-only dismissal from Today and the Log screen's quick-start lists.
-- The saved prescription, scheduled date and lifecycle status stay intact.
alter table public.suggested_workouts add column dismissed_for_date date;
