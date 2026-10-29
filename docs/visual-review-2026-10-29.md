# Visual review — 29 October 2026

## Scope and release status

The signed-in published app was reviewed in the in-app browser on phone and desktop layouts,
including 320, 390, 1024 and 1440px widths. Review covered Today, Log, Plan, Mobility & Recovery,
Dashboard, Weekly Review, Progress, History and the settings screens. Recovery routine creation
was inspected without saving; no live training records were changed.

The corrections below are local. **Post-change visual verification is outstanding.** The local
preview server cannot bind its port in this environment (`listen EPERM`). The published app
still shows the previous implementation. A second browser pass confirmed the narrow Review
navigation problem; it does not verify the corrected local layout.

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

## Visual check after publishing

Push through GitHub Desktop, sync/publish in Lovable, then check the changed build:

1. At 320 and 390px: Review tabs, all Progress date filters, long Daily Rotation names, Goals
   heading and the Dashboard's missing-duration tile.
2. At 1024 and 1440px: select an Exercise Library item, confirm one heading and friendly tracking
   label, then close the inspector. Check marked rest versus empty/future days on Dashboard.
3. Confirm one recovery shortcut on Today, UK comparison dates on Weekly Review and one build
   prefix in Settings.
