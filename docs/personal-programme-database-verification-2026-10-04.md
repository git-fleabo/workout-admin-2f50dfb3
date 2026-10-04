# Personal programme database verification

Verified 2026-10-04 against Training Admin (`dvcdghmcqqfvlbzufpyy`).

## Installation and release boundary

Noam approved installing the prepared personal-programme migration. Its exact SQL was applied
narrowly through Supabase's migration tool, which recorded version `20261004132906` and name
`editable_personal_programmes`. The local file was renamed to
`supabase/migrations/20261004132906_editable_personal_programmes.sql` to match that ledger entry;
its SQL is unchanged. Historical ledger divergence was not repaired or blanket-pushed.

The database is ready. The matching frontend remains a local repository change pending
GitHub Desktop push and Lovable publishing. No real personal programme or workout was created.

## Live checks

- Both new tables exist, have RLS enabled and contain zero rows. Five authenticated person-scoped
  policies are installed. Anonymous table reads are denied; authenticated SELECT grants exist.
- `create_personal_programme`, `save_personal_programme_sessions`,
  `start_personal_programme_session` and `change_programme_run` are security-invoker functions
  with empty search paths. Authenticated execution is granted; anonymous execution is denied.
- Real REST requests using the frontend publishable key see both new tables and return 401 /
  PostgreSQL 42501 for anonymous reads, rather than missing-table or schema-cache errors.
- An authenticated-role transaction verified the missing-identity creation guard and rejection
  of saving or starting an inaccessible run. It was rolled back and persisted no records.
  Existing nonempty personal-plan isolation and successful lifecycle paths were tested locally,
  not by creating live user training data.
- Security advisors are identical before and after installation: the existing leaked-password
  protection warning remains. No new security warning was introduced. Performance advisors show
  an informational unused-index notice for the new, empty session table's foreign-key index;
  the index is retained for future use.

## Existing data preservation

Counts and fingerprints below match before installation, after installation and after access checks.
The fingerprint is MD5 of all full-row JSON representations, sorted and newline-joined. This is a
change-detection check; it is not a replacement for a database backup. No user field values are
included in this note.

| Table | Rows before and after | Full-row fingerprint |
| --- | ---: | --- |
| `programs` | 4 | `4ab12c3a9239d2c248c004ce8aba38cf` |
| `program_workouts` | 124 | `55e39d6f8c6e5b5fab0446d7bc17e905` |
| `program_workout_entries` | 546 | `313d92c77a6d099132cdbad421173936` |
| `program_assignments` | 2 | `a0a8feed2e9a1afb1d367d62b3795855` |
| `program_assignment_exercises` | 5 | `9fd83454aee800adef128a704fd3933d` |
| `program_assignment_exercise_pools` | 19 | `ca0d2df8e0e2258d5edda25d62a87950` |
| `suggested_workouts` | 8 | `b809f1c0c1e09c4eec7ab838c6378aac` |
| `suggested_workout_entries` | 21 | `b52b892ad3488a30cff38766cfaea7a9` |
| `suggested_workout_sets` | 69 | `afcbcc906c3abcd647057ff9a5a356e2` |
| `sessions` | 113 | `b28d6d5f294e870c3f0cf8bf6f60ab47` |
| `session_entries` | 193 | `6514dfb5f3910d1487cf563cd66c1c94` |
| `entry_sets` | 368 | `634bbd23857789d2025cea543611aab0` |
| `entry_metrics` | 156 | `6c44aaf9f39e33072a32a4cc20267677` |
| `exercises` | 372 | `f37b221d95c501ce47910b623e61f2a4` |
| `training_locations` | 4 | `35914460efba25ecfe3b4a7265117c65` |

## Local verification after ledger alignment

The isolated PostgreSQL lifecycle suite passed all 8 tests with no skips after the filename change.
It verifies draft creation, stale-revision and atomic-batch rejection, activation targets, starting
and snapshotting the next session, person/anonymous isolation, protected started sessions, and
completion/restart history. It creates and removes a temporary local cluster, never the live project.

Earlier implementation verification passed 88 non-database tests, 26 component tests, type checking,
production build and lint of changed frontend files. Only documentation and migration filename/test
path changed during live installation, so the database suite was rerun for this release step.
