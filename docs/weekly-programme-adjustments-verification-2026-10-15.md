# Programme approvals in Weekly Review

Implemented and verified locally, 15 October 2026. GitHub push and Lovable publication remain
separate user-managed steps.

## Behaviour

Weekly Review now shows **Programme adjustments** for the current week, alongside goal progress.
Historical weeks are read-only and provide a button to return to the current programme review.
An empty training week can still inspect the current unfinished programme. No active programme,
loading and read failures have explicit states and appropriate actions/retry controls.

Supported personal/adaptive programmes reuse `ProgrammeRefreshCard` and its exact upcoming-week
preview. Opening, editing controls, cancelling or dismissing a preview does not save. The existing
**Apply reviewed week** action is the approval boundary. Persistent native training-max editing
remains available in Plan rather than being added to this review surface.

The current programme, latest reviewed week, recent training, load history, catalogue and saved
Plan choices must load successfully before a proposal appears. Review and Plan share the same
account-scoped storage key and rolling planning-window choices, and the same calculation engines.
Missing or failed evidence is not substituted for a known empty history at the approval boundary.

Base Strength follows its own source rules. Its existing base-level editor previews changes to
future unstarted sessions before applying them, preserving percentage prescriptions and progression
rules. Eligible Bullmastiff sessions expose the separate completed-plus-set evidence review and
its revision/fingerprint-based approval. DUP and Volume/Intensity do not acquire generic temporary
lighter-week reviews. Links still allow inspection of all saved targets in Plan.

## Approval and state boundaries

- Plan and Weekly Review now share the latest-review query, approval transport and cache refresh.
  Both continue to call the existing personal/native approval RPCs with their established payloads.
- A week preview stores its original programme, recovery and prior-review inputs. Its prescriptions
  stay fixed while open. Changes observed through those queries block Apply and request a new
  preview instead of silently replacing the displayed prescriptions.
- Before invoking an approval RPC, fresh reads compare the active programme and prior review with
  the approved inputs. An ended/advanced/edited programme or another approval is rejected. Read
  failure also prevents a write. This read check does not replace the RPC's authoritative locks,
  ownership, exact-week, revision and started-session checks.
- Successful saves refresh Today/offers, schedules, programme/editor data and Review. Logging and
  History deletion also invalidate programme-review evidence. Base-level and progression saves
  refresh the programme context used by the new surface.
- Controlled preview dialogs return focus to the initiating control after cancellation/dismissal.
  Error messages remain available in the preview. No source templates, training history or
  progression calculations were changed by adding this entry point.

## Verification

- 87 component/integration cases passed across nine selected suites. Coverage includes preview-only
  behaviour, cancellation/focus, personal and native transport, approval freshness checks,
  locked snapshots, saved Plan choices, source base levels, Bullmastiff fingerprints, failed
  evidence, historical read-only controls and existing logging/goal/context behaviour.
- 18 pure strength/personal review cases passed without changing calculation rules.
- 14 isolated PostgreSQL cases passed with zero skips, covering existing personal approval
  boundaries and strength-review ownership across accessible profiles. The tests used disposable
  local clusters; no production connection or user-data test was performed.
- TypeScript, production client/server build and ESLint passed. ESLint retained the same eight
  existing Fast Refresh warnings in unchanged UI/weekly-plan modules.
- Playwright exercised actual Weekly Review and Plan routes, plus the source-programme preview,
  at 390, 768 and 1440 pixels. All nine route/scenario combinations passed preview, cancellation,
  focus restoration and explicit Apply. Review also passed historical navigation/read-only
  behaviour. No horizontal overflow, browser runtime errors or external data requests were
  observed. Phone source and desktop strength-preview screenshots were visually inspected.

Browser reads and writes were backed by disposable in-browser fixtures. The ignored
`programme-review.local/` directory contains the fixture, screenshots and verification logs.
There were no schema changes, migration applications or live training-data writes. The published
build still requires independent signed-in verification after the user's sync/publication.
