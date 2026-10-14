# Published logging verification — 14 October 2026

The signed-in published application at https://workout-admin.lovable.app/ showed build `f482ba4`. This verifies publication of the kettlebell prescription, summary logging, compact strength and compact hold changes through that commit. The corrective change documented below was subsequently made in the repository and still needs user-managed push, sync and publication.

## Live checks

- The logger initially had no unfinished draft. One temporary, unsaved session was created at The Font with Bench Press, Ring L-Sit Hold and 1-Arm Hang. No saved prescription was loaded or started.
- Entering three sets, five reps and 60 kg once produced three individual strength rows. Marking the third missed changed the movement card to two completed sets.
- Entering three 20-second holds once produced three attempts. Changing the second to 18 seconds and marking the third missed showed 38 seconds total and two completed attempts. Mixed times stayed separate.
- Three 10-second grip attempts with 5 kg required a load type before confirmation. Added weight allowed confirmation. Reload preserved all three movements, their values, completion flags, load type and recorded status.
- The finish review opened at 390 pixels with no horizontal overflow. Its overall count correctly showed seven completed efforts.
- The finish review's movement summaries incorrectly included missed rows: Bench Press showed 15 reps and 900 kg volume instead of 10 reps and 600 kg; the hold showed 58 seconds instead of 38 seconds. This discrepancy was captured in an ignored local screenshot and fixed in the repository.
- Cancelling the temporary draft returned the logger to an empty movement. No Finish workout, Start early, Load workout, Skip, programme-change or daily-completion action was submitted.
- The kettlebell picker loaded successfully. Kickin’ It Old School's full prescription showed one ordered four-step round, the AMRAP instructions once and optional step notes. The workout was not started.

## Repository correction and validation

The finish-review summary now calculates set counts, reps, volume, method segments and hold/time totals from completed rows only. Stored rows and their completion flags remain unchanged. An entry whose recorded rows are all missed reports no completed sets or attempts instead of falling back to an aggregate target.

Regression assertions cover the exact 600 kg strength total and 38-second hold total in the finish dialog, both hold and grip-hold tracking, and preservation of the missed rows in the save payload. The four focused component suites passed 41 tests; TypeScript, targeted lint and production build passed.

The initial pass did not exercise live database saves or the kettlebell start-to-summary handoff. The separately authorized follow-up below covers those paths. Offline submission and correction persistence retain mock-backed verification; they were not exercised against live user data.

## Authorized production save-and-cleanup follow-up

The user explicitly authorized temporary save-and-cleanup tests for a KB summary and a strength/hold/grip session. The published build was verified as `4ff137d` before creating either record. Baseline counts and whole-row fingerprints were captured for all 56 public tables and both private data tables, with existing session, suggestion and receipt identities recorded for cleanup protection.

The kettlebell picker started a new standalone prescription for Conditioning workout 8. Its 40 target steps opened directly in simple summary mode. A simulated eight-minute result, 16 kg, ladder progress from 10 down to 6, and a unique disposable note were saved through the published UI. Database verification found one summary entry, zero set rows, the actual summary metrics and a completed link to the new standalone plan with no programme assignment or programme-workout link. History displayed Summary log, the weight, progress and eight-minute duration.

A separate explicitly titled disposable session saved Bench Press, Ring L-Sit Hold and 1-Arm Hang. The strength work had three rows of five reps at 60 kg, with the third missed. Holds were 20, 18 and 20 seconds with the third missed. Grip work had three 10-second attempts at 5 kg of added weight. The published finish review correctly showed seven completed efforts, 10 strength reps and 600 kg volume, 38 seconds of holds, and 30 seconds of grip work. Database verification preserved all nine individual rows and completion flags, blank bodyweight loads, explicit added-weight semantics and null per-attempt RPE despite overall session RPE 7. History showed two completed strength sets, two hold attempts totalling 38 seconds and three grip attempts totalling 30 seconds.

Cleanup ran in one transaction, guarded by the exact new record IDs, test markers, person identity, standalone links and expected deletion counts. It removed the two test sessions, their dependent rows, the new KB suggestion and its prescription rows, and the two associated save receipts. All 58 table counts and fingerprints then exactly matched the captured baseline, including programmes, assignments, original history and the kettlebell catalogue. Refreshing Today cleared the deleted session's local completion reminder and restored the original next programme session and recent-workout cards. No temporary training records remain. Detailed evidence and test identities are kept in the ignored local verification folder.

The live test exposed two additional presentation issues: KB completion counted the 40 source steps as movements, and History expanded the entire source reference with repeated shared notes. Repository follow-up labels KB summary drafts and completions explicitly, shows identical note blocks once, collapses the source reference behind a disclosure and constrains the History dialog to a scrollable viewport. Saved records and original source text remain unchanged. Tests cover source disclosure, shared and distinct notes, logger completion and Today draft labels; focused History, logger, Today and correction suites passed, along with TypeScript, targeted lint and production build. A local 390-pixel preview showed no horizontal overflow, readable collapsed notes and a bounded, scrollable expanded reference that closed normally. Publication was checked separately below.

## Final published History check and card-width correction

The subsequent signed-in release displayed timestamp build `20261014T1126`. Its published app files include the new History reference disclosure, summary-draft labels and summary-save labels. An existing Just Swings and Squats session opened in the bounded, scrollable History dialog, preserved its actual notes and details, and closed normally. This was a read-only check: no training record was created, edited or deleted. No summary test record remained in the account after the prior cleanup, so the reference-disclosure interaction retained its earlier component and local-browser verification rather than being retested against a new live record.

The real History list exposed a separate phone layout issue: long session titles gave its implicit grid column a minimum width wider than the viewport. At 390 pixels, document width reached 487 pixels even though the dialog itself fit. The card grid now uses an explicit single column that can shrink; the page and cards permit shrinking, and truncated titles stay within the available card width.

A local browser check used the actual History page with cached, synthetic entries and the same long kettlebell, mobility and programme titles. Document width matched the viewport at both 390 and 1280 pixels. Expanded filters also stayed within 390 pixels, and card details opened and closed normally. The focused History suites passed three tests; targeted lint, TypeScript and production build passed. This final card-width correction is committed in the repository and still needs user-managed push and publication.
