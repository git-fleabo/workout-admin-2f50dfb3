# Focused training release — 14 October 2026

## Delivered behaviour

- Today prioritises Resume, next programme work, then saved work or an explainable suggestion.
- Scheduled alternatives stay closed alongside a programme. Supporting work and other workout
  choices remain available through disclosures. Later saved sessions retain their actual dates and
  Start early labels. Empty accounts can start a workout directly or open Plan.
- Focused view shows one movement, saved targets and recorded history. Previous values preserve
  missed-set flags and recorded effort; older aggregate records are labelled as summaries.
- Moving between movements does not confirm work. Changing an actual result retains its saved
  target. Reordering retains the selected movement, and removing it selects an available entry.
- Invalid finish attempts reveal the full composer. Confirmed actual values survive movement
  changes and draft reload and reach the existing save payload as individual rows.
- Session setup and method configuration collapse while focused; both remain editable.
- The optional manual timer accepts 1–7,200 seconds, supports cancellation, and catches up from an
  absolute deadline after a delayed callback. It does not change prescriptions or completion state.
  It is temporary UI state and resets on reload. Finishing or cancelling the workout clears it.

## Validation

Eight focused component suites passed 75 tests: Today, workout form, rest timer, logger accessibility,
save recovery, correction persistence, offline queue and sync tabs. New cases exercise priority,
disclosures, saved-session ordering, movement switching/reordering/removal, confirmation, actual-value
changes, restored drafts, recorded history and legacy summaries, timer deadlines and interval cleanup.
The restored save-payload check also verifies completed parent and entry states.

Sixteen focused unit/source checks also passed, covering compact strength/holds, kettlebell
prescription boundaries and workout completion. TypeScript and targeted ESLint passed. Repository ESLint passed with eight existing Fast Refresh
warnings in unchanged UI and weekly-plan modules. The production client/server build passed, with
the existing module-import/chunk warnings.

Local Chromium checks used the actual Today, full logger and navigation components with synthetic
query-cache fixtures at 390, 768 and 1,440 pixels. Checks covered keyboard disclosures, focused
controls, manual timer completion, original target versus actual load, movement changes, refresh,
finish review and the return to Today with Resume first. All widths had no horizontal overflow and
no page errors. No external data requests were made. Screenshots and the browser script are in the
ignored `next-session.local` folder.

An older source-inspection completion test still began at the summary wrapper introduced earlier
in the kettlebell work. It now inspects the existing detailed-payload builder. The actual completed
save payload is also asserted in the focused logger component test.

## Release state

This release changes repository UI and tests. It requires no database migration and used no live
training-data writes. GitHub push, Lovable synchronization/publication and a signed-in published
release check remain separate user-managed steps. Local verification does not establish live state.
