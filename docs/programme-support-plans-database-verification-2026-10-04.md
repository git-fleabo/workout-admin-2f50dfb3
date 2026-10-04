# Programme support plans database verification

Migration `20261004191240_add_programme_support_plans.sql` was applied narrowly to the linked
Supabase project on 4 October 2026, then recorded as applied in the migration ledger. Older local
and remote migration drift was not pushed.

The migration adds an optional `goal_id` link to `suggested_workouts`, adds `skill` to the existing
plan-kind constraint, and installs an authenticated security-invoker trigger. A goal-linked plan
must use an active exercise goal owned by the same person, belong to a current programme, and leave
`program_workout_id` empty so it cannot replace or advance a strength session. Programme-linked
mobility plans are checked against the same assignment ownership rule as goal plans.

## Verification

- The isolated PostgreSQL suite passed 10 tests, including valid same-person support plans and
  rejection of wrong-kind, wrong-owner and paused-goal plans.
- The live `goal_id` column, `skill` constraint, supporting-goal index and enabled guard trigger are
  present.
- The migration ledger shows local and remote version `20261004191240` aligned.
- Existing data was unchanged: `suggested_workouts` remained at 8 rows and all 8 new `goal_id`
  values are null; `goals` remained at 5 rows with fingerprint
  `7ccfff7537595aca9d7549e91074ffb7`; `program_assignments` remained at 2 rows with fingerprint
  `56710b2f0f39df7d410b178392a06520`.
- Generated database types include the new nullable goal relationship and match the checked-in
  `suggested_workouts` shape.
- The security advisor reports only the existing project-level leaked-password-protection setting;
  the migration introduced no table, view, function or RLS warning.

No programme, goal, mobility practice or scheduled workout was created or changed during the live
verification.
