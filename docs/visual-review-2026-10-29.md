# Visual review — 29 October 2026

## Scope and release status

The signed-in published app was reviewed in the in-app browser on phone and desktop layouts,
including 320, 390, 1024 and 1440px widths. Review covered Today, Log, Plan, Mobility & Recovery,
Dashboard, Weekly Review, Progress, History and the settings screens. Recovery routine creation
was inspected without saving; no live training records were changed.

The original corrections were committed as `40c5c69` and are published. The follow-up browser
pass verified the corrected interface on the published build displaying `Build 20261029T0758`.
Two additional layout corrections were identified and implemented locally; their post-publication
visual check remains outstanding. The local preview server is still blocked by `listen EPERM`.

## Corrections

- Today renders one recovery shortcut, avoiding duplicate cards and independent Hide controls.
- Progress date filters and training methods wrap within the available space.
- Narrow Review navigation keeps all four labels on one line with smaller horizontal padding.
- Daily Rotation cards use a bounded single-column grid and wrap long movement names.
- Goals uses the shared page-title styling and a wrapping header; singular quantities read
  correctly, eg `1 session`.
- Dashboard reads the existing cached rest-day query. Explicit rest markers, empty logged days
  and future days have distinct labels in both layouts. Missing activity duration stays explicit
  instead of displaying `0m`. Refresh updates the rest markers too.
- Dashboard status hints sit below their values, and the subtitle uses singular/plural labels.
- Exercise Library keeps one exercise heading in the desktop inspector, preserves a close
  control, shows friendly tracking labels and uses the shared navy surfaces for history.
- Weekly Review formats comparison dates using the existing UK date formatter.
- Settings displays the build prefix once.

## Validation

- 290 component tests passed across 55 files. The database reconstruction component test was
  excluded because this change does not alter the backup or database contract.
- Dashboard regressions cover saved rest markers, unlogged and future days in both layouts,
  and missing activity duration on mobile.
- TypeScript, focused ESLint, formatting and the production build passed.
- No database schema, permissions or saved training records changed.

## Published follow-up checks

| Screen            | Width             | Result                                                                                                                                                                  |
| ----------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Review navigation | 320px             | All four labels fit on one line; each link's content fits its 71px column.                                                                                              |
| Progress          | 320px             | All five period filters and training methods are visible without horizontal scrolling; page width is 320px.                                                             |
| Daily Rotation    | 320px             | Cards fit the page, including long names; page width is 320px.                                                                                                          |
| Goals             | 320px             | Shared page heading and wrapping Add goal action; current quantity displays `1 session`.                                                                                |
| Today             | 320px and 390px   | One recovery shortcut. At 390px the page fits. At 320px a remaining programme-card overflow was measured and corrected locally as described below.                      |
| Dashboard         | 320px and 1440px  | Explicit rest markers on 27/28 October, unlogged today and future days have distinct labels. Missing-duration hints sit below values. Page widths match both viewports. |
| Exercise Library  | 1024px and 1440px | One exercise heading, friendly `Weight + reps` label, shared navy surfaces and a working close action. A separate close-button row at 1024px was corrected locally.     |
| Weekly Review     | Phone             | Comparison reads `Compared with 19 Oct 2026 to 22 Oct 2026`.                                                                                                            |
| Settings          | Desktop           | One build prefix.                                                                                                                                                       |

No browser console errors were captured during this follow-up. Browser sizing was reset afterwards.

## Additional local corrections

- Today at 320px had a 336px document because the implicit grid track honoured the large
  Continue button's unbroken minimum width. The grid now has a bounded single column, the card
  and title can shrink, and the primary button allows wrapping with smaller phone padding/type.
- The desktop Exercise Library close button is anchored at the inspector's top right with
  reserved space, preventing it from creating a separate toolbar row at 1024px.
- The 26 affected Today/programme/Library component tests, TypeScript, focused ESLint, formatting
  and the production build pass. No live training records were changed.

After publishing these two additional corrections, recheck Today at 320px and the Exercise Library
inspector at 1024px and 1440px. Their updated rendering has not yet been visually verified.
