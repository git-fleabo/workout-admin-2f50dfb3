# Training Admin data cleanup

Completed: 24 July 2026

Supabase project: `Training Admin` (`dvcdghmcqqfvlbzufpyy`)

Cleanup checksum: `workout-history-cleanup-v1-2026-07-24`

## Architecture and source of truth

Supabase is the operational source of truth. The browser app reads and writes
Supabase directly, and the active workout composer saves one `sessions` parent,
multiple `session_entries`, individual `entry_sets`, metrics, and training
method rows through the atomic `save_workout` RPC. Google Sheets is retired as
a transport. Existing `source_sheet` and `source_row` values are retained only
as historical provenance.

## Safety and rollback

The cleanup was first rehearsed in a transaction against the live schema and
rolled back. The real cleanup then created an immutable private snapshot before
changing history:

- 802 rows in `app_private.data_quality_snapshots`
- 463 rows in `public.data_quality_audit_events`
- three applied `public.data_quality_batches` records

The snapshot covers sessions, entries, sets, metrics, goals, 1RM tests, and the
exercise catalogue. `supabase/data_quality_rollback_20260724.sql` restores the
snapshot, and that rollback was also fully rehearsed inside a rolled-back
transaction. The private snapshot table is not exposed to `anon` or
`authenticated`.

## Before and after

| Check                                        |  Before | After |
| -------------------------------------------- | ------: | ----: |
| Completed parent sessions                    |     107 |    87 |
| Movement entries                             |     132 |   132 |
| Set rows                                     |     146 |   241 |
| Completed parents missing activity           |      20 |     0 |
| Completed entries missing canonical exercise |      19 |     1 |
| Linked movement/activity mismatches          | present |     0 |
| Historical aggregate rows remaining          |       0 |    13 |
| Duplicate set numbers within an entry        |       0 |     0 |
| Negative reps/load/duration/distance rows    |       0 |     0 |
| Native sessions with stale sheet labels      |      65 |     0 |

The nine reviewed high-confidence groups consolidated 29 exercise-only parents
into nine real workout sessions, reducing the parent count by 20 without
deleting movement or set rows. Distinct source notes and session RPE values are
preserved in the retained session and in the snapshot/audit trail.

## Canonicalisation and classification

- Canonical shoulder-press name: `Seated Dumbbell Shoulder Press`
- `Seated DB Shoulder Press` is a reviewed exact alias.
- `Weighted Pull Ups` resolves to `Weighted Pull-Up`.
- `Pull Ups` resolves to `Pull-Up`; weighted and unweighted pull-ups remain
  distinct.
- `Bouldering` resolves to `Bouldering Session`, using `Climbing` as the
  canonical activity.
- `Stretch Session` and `Front Split` use `Mobility/Flexibility`.
- Loaded `ATG Squats` uses `Strength`.
- Exact catalogue matches such as `Ring Muscle-Up`, `Pistol Squat`,
  `Ropes/Belay`, `Mix`, and `Bouldering Session` are linked without fuzzy
  matching.
- Mixed workouts use the explicit `Mixed Training` parent activity.

No exercise catalogue rows were merged merely because their names looked
similar. Dependent foreign keys therefore did not require destructive
repointing.

## Sets, volume, and estimated 1RM

Forty-nine reviewed rep-only aggregate imports were subsequently materialised
as individual sets using the approved balanced, non-increasing rule. Remainder
reps are placed in the earliest sets: for example, 20 total reps across three
sets becomes 7/7/6. The migration preserved all 757 affected reps exactly and
created 93 additional set rows. The previously ambiguous `Front Lever` record
was then reviewed as 1/1/1 and materialised as three individual sets. The 13
remaining aggregate rows contain duration-based data. Aggregate and unknown
shapes remain excluded from set-level PR and estimated-1RM calculations.
Estimated 1RM also rejects more than 12 reps and partial-range sets.

Volume requires exact load semantics. New dumbbell logs require the user to
choose `Per dumbbell` or `Combined dumbbell weight`; per-dumbbell rows store an
implement count of two. Historic uncertain values remain unchanged and are
excluded from comparable kg-volume.

## Prevention controls

- Reviewed aliases are exact, normalised, unique, and must target an active
  exercise.
- Completed sessions require an activity.
- A linked movement must match its exercise activity.
- Set numbers are unique and positive within an entry.
- Reps, load, duration, and distance cannot be negative.
- The atomic workout RPC creates one parent with multiple movements and derives
  the correct parent activity.
- The app automatically uses the exercise activity, requires confirmation for
  `Other`, and requires explicit dumbbell load meaning.
- Previous performance, copy/repeat set, add set, dedicated climbing logging,
  and `Historic aggregate data` display are present.

## Manual decisions still required

### Exercise identity

- 2 June 2026, entry `e99508dd-dbe8-4376-9d04-8d93d2beae10`: `Yoga` could mean
  `Yoga Flow` or `Yoga Class`. It remains unlinked and has a
  `manual_review` alias record.

### Same-day grouping

These nine groups remain separate:

- 3 June: Ring Muscle-Up + Fat Grip Hang (`Skills Tracker`)
- 11 June: Front Lever + Pistol Squat (`Skills Tracker`)
- 16 June: Front Lever + Fat Grip Hang + Pull-Up / Lat Pulldown
- 22 June: Bench Press + Ring Muscle-Up + Deadlift / Hip Hinge
- 26 June: High Bar Squat + Bench Press + Ring Muscle-Up
- 29 June: Pistol Squat + Front Lever
- 6 July: Bench Press + Seated Dumbbell Shoulder Press
- 7 July: Kettlebell Swing + Front Lever
- 9 July: Seated Dumbbell Shoulder Press + Front Lever

Their source timing, tracker meaning, duration, or delayed-entry evidence was
not strong enough for an automatic merge.

## Applied migrations

- `20260724162356_data_quality_foundations.sql`
- `20260724162406_complete_data_quality_cleanup.sql`
- `20260724162504_resolve_remaining_exact_exercises.sql`
- `20260724162643_index_data_quality_foreign_keys.sql`
- `20260724163006_retire_native_sheet_labels.sql`
- `20260724172326_split_aggregate_rep_totals.sql`
- `20260724172626_repair_aggregate_rep_split_snapshots.sql`
- `20260724173738_apply_manual_load_corrections.sql`

The local filenames match the live Supabase migration ledger.

## Verification

- Repository lint: passed with six pre-existing Fast Refresh warnings and no
  errors.
- TypeScript typecheck: passed.
- Automated tests: 11 passed.
- Production build: passed.
- Git whitespace validation: passed.
- Authenticated live `save_workout` integration test: passed and rolled back;
  it verified a two-movement mixed workout plus per-dumbbell semantics.
- Full cleanup and rollback SQL rehearsals: passed inside rolled-back
  transactions.
- Aggregate rep split: 49 entries, 757 reps before and after, zero invalid or
  increasing sequences. Its dedicated rollback was also rehearsed.
- Manual review resolved all 19 ambiguous positive-load entries: 44 set rows
  now have explicit load meaning, per-implement rows use an implement count of
  two, and assistance rows are excluded from comparable positive-load volume.
  The `Front Lever` 1/1/1 correction and its dedicated rollback were verified.
- Supabase security advisor: no new cleanup-table issue. Existing project
  notices remain for `person_app_profiles` having RLS without a policy and
  leaked-password protection being disabled.
- Supabase performance advisor: the new foreign-key index notices were fixed.

`supabase db push --dry-run` is still blocked by older project-wide migration
history drift that predates this cleanup: several early live migration versions
are absent from the local migration directory, and some older local migrations
were applied without matching ledger rows. The cleanup migrations listed above
are aligned exactly. Do not run migration-history repair blindly; compare the
older live schema and SQL effects before changing historical ledger entries.
