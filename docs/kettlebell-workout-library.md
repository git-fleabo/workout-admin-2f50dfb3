# Kettlebell workout library

The Today picker offers Strength, Muscle, Conditioning and Random. The first three select within that category; Random draws from the combined eligible pool. Swap stays in the chosen category. Mobility workouts are excluded from both storage and selection.

## Content status

No book workouts have been imported or seeded. Original test fixtures live only under `tests/` and are never offered in the application.

The intended first batch is source workouts 1–5 from each of Strength, Muscle and Conditioning, for 15 full workouts. The backlog begins at workout 6 in each category. Exact remaining totals have not been audited.

Full workout text must be supplied directly before those records can be prepared. Preserve source numbering, instructions, side changes, rest, timings, ladders and stop conditions; do not replace uncertain instructions with invented targets.

## Storage and preparation

Migration: `20261010142048_add_kettlebell_workout_catalogue.sql`. It adds a person-owned `kettlebell_workouts` catalogue, snapshot fields on accepted plans and an atomic `start_kettlebell_workout` RPC. It seeds no content. A new table's Data API grants and RLS are explicit.

The JSON input for the initial import is `{ "personId": "<existing person UUID>", "workouts": [...] }`. Each of the 15 records must satisfy `kettlebellWorkoutSchema` in `src/lib/kettlebell-workouts.ts`, including a stable UUID, `collectionKey: "strong_on"`, category, original source number, title, summary, full instructions, source reference, bell count, extra equipment IDs, duration or null, version, verification/availability flags and the full prescription.

Every prescription movement maps to an existing exercise UUID and includes explicit set targets, tracking mode, notes and rest. A set needs reps or duration. Ordered method blocks reference accessible active training methods and movement indices. Repetition ladders use successive set rows; complex/chain timing and side-change rules must remain explicit in the instructions and notes. Unsupported formats must be resolved before enabling their records. Do not infer a workout's exact duration from the book's overall 20-minute cap.

Run `node --experimental-strip-types scripts/prepare-kettlebell-import.ts /path/to/pilot.json` to validate that there is exactly one record for each category/number pair 1–5 and create `kettlebell-import.local/pilot.sql`. This file is ignored by Git and contains private workout content. The script does not connect to Supabase, handle credentials or execute the import. Keep the input JSON out of the repository too.

Review the generated SQL before executing it in the authorised database. Its transaction and source-key upsert prevent duplicate imports. Re-import increments source versions while retaining accepted plan snapshots. Enable `verified` and `isAvailable` only after reviewing complete instructions and mappings. No production migration or import was performed as part of this repository implementation.

## Selection and programme independence

The picker checks active location equipment, the explicitly selected one/two-bell availability and enabled exercises usable at that location. The server rechecks workout version, ownership, active location, equipment, enabled movements and training methods at acceptance. Never silently switch category or bypass equipment restrictions to fill an empty pool.

Account-scoped local state preserves the category, offered IDs, selection version and request UUID. Swaps exclude previously offered IDs until the user explicitly restarts the shuffle. Recently completed workouts are deprioritised when alternatives exist. Preview, swap and cancel perform no database writes.

Acceptance creates one standalone plan and its entries, sets and ordered method blocks in one transaction. A person/request unique key plus transaction lock make retries idempotent. The database constraint requires null programme, goal and mobility links on kettlebell sessions. The RPC neither archives another pending workout nor writes to programmes. Existing unfinished logger drafts and pending handoffs are protected.

Source identity and the full prescription snapshot stay on the accepted plan; movement notes preserve instructions through the existing logger and completed session history. Strength and Muscle map to the app's strength plan kind; Conditioning is explicitly classified as conditioning. Actual work enters History and training-load reporting without automatically changing programme progress, dates, prescriptions or status.

## Verification

Unit tests cover category and equipment filtering, swaps, recent-workout fallback, source-independent drafts, malformed prescriptions and state recovery. Component tests cover the pending-content state, category choice, swapping/exhaustion, cancellation, restored previews, duplicate-start protection, retries and unfinished drafts. Isolated PostgreSQL tests execute the real migration and RPC to check RLS, anonymous access, invalid imports, stale versions, equipment/exercise checks, transactional rollback, snapshots, timed blocks, standalone constraints and unchanged active/paused programmes after completion.

Before publishing, apply the reviewed migration, import the verified personal batch and run the signed-in pick → swap → start → log → complete lifecycle with disposable test data. Repository verification is separate from live database verification and Lovable publishing.

Repository checks on 10 October 2026: the full repository test run passed 248 tests; the full component run passed 74, followed by two additional passing saved-plan visibility tests. The final focused component run passed 22. Type checking, lint and production build passed. The picker was visually reviewed at 390 × 844 and the default desktop viewport, using original test data. The mobile screenshot is `kettlebell-picker-mobile-2026-10-10.jpg`. No production schema or training data was changed.
