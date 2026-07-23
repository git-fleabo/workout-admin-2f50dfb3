# Data Quality Phase 1: Architecture and Dry-Run Report

- Audit captured: `2026-07-23T18:03:36Z`
- Supabase project: `Training Admin` (`dvcdghmcqqfvlbzufpyy`)
- Database: PostgreSQL `17.6.1.127`, `eu-west-1`, `ACTIVE_HEALTHY`
- Repository base commit: `fc9fbab`
- Audit branch: `codex/data-quality-dry-run-audit`

## Decision

No live data or schema was changed.

The proposed cleanup is feasible, but historical mutation should wait. The first
approved implementation should be additive: introduce explicit aliases,
aggregate/load semantics, audit logging, calculation guards, and a read-only
Data Quality workspace. Only after that code is deployed and verified should a
separate, explicitly approved cleanup batch update historical rows.

The companion [read-only SQL audit](./data-quality-dry-run-2026-07-23.sql)
reproduces the counts below and returns every affected row ID. It begins a
read-only, repeatable-read transaction and rolls it back.

## 1. Current architecture and data paths

### Runtime architecture

- The application is a TanStack Start/React app, but its operational data layer
  is browser-side Supabase REST and Auth in `src/lib/supabase-public.ts`.
- The browser uses the publishable key plus the signed-in user's access token.
  There is no service-role key in active browser code.
- All active workout routes read and write Supabase directly. No active route,
  server handler, package, or import communicates with Google Sheets or needs
  Google credentials.
- `src/server.ts` starts the app server; it is not a database or spreadsheet
  adapter.
- The active logger is `FullWorkoutForm`, with the dedicated `ClimbForm`. The
  older exported `WorkoutForm` remains in the same file but is not mounted by
  any route.
- There is no automated-test script or test directory in the current package.

### Active product flow to data-layer map

| Product flow              | Active data layer                                                    | Main tables                                                                               |
| ------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Workout and Climb logging | `supabase-log.browser.ts`                                            | `sessions`, `session_entries`, `entry_sets`, `entry_metrics`, method block/segment tables |
| Dashboard                 | `supabase-dashboard.browser.ts`                                      | sessions and nested entries/sets/metrics, `one_rm_tests`, `bodyweight_logs`, `goals`      |
| Timeline / History        | `supabase-timeline.browser.ts`, `supabase-session-detail.browser.ts` | sessions, entries, sets, metrics, method blocks, 1RM, bodyweight                          |
| Progress                  | `supabase-history.browser.ts`                                        | completed entries, sets, segments, metrics, planned/actual method links                   |
| Goals                     | `supabase-goals.browser.ts`, `supabase-history.browser.ts`           | `goals`, `goal_checkins`, sessions/history                                                |
| Library                   | `supabase-library.browser.ts`                                        | `exercises`, `person_exercises`, `activity_types`, equipment/location tables              |
| Weekly Review             | `supabase-weekly-review.browser.ts`                                  | sessions, nested entries/sets/metrics, plans/programmes                                   |
| Plans / Programmes        | `supabase-plans.browser.ts`, `supabase-programmes.browser.ts`        | suggested workouts and programme tables                                                   |

### Spreadsheet assumptions still active

Google Sheets is not contacted, but spreadsheet-shaped fields still affect
application behaviour:

- `supabase-log.browser.ts` writes `source_sheet = 'Workout Log'` or
  `'Climbing Log'`, filters recent/history/duplicate queries by it, and returns
  `source_row` as a save result.
- `supabase-history.browser.ts` filters both entries and sessions to
  `source_sheet = 'Workout Log'`. This can hide valid native records after
  spreadsheet labels are removed.
- `supabase-library.browser.ts` allocates a new `source_row` by reading the
  maximum row for `Exercise Library`, writes both spreadsheet fields, and sorts
  the catalogue by `source_row`.
- `supabase-goals.browser.ts` does the same for `Goals`.
- Dashboard, Timeline, and Weekly Load include `source_sheet` in fallback
  classification/labels.
- Live uniqueness/indexing still treats `(source_sheet, source_row)` as an
  identity on exercises, sessions, entries, 1RM tests, goals, and bodyweight
  provenance.

Historical provenance should remain. Native identity, ordering, route
eligibility, activity detection, and duplicate detection must stop depending on
it.

### Legacy code and documentation

- `WorkoutForm` plus `addWorkoutClient` and `addClimbClient` form one unused
  legacy logging path. The active forms use `addWorkoutSessionClient`.
- `getRecentClimbsClient` is also unreferenced.
- `.env.example` still lists `GOOGLE_SHEETS_API_KEY` and `GOOGLE_SHEET_ID`.
- `docs/supabase-import-status.md` still says Dashboard, Log, PRs, and History
  are Sheets-backed and references removed files/routes. It is historical, not
  current operational documentation.
- No spreadsheet import script remains in this checkout.
- `src/components/ui/sheet.tsx` is a Radix UI drawer and must remain.

## 2. Live schema, constraints, indexes, and RLS

### Core shape

- `sessions` owns person/date/session-level metadata. Parent
  `activity_type_id` is nullable.
- `session_entries` owns movement name, optional canonical `exercise_id`, and
  movement-level `activity_type_id`.
- `entry_sets` owns rep/load/time/distance/RPE values. It has no explicit data
  shape or load-semantics columns.
- `entry_metrics` owns typed non-set values such as climbing duration, grade,
  gradient, problems/routes, rounds, and other movement metrics.
- `entry_set_segments` represents advanced set methods.
- Foreign keys and cascade relationships exist between the hierarchy, and the
  main join columns are indexed.

### Current RLS posture

RLS is enabled on all audited core tables. Policies restrict session data
through `app_private.person_is_accessible(person_id)` and restrict catalogue
writes to admins. No RLS policy was weakened.

Important implementation detail: sessions have select/insert/delete policies,
while entries, sets, and metrics generally have select/insert policies only.
That is sufficient for the current append-oriented logger, but later in-app
repair actions cannot safely rely on arbitrary client updates. Repairs should
go through a deliberately scoped audited function or narrowly scoped policies.

The Data API currently has broad legacy table grants, including grants to
`anon`, but there are no permissive anon RLS policies on these tables, so anon
requests remain row-denied. New objects should explicitly revoke defaults and
grant only the required authenticated operations because Supabase's announced
Data API change will stop automatically exposing new public tables.

### Advisor and migration findings

- Security advisor: no core cleanup-table RLS warning. Existing unrelated
  notices are `person_app_profiles` having RLS but no policy (informational) and
  leaked-password protection being disabled (warning).
- Performance advisor: `sessions_source_idx` is unused, consistent with the
  planned retirement of sheet-based identity/order. Do not remove it until
  application filters and the historical cleanup are complete.
- Local migration filenames/history do not exactly match the live migration
  ledger. Several live objects were introduced outside matching local history,
  and some local timestamps/names differ from the applied versions. Do not run
  an unreviewed full `supabase db push`; use one new targeted migration and
  reconcile history deliberately.

## 3. Exact dry-run data-quality results

### Baseline

| Measure                                    |    Current |
| ------------------------------------------ | ---------: |
| Completed sessions                         |        106 |
| Movement entries                           |        129 |
| Set rows                                   |        137 |
| Metric rows                                |         78 |
| Entries without `exercise_id`              |         19 |
| Entries with neither sets nor metrics      |          3 |
| Rows with no performance dose              |         16 |
| Strictly empty rows (also no RPE)          |          8 |
| RPE-only rows                              |          8 |
| Rows above 12 reps                         |         27 |
| Rows above 20 reps                         |         11 |
| Rows with RPE                              |         45 |
| Active exercises                           | 234 of 238 |
| Enabled person exercises                   |        217 |
| Linked exercises used in completed history |         24 |
| Single-entry sessions                      |         96 |
| Multi-entry sessions                       |         10 |

All sessions, entries, sets, and metrics in the database currently belong to
completed sessions; there are no incomplete sessions in this audit snapshot.

Two supplied baseline numbers have drifted or used a broader definition:

- There are 16 rows with no rep/load/time/distance dose, but only 8 are
  strictly empty; the other 8 preserve RPE and must not be deleted as empty.
- Completed history now references 24 linked exercises, not 23.

### Canonical aliases and orphan repair

The 19 unlinked rows comprise nine distinct names.

| Historical name                | Rows | Proposed canonical target | Confidence      |
| ------------------------------ | ---: | ------------------------- | --------------- |
| Bouldering Session             |    4 | Bouldering Session        | High            |
| Ring Muscle-Up                 |    3 | Ring Muscle-Up            | High            |
| Ropes/Belay                    |    3 | Ropes/Belay               | High            |
| Pistol Squat                   |    2 | Pistol Squat              | High            |
| Seated Dumbbell Shoulder Press |    2 | Seated DB Shoulder Press  | High            |
| Weighted Pull Ups              |    2 | Weighted Pull-Up          | High            |
| Bouldering                     |    1 | Bouldering Session        | High            |
| Mix                            |    1 | Mix                       | High            |
| Yoga                           |    1 | Yoga Flow or Yoga Class   | Manual decision |

Result: 18 rows are high-confidence automatic link candidates. `Yoga`
(`entry_id e99508dd-dbe8-4376-9d04-8d93d2beae10`) remains ambiguous. Pull-Up
and Weighted Pull-Up remain separate canonical movements.

The read-only SQL report lists all 19 entry IDs, session IDs, original names,
source rows, set/metric counts, and canonical target UUIDs. No fuzzy match is
used.

Current active catalogue names have zero punctuation/case-normalized duplicate
collisions. `Pull-Up / Lat Pulldown` is already linked to Pull-Up, but its
combined historical label should be reviewed rather than added as a silent
general alias.

### Aggregate-set semantics

There are 64 single-row entries where `set_number > 1`; current code already
interprets this overloaded shape as a set count.

- 63 have a recorded performance dose and are high-confidence historical
  aggregate candidates.
- 1 row (`Box Jumps`, set
  `e4bd8dbc-e6fb-4c1b-97d5-5389c8da3245`) has only RPE and should remain
  ambiguous.
- 37 aggregate candidates contain both reps and weight.
- All 27 rows above 12 reps, including all 11 above 20, are in this aggregate
  candidate set.

The values include known totals such as 48 squat reps and 26 bench reps. The
proposal retains the original total reps, load, and known set count. It never
creates individual set rows.

### Empty rows and entries

Three entries have neither sets nor metrics:

- `2cd148ef-69a4-465b-9371-1e49396e94cd` — Stretch Session, 2026-05-31,
  imported Workout Log row 5.
- `8ea36ec2-9191-4112-afdc-0725696d82a3` — Stretch Session, 2026-06-09,
  imported Workout Log row 28.
- `eb157a58-3be2-4dd2-99c9-78c174574c04` — Bouldering, 2026-06-14, native.

These should be shown for review, not auto-deleted. The first two can still
represent completed stretching sessions with missing duration. The Bouldering
row has no duration, problems/routes, grade, or RPE and needs a user decision.

Of the 16 no-dose set rows:

- 8 are strictly empty.
- 8 preserve RPE only.
- 6 strictly empty rows also carry a stray `distance_unit = 'cm'`, showing that
  field defaults leaked into unrelated movement types.

The audit SQL returns all 16 exact set and entry IDs.

### Activity classification

- All 129 completed movement entries have a non-null activity type.
- 19 sessions have a null parent activity but contain 42 correctly classified
  entries.
- 9 of those sessions are genuinely mixed and should keep a null parent.
- 10 contain exactly one entry activity and are safe parent-activity derivation
  candidates.

The migration should enforce movement-level activity after validation while
leaving parent activity nullable.

### Duration and RPE

- 70 sessions lack duration.
- 93 sessions lack session-level RPE.
- 63 lack both.

These are prompting/backfill-review candidates only. Neither value should be
invented. Entry-set RPE and climbing duration metrics remain valid fallback
evidence for display, but should not be silently copied into session columns
without a reviewed rule.

### Weight semantics

The schema cannot distinguish total external load, per-implement load, combined
implement load, added bodyweight, assistance, or bodyweight contribution.

- 11 set rows across ATG Squats, Seated DB/Dumbbell Shoulder Press, and
  Bulgarian Split Squat have dumbbell-capable equipment and an ambiguous
  numeric load. They require review; no multiplier is proposed.
- 2 Weighted Pull Ups rows are high-confidence `added_bodyweight_load`
  semantics. The numeric values remain unchanged.
- Counterweight assistance is partly represented through free text, with some
  missing units/details. This should be normalized only when the text is
  explicit.
- One Stretch Session row incorrectly carries Front Lever counterweight data;
  it is an ambiguous copy/paste or historical-form error and must not be
  automatically reassigned.

### Native records carrying sheet labels

- 64 native/manual sessions still carry a non-null `source_sheet`.
- Their 87 movement entries also carry a sheet label.
- None of these native rows has `source_row`.
- All 238 catalogue exercises and all 5 current goals carry spreadsheet-shaped
  source identity, including native rows created after migration.

For sessions/entries, the cleanup can clear sheet fields from native rows only
after every filter and label fallback is removed. For catalogue/goals, stop
allocating new row numbers first; preserve existing values as historical
provenance until a separate retirement decision.

## 4. Session-grouping dry run

The proposed strict rule returns:

- 9 high-confidence groups containing 29 current sessions. Grouping them would
  produce 9 sessions, a net reduction of 20 parent rows.
- 9 ambiguous groups containing 21 sessions. No automatic action is proposed.

High-confidence dates and movements:

| Date       | Movements                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------ |
| 2026-06-01 | High Bar Squat, Kettlebell Swing, Bench Press, ATG Squats, Seated Dumbbell Shoulder Press, Weighted Pull Ups |
| 2026-06-03 | Bench Press, Ring Muscle-Up                                                                                  |
| 2026-06-04 | Seated Dumbbell Shoulder Press, Front Lever                                                                  |
| 2026-06-05 | Bench Press, High Bar Squat, Ring Muscle-Up                                                                  |
| 2026-06-08 | High Bar Squat, Bench Press, Weighted Pull Ups, Turkish Get-Up                                               |
| 2026-06-12 | Bench Press, High Bar Squat, Seated DB Shoulder Press                                                        |
| 2026-06-17 | Bench Press, Seated DB Shoulder Press, Ring Muscle-Up                                                        |
| 2026-06-19 | High Bar Squat, Pull-Up, Pull-Up                                                                             |
| 2026-07-10 | Bench Press, Ring Muscle-Up, High Bar Squat                                                                  |

The exact 29 session UUIDs and evidence fields are in query 12 of the audit
SQL. Imported groups require contiguous Workout Log rows. Native groups require
creation within 15 minutes. Both exclude climbing, yoga, stretching,
mobility/flexibility, and class entries; those sessions remain separate even
when they share the date.

The ambiguous groups are on 2026-06-03 (Skills Tracker), 2026-06-11 (Skills
Tracker), 2026-06-16, 2026-06-22, 2026-06-26, 2026-06-29, 2026-07-06,
2026-07-07, and 2026-07-09. Conflicting duration, widely separated creation
times, historical tracker semantics, or delayed entry prevents automatic
grouping.

Before execution, session-level notes and RPE need an explicit merge rule. A
safe default is to preserve distinct non-empty values in the audit log and
require manual review when more than one session-level value exists.

## 5. Calculation findings

### Estimated 1RM

`supabase-history.browser.ts` currently detects a one-row aggregate from
`set_number`, then calculates a synthetic per-set repetition count with
`ceil(total_reps / set_count)`. Dashboard skill PR logic uses the same
assumption. `progress-decision.ts` goes further and expands aggregate totals
into equal fractional sets.

Those transformations invent a breakdown not present in the source. They must
stop.

Proposed rule:

1. Include only `data_shape = 'individual'` working sets.
2. Exclude partial-ROM segments unless a specific metric calls for them.
3. Require positive load and reps.
4. Apply a configurable repetition ceiling, initially 12.
5. Allow reconstructed rows only when provenance explicitly proves the
   breakdown.
6. Never use historical aggregate rows for estimated 1RM or set/rep PRs.

### Volume

Current History and Weekly Review calculate `reps × weight`, which is correct
for aggregate rows only when reps are known totals and load semantics are
unambiguous. They currently do not check either condition.

Proposed rule:

- Individual row: `reps × normalized external load`.
- Aggregate row: `total_reps × normalized external load`, without multiplying
  again by aggregate set count.
- Ambiguous implement/bodyweight semantics: return `volume_status =
'ambiguous'` and omit from comparable kg-volume until reviewed.
- Duration, distance, holds, climbing, and mobility retain their type-aware
  metrics and are never forced into kg-volume.

## 6. Proposed additive schema and migration design

### Migration A: foundations

1. `exercise_aliases`
   - Reviewed `alias_name`, normalized exact key, canonical `exercise_id`,
     optional activity scope, status, reason, timestamps, and reviewer.
   - Unique exact normalized alias within its scope.
   - Authenticated select; admin insert/update; no fuzzy resolver.
2. `data_quality_batches` and `data_quality_audit_events`
   - Batch status/checksum, actor, timestamps, entity/table ID, before/after
     JSON, reason, and reversal metadata.
   - Managed-person/admin RLS. Append-only events.
3. Add to `entry_sets`
   - `data_shape`: `individual`, `aggregate`, or `unknown`.
   - `aggregate_set_count`.
   - `load_semantics`: total external, per implement, combined implements,
     added bodyweight, assistance, bodyweight contribution, none, or unknown.
   - `volume_status`: exact, ambiguous, not applicable, or unknown.
   - Checks tying aggregate count to aggregate shape.
4. Enforce movement-level activity
   - Add a not-valid non-null check, verify the live zero-null result, validate,
     then set `session_entries.activity_type_id` not null.
   - Keep `sessions.activity_type_id` nullable.
5. Quick logging
   - Add `is_quick_log` and `quick_log_order` to `person_exercises`; do not
     overload global catalogue activity/enabled state.
6. Movement and tissue metadata
   - Reuse the existing empty `exercise_tags` / `exercise_tag_links` tables.
   - Seed namespaced tags such as `pattern:squat`, `pattern:hinge`,
     `pattern:unilateral-legs`, `pattern:horizontal-push`,
     `pattern:horizontal-pull`, `pattern:vertical-push`,
     `pattern:vertical-pull`, `tissue:fingers-grip`,
     `tissue:elbows-biceps`, and `tissue:shoulders`.
   - Add admin write policies; current policies are select-only.
   - Keep `circuit_pattern` as circuit-generation metadata until consumers are
     migrated; do not silently reinterpret it as a complete movement taxonomy.

Every DDL statement should be idempotent or guarded. New public objects must
explicitly enable RLS, revoke default/anon access, and grant only required
authenticated access.

### Migration B: atomic workout saving

Add a typed `save_workout` Postgres function called through REST RPC:

- `SECURITY INVOKER`, not definer.
- Validates person access and all activity/exercise relationships.
- Inserts session, entries, sets, metrics, method blocks, and segments in one
  database transaction.
- Returns the created session ID and a stable native identifier.
- Any invalid child row aborts the entire transaction.
- Revoke execute from `PUBLIC`/`anon`; grant to `authenticated`.

The current multi-request save plus best-effort parent delete is not atomic and
should be retired after RPC parity tests pass.

### Migration C: approved cleanup batch

This must remain a separate file/command and must not run as part of ordinary
deployment.

- Insert the reviewed alias rows.
- Link the 18 high-confidence orphan entries.
- Mark 63 aggregate rows; leave the Box Jumps row unknown.
- Derive parent activity for the 10 single-activity null-parent sessions.
- Apply reviewed load semantics only.
- Group only the explicitly approved session UUID sets.
- Clear native sheet labels only after application code no longer uses them.
- Record every before/after row in the audit batch.

No deletion of historical performance values is proposed.

## 7. Backup and rollback plan

No backup was created in Phase 1 because no live mutation occurred.

Before any cleanup command:

1. Confirm the latest Supabase daily backup or PITR restore point in the
   Dashboard and record its UTC timestamp. If the project tier does not provide
   a suitable restore point, take a logical `supabase db dump`/`pg_dump`.
2. Export data-only copies of sessions, entries, sets, metrics, exercises,
   aliases, and audit tables.
3. Re-run this dry run in one repeatable-read transaction and store its counts
   and row-ID checksum in `data_quality_batches`.
4. Refuse execution if live counts/checksum differ from the approved report.
5. Execute one cleanup batch in a transaction.
6. Verify postconditions before commit.

Rollback has two levels:

- Preferred: a generated reverse transaction from
  `data_quality_audit_events`, restoring original scalar values and moving
  entries back to their original parent sessions.
- Disaster recovery: restore the confirmed backup/PITR point. This causes
  downtime and can roll back unrelated writes after the restore point, so it is
  not the routine undo path.

## 8. Read-only Data Quality workspace

Add `/data-quality` under Manage after the foundation migration. Its first
version is read-only and shows:

- unlinked entries and exact alias suggestions;
- aggregate and high-rep rows;
- strict-empty and RPE-only rows separately;
- missing duration and final RPE;
- ambiguous load semantics;
- native records carrying sheet labels;
- canonical/alias collisions;
- high-confidence versus ambiguous grouping candidates;
- valid mixed sessions versus derivable single-activity parents.

Every later repair action must show row IDs, current values, proposed values,
confidence/reason, and the affected calculation/UI behaviour before deliberate
confirmation.

## 9. Files to remove, retire, or change after approval

| Action   | Files                                                                                                                                                                                                                                                                                                      |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Add      | targeted migrations, alias/audit/calculation modules, Data Quality route/client, unit and integration tests                                                                                                                                                                                                |
| Change   | `supabase-log.browser.ts`, `supabase-history.browser.ts`, `supabase-dashboard.browser.ts`, `supabase-timeline.browser.ts`, `supabase-weekly-load.browser.ts`, `supabase-library.browser.ts`, `supabase-goals.browser.ts`, `movement-metrics.ts`, `progress-decision.ts`, Manage navigation, database types |
| Retire   | unused `WorkoutForm`, `addWorkoutClient`, `addClimbClient`, `getRecentClimbsClient` after parity verification                                                                                                                                                                                              |
| Clean    | remove Google variables from `.env.example`; rewrite `docs/supabase-import-status.md` as a historical archive                                                                                                                                                                                              |
| Preserve | `src/components/ui/sheet.tsx`; historical `source`, `source_sheet`, and `source_row` values for imported rows                                                                                                                                                                                              |

## 10. Test plan

### Pure unit tests

- exact alias normalization/resolution and no fuzzy fallback;
- Pull-Up remains distinct from Weighted Pull-Up;
- aggregate rows preserve totals and do not synthesize individual sets;
- 1RM excludes aggregates, unknown shapes, ambiguous loads, partials, and reps
  above the configurable ceiling;
- volume includes only exact semantics and does not multiply aggregate totals
  twice;
- grouping confidence rules, including standalone climbing/yoga/mobility
  exclusions;
- mixed parent activity remains null; single activity derives safely;
- climbing duration/problems/grade/gradient reconstruction;
- type-aware Progress reconstruction and decisions.

### Database integration tests

- migration applies twice without duplicate rows or errors;
- new tables/functions have RLS and explicit grants;
- aliases cannot target missing/inactive canonical rows without the intended
  reviewed status;
- atomic save creates the full graph;
- one invalid set/metric/method row rolls back the full save;
- unauthorized person IDs fail;
- cleanup dry run and approved apply return matching checksums;
- reverse batch restores the original rows.

### Application verification

Run:

1. `npx tsc --noEmit`
2. targeted ESLint for every changed module/route/test
3. all new unit and database integration tests
4. `npm run build`
5. `git diff --check`
6. authenticated browser smoke:
   - workout and climb save;
   - failed-save rollback;
   - Dashboard, Timeline, Goals, Library, Progress, Weekly Review;
   - mixed-session rendering;
   - aggregate labels and PR exclusions;
   - read-only Data Quality categories and before/after previews.

Remove all smoke data afterward and verify the cleanup.

## Approval boundary

Phase 1 stops here. No historical live-data cleanup, migration, repair RPC, or
session merge should be executed until this report and its explicit row sets are
approved.
