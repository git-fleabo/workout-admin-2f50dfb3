# Personal strength-week reviews — 10 October 2026

## Behaviour

Extends the existing reviewed strength-week flow to active personal copies of any supported source
model. It does not require a native assignment's exercise mappings or training maxes. Uses each
personal movement's stable programme key and exercise ID; a replacement exercise cannot inherit
another exercise's temporary reduction.

The exact upcoming source-programme week excludes started/completed/skipped sessions. Users can
preview, edit or decline a proposal. Approval supports saved loads, 2.5% lighter or 5% lighter,
and one fewer final working set where possible, with a minimum of one. Rep/hold targets, movement
order, names, dates, rest, location and progression rules stay as saved. Decimal load rounding
matches PostgreSQL, including half-cent boundaries. Weighted grip holds use the same load rule;
unloaded practice retains its dose except for an explicitly reviewed set reduction.

The preview shows both saved and reviewed prescriptions. Original `personal_programme_sessions`
remain untouched. Review snapshots live in the existing `programme_strength_week_reviews` JSON
history. Today and Plan expose the temporary prescription, while My Programme edits the original.
A warning explains that an explicit edit cancels the temporary review for unstarted sessions.
Started snapshots and completed history remain immutable through that edit. Restart copies the
original personal prescriptions, including later explicit custom edits, rather than temporary loads.

The logger starts only the current base revision and expected review ID. If a review was applied,
replaced or cancelled between loading Today and starting, it requires a refresh. A defaulted new
parameter preserves ordinary starts from older clients; an older client cannot unknowingly start
an active reviewed prescription. Frontend calls omit this parameter for ordinary, unreviewed starts,
so those starts continue to work before migration installation as well.

## Evidence and follow-up

The follow-up reads actual completed sessions linked to the approved review. It checks movement
identity/order, the exact number of completed straight sets, repetitions/holds, matching loads,
per-set effort, technique and pain. Missing sessions, unknown source-rule targets, missing effort,
changed loads, ambiguous entries and added set methods do not qualify as successful exposures.
Uncompleted parent sessions cannot provide positive evidence.

Restoration requires every reviewed exposure for that movement to qualify, plus stable current
recovery. Otherwise the proposal holds the reduction or conservatively extends it when pain/poor
technique warrants that. Every later change is relative to the following week's own baseline and
requires separate approval. Declining leaves the already-saved next week intact.

## Database implementation

Migration: `20261010115211_add_personal_strength_week_reviews.sql`.

- Pure prescription helper applies only supported load/set reductions.
- `apply_personal_strength_week_review` locks the assignment, checks account access, programme
  progress, the exact eligible week, base revisions, current review ID and all movement identities.
  It validates every derived plan and writes the approval atomically.
- A personal-session edit expires that run's active personal review without modifying started plans.
- The start RPC computes the approved prescription on the server and verifies its review token.
- New functions use invoker security and empty search paths. Public/anonymous execution is revoked.
  Existing person-scoped policies and the support-completion boundary remain in force.
- No new tables, template changes, original-target rewrites or training-history updates are required.

## Verification

The isolated PostgreSQL journey loads the real migrations and tests stale revisions, changed
programme progress, wrong week ranges, invalid load/set choices, foreign-person and anonymous
access, duplicate application, exact decimal rounding, protected starts, review cancellation on
explicit edits, a mid-week review excluding the started session, completion progress, follow-up
against the next week's own loads, rollback after a forced final insert failure, restart preservation
and exact test cleanup. A start without the added parameter remains usable when there is no review.

Pure tests check week selection, minimum set count, unchanged custom prescriptions, complete
exposure coverage, restoration to the following week's different load, incomplete/ambiguous evidence,
source-rule placeholders, swaps and stale previews. Browser-transport tests cover reloading original
and reviewed plans, consistent Today/Plan/logger targets, the review token, actual linked outcomes
and the bounded approval payload. Component tests cover editing a proposal, applying only after
approval, closing without writes, and editing original targets with the cancellation warning.

These tests use synthetic fixtures and a temporary database, not live training data. No new disposable
live programme or completion records are created for this feature. A signed-in check after Noam
publishes the frontend remains a separate release verification step.

Final repository checks:

- `npm test`: **204 passed, zero skipped**, including **28 database test results** across the three isolated journeys.
- `npm run test:components`: **59 passed**.
- `npx tsc --noEmit`: passed.
- `npm run lint`: zero errors; the same eight existing Fast Refresh warnings.
- `npm run build`: passed with the existing non-blocking build warnings.
- `git diff --check`: passed.

## Live database installation

Applied migration `20261010115211_add_personal_strength_week_reviews.sql` to the linked project on
10 October 2026. Its remote version matches the repository. All 78 earlier migration entries remain
intact. The temporary CLI runner isolated this single file because older remote migrations are not
all present in the checkout; its dry run listed only this migration, and the runner was removed.

Before replacement, the existing start function matched the reviewed source implementation. After
installation, verified all four new/replaced functions use invoker security, empty search paths,
authenticated access and no anonymous execution. Verified the edit-expiration trigger and start-time
review-token check, and exercised the pure live rounding helper (`20.6` at −2.5% → `20.09`).

All **54 public table counts and ordered row hashes matched exactly before and after installation**.
No original prescriptions, preferences, programme progress, sessions or completed history changed.
Security advisor results were identical before and after the migration.

The frontend changes are committed locally for Noam's GitHub/Lovable synchronization and publishing.
This task does not claim those frontend changes are published or verify their signed-in browser flow.
