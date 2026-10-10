# Programme and adaptive coach verification — 10 October 2026

## Scope and evidence

Started from clean `main` at `b6e1fbd`. The live signed-in app visibly served `B6E1FBD`.
The linked Supabase project contained the coach migrations through
`20261005182137_add_week_scoped_strength_volume.sql`. The user gave fresh permission for a
disposable programme/coach journey and signed in personally. No credentials or verification
codes were requested, handled or saved in repository artifacts.

Before any live writes, captured row counts and ordered JSON row hashes for **all 54 public tables**.
After cleanup, every count and hash matched exactly; a final read-only comparison also matched.
The private baseline and temporary screenshots are outside the repository. Test data, coach
preferences, decisions, outcomes, plans, logs, goals and programme copies were removed. No real
completed training history was edited or deleted. No live schema migration was applied during the initial journey.

## Signed-in journey on the published baseline

| Check                         | Observed result                                                                                                                                                                                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personal copy and future date | Paused copy saved with 12 October start; explicit activation tested. A date-fill automation initially failed to trigger the form update; normal keyboard input confirmed correct persistence.                                                                    |
| Editor and prescription       | Reviewed multiple weeks; changed exercise, load/reps, rest and date. Copy-forward preview identified 23 matching future slots; save confirmed. Revert and Keep editing navigation protection worked.                                                             |
| Supporting tracks             | Saved mobility plus a new handstand goal and dose. Plans retained the assignment link with no programme-workout link.                                                                                                                                            |
| Priorities and capacity       | Saved primary/supporting/maintenance choices and time/day limits. Newly created goal was absent from cached coach choices: repaired locally.                                                                                                                     |
| Unified review and drafting   | Previewed additions, moved a proposed date, excluded/reincluded it and saved an approved addition. Nothing saved on preview alone.                                                                                                                               |
| Stale draft                   | Changed an actual saved mobility plan while the draft was open. Applying the stale draft was rejected with no new addition. An earlier empty placeholder was not a valid stale fixture because empty plans are excluded from the view.                           |
| Reject and edited acceptance  | Rejection preserved the climbing date. A separate accepted move retained the user's edited destination, different from the proposed one. The disposable rejection was removed between paths because the coach deliberately allows one bounded decision per week. |
| Completion and learning       | Completed handstand support; strength index remained zero. Completed the moved climbing plan and recorded About right.                                                                                                                                           |
| Strength preview              | The flow excludes personal copies. Used a separate disposable native assignment to inspect exact dates, sets, repetitions, loads and rest. Left the preview unapplied; no real programme history was overwritten.                                                |
| Early completion accounting   | Review/capacity retained the planned date and also inferred actual completed load, producing duplicates and an extra Home strength session for handstand practice. Repaired locally.                                                                             |
| Cleanup                       | Deleted every disposable record and restored original preferences. All 54 table counts/hashes matched the baseline exactly.                                                                                                                                      |

## Repository repairs

- Normalize template workouts to their ordered zero-based positions without changing stored source
  labels. Use the same position semantics for future personal exercise context, editing/activation
  guards, skipping ahead and exact strength-week validation. Tests cover zero-based, one-based and
  gapped labels, locked prior sessions and preserved completion snapshots.
- Invalidate coach goal choices when a supporting goal is created. Wrap workload-history loading
  so the query framework cannot pass its context object as the numeric lookback window. Correct
  related readiness/decision/dose type annotations without changing their existing rules.
- Query completed supporting plans by their linked session's actual date, including completion across
  a week boundary. Preserve the original scheduled date separately. Capacity uses recorded minutes
  when available and falls back to an estimate otherwise.
- Carry completed session IDs into weekly evidence so Home/Gym and activity summaries do not invent
  another session already represented by completed saved work. Preserve separate unmatched strength
  logs on the same day. Include changed completion evidence and saved prescriptions in draft staleness.
- Extract the existing reviewed-draft save flow so the route and integration journey use the same
  fingerprint/selection checks and compensation. A successful partial save is archived on later
  failure; failed compensation now reports that sessions remain rather than hiding that failure.
- Put changes to review before the calendar and move detailed adaptive stance into the evidence
  disclosure. Explain Today, optional support and the next review point. Show the personal
  strength-review limitation explicitly.

The SQL repair is `20261010000854_fix_programme_workout_positions.sql`. It preserves invoker security,
RLS, existing RPC interfaces and grants, approval bounds, source labels and training history. It is
**unapplied to live Supabase at the initial verification**. It was subsequently applied as recorded
below. Frontend publication remains user-reported, not independently verified in this follow-up.

## Isolated automated journey

`npm run test:database` creates a unique temporary PostgreSQL cluster with Unix-socket access only,
loads minimal dependency fixtures and the real relevant migrations, then destroys the cluster in
`finally`. No private database credentials or live connection are used. PostgreSQL binaries are
found on PATH; set `PERSONAL_PROGRAMME_PG_BIN` to a folder containing `initdb`, `pg_ctl` and `psql`
if necessary. Missing binaries produce an explicit skip, rather than replacing database assertions.

The original personal-programme test now runs alongside the new coach journey. The latter covers:

- Creation, activation, future revisions and protected started/completed snapshots.
- Same-person support, completion safety and outcome prerequisites.
- Rejection, edited acceptance, stale decision rejection and atomic rollback after an update.
- Foreign-person reads/writes and anonymous helper/RPC access.
- Week-two progress through one-based and gapped template labels; safe skipping preserves prior work.
- Bounded native strength-week load/set adjustment and invalid range rejection without writes.
- Actual draft engine + shared save flow: changed stored preferences reject a stale draft; a second
  save failure archives the first addition; a successful retry preserves edited dates.
- Exact journey-table baseline restoration and deletion of the temporary database directory.

Fixtures model the dependencies and person-scoped RLS needed by these migrations; this is not a full
Supabase service emulator or browser-to-PostgREST integration test. The live relationship name for
completed plans was verified read-only. The embedded date-filter syntax was checked against the live
API parser; anonymous access remained denied. Authenticated persistence mapping is regression-tested
with a mocked browser transport, so the published repair still needs a signed-in check.

## Two-week scenario and usability

The date-advanced scenario spans 12–25 October. It combines three weekly strength sessions with
climbing, yoga, mobility and short skill practice inside one saved capacity budget. Initial sparse
readiness holds the coach to one optional addition beside strength. Completed support and an accepted
change rated from pain/effort evidence feed a steady rollover and a later Build stance. Adding a pain
score to the same evidence switches to Protect, blocks dose progression and rejects the old draft
fingerprint despite positive prior feedback.

The scenario checks the evidence loop, not actual training efficacy. A real fortnight of usage and
review of the published repairs remains outstanding. Personal strength-week adaptation is also still
unavailable; this is an explicit product gap, not a passed lifecycle check.

## Validation

- `npm test`: **190 passed, zero skipped**, including the 20 database assertions/subtests across both isolated journeys.
- `npm run test:components`: **52 passed**.
- `npx tsc --noEmit`: passed.
- `npm run lint`: zero errors; eight existing Fast Refresh warnings.
- `npm run build`: passed; existing chunk-size, third-party directive and Nitro option warnings remain.
- `git diff --check`: passed.
- Fresh remote check: `origin/main` was still `b6e1fbd` before the local commit.

No publishing, pushing or deployment is performed in this task.

## Live migration follow-up — 10 October 2026

After reporting that the frontend changes were published, Noam explicitly authorized applying the
pending database migration. Applied exactly `20261010000854_fix_programme_workout_positions.sql` to
project `dvcdghmcqqfvlbzufpyy`. Remote migration history records version `20261010000854` with name
`fix_programme_workout_positions`; all 77 previous entries remain intact.

The checkout lacks some older remote migration files. To avoid modifying history or replaying older
SQL, used a temporary CLI runner with markers for already-applied versions and the single reviewed
migration. Its dry run listed only the intended file. The migration was then applied with its original
repository version. The temporary runner was removed afterwards.

Verification:

- Reran both isolated PostgreSQL journeys before application: **20 test results passed, none skipped**.
- Captured a fresh baseline immediately before migration. All **54 public table counts and ordered
  row hashes matched exactly afterwards**, including programme and completed training history.
- Verified the position helper against independent `row_number()` ordering for **124 live workouts**:
  **zero mismatches**. A nonexistent workout returns null.
- Confirmed all four replaced functions use the position helper, remain security invokers with an
  empty search path, and retain their previous grants.
- The new helper allows authenticated execution and denies anonymous execution. Both public RPCs
  continue to deny anonymous execution.
- Security advisor results were identical before and after migration.

No disposable training records were created for this follow-up. Publication was reported by Noam;
this migration task does not independently verify the frontend build or the signed-in repaired flow.
