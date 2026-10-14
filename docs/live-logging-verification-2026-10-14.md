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

Live database saves, kettlebell start-to-summary handoff, saved-prescription confirmation, history after saving, offline submission and correction persistence were not exercised against live user data. Their existing mock-backed checks are distinct from published end-to-end verification. A fresh, explicitly authorized disposable-record test with exact cleanup is needed for that remaining coverage.
