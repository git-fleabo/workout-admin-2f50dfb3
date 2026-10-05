# Programme skill progression database verification

Migration `20261004193959_allow_programme_support_completion.sql` was applied narrowly to the
linked Supabase project on 5 October 2026 and recorded as applied in the migration ledger.

The migration changes the existing `complete_suggested_workout` routine so a programme-linked
support session, identified by an empty `program_workout_id`, can be completed and linked to its
workout log without advancing `current_workout_index`. Normal strength programme sessions continue
through the existing guarded advancement path.

## Verification

- The isolated PostgreSQL suite passed 10 tests. Its support-plan test completes a linked skill
  session and confirms that the plan becomes completed while the programme remains at workout
  index 0.
- The live function contains the support-session return guard, and database lint reports no schema
  errors.
- The migration ledger shows local and remote version `20261004193959` aligned.
- Live data was unchanged: `suggested_workouts` remained at 8 rows with no goal-linked plans;
  `program_assignments` remained at 2 rows with fingerprint
  `979e11a2621ed1ff206e7f349a6ea41b`; and `goals` remained at 5 rows with fingerprint
  `fbd56752314bff16a6c8841bde83af73`.

No programme, goal, scheduled workout or completed session was created or changed during live
verification.
