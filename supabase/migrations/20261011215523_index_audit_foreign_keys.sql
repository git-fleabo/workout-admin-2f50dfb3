-- Cover the two foreign keys reported by the Supabase performance advisor.
-- B-tree indexes only: no changes to rows, permissions or workout behaviour.
create index if not exists coaching_recommendation_decisions_suggested_workout_idx
  on public.coaching_recommendation_decisions (suggested_workout_id);
create index if not exists sessions_mobility_practice_owner_idx
  on public.sessions (mobility_practice_run_id, person_id);
