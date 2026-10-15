# Goals in Weekly Review

Implemented and verified locally, 15 October 2026. Publication is a separate user-managed step.

## Behaviour

Weekly Review shows up to three current active goals, with further goals behind a disclosure.
It reuses the Goals queries and calculation rules; exercise reads are deduplicated by exercise ID.
The section remains visible when the detailed weekly review is collapsed for an empty week.

- Performance/duration goals show the saved starting point, best recorded result in the goal period,
  latest measured result and target. The best and latest results are deliberately distinct.
- Changes compare the best result at review end with the best result before the selected week,
  within the same goal period. A first measured result is compared with the saved starting point
  only when one exists. Missing baselines and missing measurements are not invented as zero.
- Consistency goals count completed sessions, distinct dates, recorded minutes or manual check-ins
  using their existing rules. Missing session duration is labelled as incomplete; the progress bar
  is omitted for a partial time total.
- Milestones require manual confirmation in Goals. Unstructured legacy targets remain text;
  digits in a grade such as V5 are not interpreted as a numerical performance target.
- Evidence disclosures show the latest eight sources, with all-time exercise progress/History
  available for the full record. The best source remains directly accessible even when older.
- Session links open the exact source in History, including all movements in a multi-exercise
  workout, and switch the displayed month to that session. Closing the dialog does not reopen it
  on a query refresh. A removed source produces an explicit message.
- Loading, query failure with retry, no active goals, unclaimed profiles and missing metrics have
  separate states. Refreshing Review refreshes its goal sources too. Successful workout/climbing
  saves and History deletion invalidate cached goal evidence and the weekly review.

## Date and evidence boundaries

Period calculations accept an explicit review-end date. Weekly/monthly/quarterly/yearly goals are
anchored to that date, and later records are excluded from values, changes and evidence. The shared
Goals calculation also excludes future-dated records when using its default date of today.

The section uses **current active goals and current saved goal settings**. Goal settings/status are
not versioned in the existing model; the section explicitly labels this limitation rather than
presenting past goal settings as known. Correcting an old log can change a recomputed past review.
Comparability follows the existing metric rules; the section does not infer readiness, climbing
grade competence, programme changes or forecasts from session counts.

## Verification

- 12 unit checks cover historical cutoffs, best versus latest, explicit/missing baselines, missing
  metrics, weekly/monthly resets, active-day deduplication, missing duration, manual/legacy goals
  and month/quarter/year boundaries.
- 65 component/integration checks across eight suites passed, including new goal cards, refresh,
  shared exercise reads, retry states, source-session navigation, History paging/notes and existing
  workout logging/save recovery. No skipped tests in this selection.
- TypeScript and production client/server build passed. ESLint passed with zero errors and the
  eight existing Fast Refresh warnings in unchanged UI/weekly-plan modules.
- Playwright exercised real Weekly Review, History and Goals components with fixture-backed reads
  at 390, 768 and 1440 pixels. Goal evidence disclosures, exact source links, dialog dismissal,
  previous/next review week, extra-goal disclosure, refresh and Manage goals navigation passed.
  No horizontal overflow, browser runtime errors or external data requests were observed.
- Phone and desktop screenshots were visually inspected. Local screenshots and the browser fixture
  are under ignored `goal-review.local/`; they are test artifacts rather than production data.

No database/schema changes were made. No live user-data tests or production writes were performed.
The frontend still requires the user's GitHub push/Lovable sync and publication, followed by a
signed-in check of the published build.
