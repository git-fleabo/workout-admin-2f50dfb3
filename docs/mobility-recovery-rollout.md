# Mobility & Recovery

Repository implementation, verified 29 October 2026. No production migrations, account records, Lovable changes or publication were performed.

## User flow

Main navigation → **Mobility & Recovery** (`/mobility`, retained for old links) → choose a routine and Start/Resume. The mobile label is Recovery with the full accessible name. Active routines, due work and unfinished sessions come first. Create routine supports multiple named templates, the ordinary exercise library or custom movements, manual/weekday schedules, optional purpose/body area, and active/maintenance/paused/archived states. Review and Apply saves target changes for future sessions only.

Quick practice records completion without sets. Measured sessions start with blank actual values, show previous recorded results, support separate left/right results and explicit weight meaning, and allow range/technique notes. Weight controls step by 1.25 kg and accept typed values. Save and close persists an unfinished session; browser-local inputs are also kept under a profile/session-specific key. Cancel asks before discarding. Recovery never reads or replaces the lifting draft.

Optional pain remains null if unanswered. Later responses can be added from history; enabled next-morning checks appear only in this area after the session's local calendar date. No notifications or medical/progression decisions are generated. Progress groups recorded results by exercise identity, side, load meaning, saved setup, recorded range and technique. Unknown range/technique remain labelled unknown. There are no automatic load increases or improvement claims.

Today has a small dismissible shortcut when recovery work is due or unfinished; it can be re-enabled in the recovery area. Recurrence is calculated for the current local date rather than generating overdue rows. Skipping affects that date only. Plan's toolkit catalogue and recovery support candidates have moved out; calisthenics support remains.

## Storage and ownership

Apply `supabase/migrations/20261028191229_mobility_recovery.sql` before publishing the frontend.

- `recovery_routines`: owner, lifecycle state and ordered JSON session templates. Updates use optimistic versions.
- `recovery_sessions`: explicit routine or legacy-run identity, immutable template snapshot, actuals, optional symptoms/response, lifecycle state and version. A partial unique index and source-row locking prevent duplicate unfinished sessions; closed results cannot be overwritten. A lost completion response can be retried against the same session ID.
- `start_recovery_session`: security-invoker function, authenticated grant, source/owner checks, same-profile composite foreign keys and existing `app_private.person_is_accessible` policies. Anonymous clients have no table/function grants.
- `sessions.recovery_only`: false by default. This flag is deliberately **not** backfilled from names, exercise membership or mobility linkage.

New recovery sessions never enter the ordinary `sessions` table and never call strength-programme completion or prescription functions. Existing regular training analytics/history queries exclude only `recovery_only=true`. Original session detail, export and explicit legacy-history viewing retain access to those records.

## Legacy preservation and classification

Existing toolkit runs, drills, notes, targets, source links and measurements remain in their original tables. Main-area cards adapt those records without copying or activating anything. **Exercises & source material** retains the original toolkit editor and assessments. New starts use the dedicated logger; previous links to `/mobility` remain valid.

Outstanding suggested workouts are treated as dedicated legacy recovery schedules only when all three explicit provenance conditions hold: a mobility run ID, `plan_kind='mobility'`, and no strength `program_workout_id`. They are removed from the normal loading/scheduling lists and offered from their original routine. The recovery session retains the original suggested-workout ID with a unique live/completed link. Completion updates that schedule's status; its old `completed_session_id` stays untouched. New completion linkage is in `recovery_sessions.suggested_workout_id`. No strength index is advanced. Dates in the past are retained in storage but do not become an overdue backlog.

Completed legacy sessions are **ambiguous by default**, including mobility-linked sessions that may contain lifting. They stay in regular history/totals until the user reviews the original workout and explicitly chooses **Mark recovery only** in the routine's history. The action is reversible. Mixed workouts should stay in regular training. No legacy session is rewritten or deleted by the migration. The regular History filter can explicitly include classified legacy recovery workouts; new recovery history stays in its own area.

Legacy practices retain their existing single-template editor and scheduled dates. For new multi-template weekday routines, use Create routine; there is no automatic conversion, copy or activation of the shoulder example. Toolkit estimated duration is a display estimate (15 minutes), not a recovered structured duration from legacy notes.

## Rollout

1. Export a current profile backup using the currently published app.
2. Review and apply the prepared migration through the normal Supabase release workflow. This requires separate authorization; it has only been applied to disposable local PostgreSQL test clusters here.
3. Push/sync the repository through the user's normal workflow, then publish with Lovable. The agent has not pushed or published it.
4. After publication, inspect navigation, existing routines/resources and mixed/legacy history read-only. Confirm the new table/function grants and RLS. Production write testing still requires explicit authorization, disposable records, a baseline and verified cleanup.

Keep the additive tables if rolling the frontend back; dropping them would lose new recovery records. The new frontend requires the migration. Error states retain access to toolkit resources but are not a substitute for applying it.

Profile JSON backups are now schema version 3 and include both recovery tables and their ownership/provenance relationships. Versions 1 and 2 remain readable. Database restoration of closed recovery sessions must follow the normal draft-to-closed transition (preserving snapshot, actual values, final version and response), rather than inserting closed rows directly. The reconstruction test demonstrates this in a transaction without disabling security guards. There is no new production import UI.

## Verification

Final results: 379 logic/database tests and 289 component tests passed; TypeScript and production build passed; lint passed with eight existing warnings. Browser interactions passed at all five sizes listed below.

- `npm test`: logic and isolated PostgreSQL tests, including RLS denial, owner/FK isolation, two templates, target/history preservation, idempotent start/finish, optimistic concurrency, null symptoms, lifecycle states, skip/complete schedule links, legacy preservation, explicit classification, unchanged strength position/prescription, local dates and progress grouping.
- `npm run test:components -- --maxWorkers=2`: full component suite, including quick/measured input, failed-save retention, resume/cancel, preview/apply, ordinary-plan compatibility and profile export/reconstruction against real local PostgreSQL.
- `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- `tests/browser/recovery.mjs`: actual local app navigation, two-template creation, quick and measured saves, next-morning response, page reload, Save and close/Resume, history, and Today/Plan/Log/Review/History at 320, 390, 430, 768 and 1440 px. All external requests are intercepted with in-memory fixtures; overflow assertions and screenshots verify the editor and logger. Run against local port 4386 with `PLAYWRIGHT_MODULE` pointing to an installed Playwright module when it is not resolvable normally.

Browser fixtures verify frontend integration, while separate PostgreSQL tests verify actual constraints/RLS/transactions. Neither establishes production write behaviour. Unsynced local edits remain device-local until Save and close or completion; recovery does not add a background offline-upload queue.
