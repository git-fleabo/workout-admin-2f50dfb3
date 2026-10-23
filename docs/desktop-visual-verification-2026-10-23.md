# Desktop workspace visual verification — 23 October 2026

Status: the main layout and interaction checks are complete. Local Plan corrections and History duration formatting still require syncing and a final browser recheck.

## Environment and scope

Testing used the ChatGPT in-app browser against https://workout-admin.lovable.app/ with the existing signed-in account. The latest Progress and History desktop workspaces became available on the published app during the follow-up. No separate preview sign-in is needed now.

Local baseline: commit `63939a32578ca453d0910432fe35b2a2f3d54775`. Display corrections listed below are still uncommitted locally because this session cannot write the Git index.

All four pages were visually inspected at 1440×1000, 1024×900, 768×1024 and 390×844 across the two test passes. Screenshots were checked after resizing had settled. Browser viewport overrides were reset at the end.

## Results

| Area                          | Result                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Review                        | Desktop overview, goals and programme tabs render correctly. The selected tab survives changing weeks. Previous-week navigation and return to the current week work. Programme editing is restricted in past weeks. Selecting Yoga and opening its full log reaches the correct 20 October session. Tablet and mobile retain their existing layout.                                     |
| Programme dialog              | Base-level editor opens on desktop and mobile. Fields and notes remain readable, the content scrolls, footer actions remain accessible, and Cancel closes it. Values were not applied.                                                                                                                                                                                                  |
| Progress                      | Search selects Bench Press and handles a nonexistent exercise. Period and location filters update the headline. A method filter with no matching sessions shows the empty state. Trends, Session history, Methods & plan, Climbing overview and Personal bests all render. Switching from a method-based tab to Run falls back to Trends, rather than leaving an empty unavailable tab. |
| Progress session details      | Enter opens the exact selected session from its desktop history row. The full detail includes Low Bar Squat and all four Bench Press sets. Mobile details preserve the same information and scroll correctly.                                                                                                                                                                           |
| Progress responsive switching | Desktop sidebar and tabs appear at 1024 px and above. At 768 px and 390 px the exercise picker and mobile structure return. Selected exercise and period/location filters remain consistent.                                                                                                                                                                                            |
| History search and notes      | Searching Bench Press keeps the whole grouped workout, including Low Bar Squat and shared notes. Searching text from the notes finds six October records. Search does not change the period totals. No-result searches clear the inspector and hide deletion controls.                                                                                                                  |
| History sort and filters      | Oldest-first reorders the matching records. Bodyweight filtering shows the two October measurements. Missing durations remain blank rather than becoming zero. Space selects a measurement in the inspector; measurements have no Delete session control.                                                                                                                               |
| History pagination            | Year view initially showed 42 records across 30 dates. Show more loaded another 30 dates, giving 88 records. The button reported the remaining date count. Empty months show the empty record state and clear the inspector.                                                                                                                                                            |
| History source links          | Opening the best Bench Press log from Review navigates to July and selects the exact 29 July session. Bench Press, Bulgarian Split Squat and Seated Dumbbell Shoulder Press remain together in the inspector. No desktop modal is opened.                                                                                                                                               |
| History responsive switching  | The desktop table and inspector render at 1440 px and 1024 px. Resizing an explicitly selected record to tablet transfers it to the existing mobile dialog. Closing it restores the history list. Tablet and narrow-mobile layouts remain readable.                                                                                                                                     |
| Plan                          | Calendar, inspector, My Programme and mobile/tablet programme views work. Screenshot inspection identified the layout and wording issues below. Their local corrections are not yet in the browser build.                                                                                                                                                                               |

No page-wide horizontal overflow was measured at any tested width. Internal Plan clipping was found visually despite the page-wide checks passing. No browser console errors were captured during the follow-up flow.

## Local corrections awaiting sync

1. Plan mobility selector: reserve room for the Plan mobility button and allow the selector to shrink, instead of clipping the action outside the inspector.
2. Plan calendar badges: constrain chips to their day column, truncate long labels and preserve the full text in a tooltip.
3. Plan action buttons: wrap Strength, Conditioning and Climbing controls to available space.
4. Plan header: replace the misleading “No active programme session” fallback with “No current programme session in this week”. The programme may be active even when this week's sessions are finished.
5. History duration column: display sub-minute sessions in seconds, eg 40 sec, and longer durations with at most one decimal place. The browser currently exposes the raw 0.6666666666666666 min value for a mobility session.

TypeScript, targeted ESLint, formatting and the production build pass after these changes. All 16 focused component tests pass. The earlier full suite had 274 passing tests and one unrelated PostgreSQL-initialisation test blocked by the sandbox.

## Evidence

- [Review desktop](visual-review-desktop-2026-10-23.jpg)
- [Progress desktop](visual-progress-desktop-1440-2026-10-23.jpg)
- [Progress at 1024 px](visual-progress-desktop-1024-2026-10-23.jpg)
- [Progress tablet](visual-progress-tablet-768-2026-10-23.jpg)
- [Progress mobile](visual-progress-mobile-390-2026-10-23.jpg)
- [Progress mobile session](visual-progress-session-mobile-390-2026-10-23.jpg)
- [History desktop](visual-history-desktop-1440-2026-10-23.jpg)
- [History at 1024 px](visual-history-desktop-1024-2026-10-23.jpg)
- [History tablet](visual-history-tablet-768-2026-10-23.jpg)
- [History mobile](visual-history-mobile-390-2026-10-23.jpg)
- [History mobile details](visual-history-session-mobile-390-2026-10-23.jpg)
- [History no-result search](visual-history-empty-search-1440-2026-10-23.jpg)
- [Exact July source session](visual-history-source-link-1440-2026-10-23.jpg)
- [Plan clipping before correction](visual-plan-clipping-2026-10-23.jpg)
- [Measured follow-up page widths](visual-checks-2026-10-23.json)

## Remaining verification

Commit and sync the local display corrections, then visually recheck Plan at 1024 px and 1440 px and confirm that short History durations show seconds. Deletion and programme-apply actions were not executed against live records; their existing component coverage was retained.
