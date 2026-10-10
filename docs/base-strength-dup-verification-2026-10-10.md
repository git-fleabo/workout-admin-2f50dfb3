# DUP programme — source and verification

DUP is selectable under Explore Base Strength alongside Volume/Intensity and Bullmastiff. Its personal setup uses the existing programme workflow: save a paused version, review future sessions in My Programme, then explicitly choose when to start. Installing the catalogue does not create or start a personal programme.

## Verified source

Alex Bromley, _Base Strength: Program Design Blueprint_, the user's signed-in Kindle edition, ASIN B08R5J58F8, pp. 104–106. The DUP introduction, base table, peak table and accompanying guidance were reviewed directly in the reader on 10 October 2026. [Open the source](https://read.amazon.com/?asin=B08R5J58F8).

The source uses three full-body sessions with squat, bench press and deadlift in each. The base schedule staggers high-, medium- and low-rep exposures between lifts. Each exposure follows a three-week percentage wave, increasing sets while reducing reps. The printed table permits a repeat with a 2–4% increase. The peak has separate top sets at RPE 7, 8 and 9 over three weeks, followed by back-off sets at 10% less load. Back-off set counts fall by one each week. No plus-set rule is specified for DUP.

There is a source discrepancy: the base table gives the high-rep exposure as 12/10/8, whereas the following prose calls it 10/8/6. The implementation uses the printed table, without combining the two alternatives. The source does not give another complete DUP variant, a fixed overall duration, a mandatory deload schedule, or accessory set/rep prescriptions. It suggests keeping any accessory work small, mentioning pulldowns and curls.

## Source rules and personal choices

- The app initially builds one three-week base wave followed by the three-week peak, for six weeks and 18 sessions. One to four base waves are selectable, giving 6, 9, 12 or 15 weeks. The default and supported repeat-count range are app choices, not a duration mandated by the source.
- Base repeats use the existing Base Strength convention: add the chosen 2–4 percentage points of the lift's estimated 1RM to the percentage prescriptions; round the resulting load once to the chosen increment. The 3% default and this explicit max-based interpretation are app choices. The peak does not inherit the base percentage offset.
- The base lift/exposure arrangement follows the printed schedule. For the peak, the source's day order (triples, sixes, singles) is applied to squat, with bench and deadlift offset by one and two sessions. Staggering is source-supported; this particular peak lift arrangement is an app choice because the peak table does not print a separate full lift schedule.
- Peak top-set loads stay blank until selected by the user for the target RPE. They are not converted to estimated percentages. The editor calculates back-offs at 90% of the selected top load and rounds once. Only the top row carries the RPE target; back-offs do not inherit an invented effort target.
- Pulldown and curl slots default to None. Selecting either adds that personal accessory to each session, with user-entered sets, reps and load. That frequency is an app choice. Compatible enabled exercises across Library categories remain available, including a Conditioning-category Kettlebell Swing. Programme rows retain Strength context; the Library category is unchanged.
- No automatic deload or max test is inserted. Dates remain editable in the existing personal schedule so recovery breaks can be arranged without inventing source prescriptions. Personal sessions use relative Day 1/3/5 labels rather than assuming a Monday start.
- Future exercises, dates, rest and personal targets remain editable. To change a source peak set/rep structure, explicitly select personal progression. Generic copy-to-later-session and strength-week coaching do not flatten DUP's source waves.

## Concrete preview

Opening Day 1, with example estimated maxes of squat 100 kg, bench 80 kg and deadlift 120 kg, rounded to 2.5 kg:

| Lift        | Opening prescription | Example load |
| ----------- | -------------------- | ------------ |
| Squat       | 2 sets of 12         | 60 kg        |
| Bench press | 3 sets of 8          | 55 kg        |
| Deadlift    | 4 sets of 5          | 90 kg        |

In the first peak week, the example squat exposure has a top triple at RPE 7 and five back-off triples. A personally selected 103 kg top set produces 92.5 kg back-offs at a 2.5 kg increment. This is an example, not the user's training prescription.

The local `dup-review.local/` page uses the real preview, setup and session-editor components with sample exercises. Browser review demonstrated optional Kettlebell Swing selection, preparing all 18 sessions, automatic peak back-off calculations and saving the demo edit. Demo saves stay on the page. This verifies presentation and interaction, not signed-in saving in the published frontend.

## Saving, logging and progression

Saving uses `create_personal_programme` with the existing person-scoped validation and RLS. Missing peak loads can be saved for review but prevent a source session from starting. The server rejects inconsistent dependent loads, altered source peak set/rep/RPE targets and stale session revisions. Explicit personal progression permits custom targets for that movement.

Started prescriptions retain source metadata and mixed top/back-off set loads after reload. The logger offers a separate Calculate back-off loads action after selecting the actual top-set load. It updates the remaining load fields while allowing the user to record what they actually performed. Logging completion advances only the linked run. DUP does not invoke Bullmastiff's completed-plus-set review.

Restarting DUP creates a paused run and clears all source peak top/back-off loads for a fresh effort-based choice. Base prescriptions remain; explicit personal progression choices keep their personal targets. Existing completed logs remain untouched.

## Database rollout

`supabase/migrations/20261010224715_add_base_strength_dup.sql` adds four shared DUP sequence scaffolds (126 workouts total), extends paused creation/restart handling and source validation, and retains security-invoker functions with an empty search path. Authenticated execution is permitted; anonymous execution is denied. It contains no updates to existing personal programmes, assignments or logs.

The migration was applied to Supabase project `dvcdghmcqqfvlbzufpyy` on 10 October 2026. Remote migration history records `20261010224715`; the local filename and database tests match it. Before applying, the three replaced live function bodies were confirmed to match the existing repository migration, avoiding overwriting unrelated live changes.

`supabase/migrations/20261010225150_protect_dup_personal_setup.sql` was also applied. It blocks generic active assignment inserts and activation without a personal plan, including requests from an older frontend that exposes the new scaffold in its generic picker. Personal setup still inserts a paused assignment, and its complete plan can be activated through the existing workflow. The guard uses invoker permissions, an empty search path and authenticated-only execution.

Live read-only checks verified all four durations, 18/27/36/45 sessions, contiguous sequence indices, correct week/day/session positions, invoker function settings and execution grants. Counts and full-row fingerprints across 16 existing tables matched their pre-migration baseline exactly when the new shared scaffolds were excluded. This includes existing programme definitions, workout sequences, exercise prescriptions, assignments, personal plans, planned workouts and training history. No personal DUP programme was created and no training records were changed by the rollout.

The security advisor result was unchanged before and after rollout. Its existing leaked-password-protection warning remains outside this feature; see [Supabase's remediation guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Repository verification and release boundaries

- Model/database tests: 262 passed, none failed or skipped. Includes all printed base exposures, staggered order, repeat offsets, all peak weeks, optional accessories, rounding, missing inputs, paused saving, stale revisions, protected starts, mixed-load snapshots, linked completion, profile/anonymous isolation, explicit personal edits and paused restarts. Includes a compatibility guard against assigning empty DUP scaffolds through older generic pickers. The existing Bullmastiff database regression also runs after both DUP migrations.
- Component checks: 87 passed. Includes selectable preview, changing repeats/phases, optional compatible-category selection, setup saving/error states, editor dependency calculations, reload restoration and actual-load logging.
- Type checking, scoped lint and production build passed. The browser review used the real components at the default narrow in-app viewport.

Repository checks and the live database rollout are complete. GitHub delivery is recorded in the task's final report. Lovable synchronization/publishing remains user-managed; the released frontend and a signed-in DUP save there have not been verified.
