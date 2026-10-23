# Visual refresh — 22 October 2026

The shared theme now uses a restrained navy palette, quieter card borders and orange primary actions. Inputs retain stronger boundaries and keyboard focus rings. Default buttons, inputs and selects have consistent 44px heights.

Today gives the next programme session or resumed workout a highlighted surface, larger heading and clearer exercise preview. Supporting sections use fewer nested borders. Warnings and completion states retain their own colours and text. Mobile draft actions stack to accommodate their labels.

The logger uses a consistent desktop content width, larger exercise names and tabular workout values. Recorded strength and hold entries have green borders and a labelled check badge with a short animation that respects reduced-motion preferences. Recording, skip, save and progression behaviour is unchanged. The header now uses a dumbbell mark; the build label is in Settings.

## Validation

- Full component suite: 261 passed. The profile-backup reconstruction test could not initialise its local PostgreSQL instance because the environment blocks shared memory creation.
- TypeScript and production build passed; ESLint reported no errors and eight existing fast-refresh warnings.
- Browser verification was attempted but blocked: local server binding returned EPERM and Chromium could not register its macOS Mach port. Mobile and desktop screenshots have therefore not been verified for this change.

Before release, visually check Today (programme, draft and completed states), Log (all movements, focused view, per-set editing and finish review), and Plan at phone and desktop widths. Shared control sizing also affects other routes.

## Remaining visual refresh

Progress now leads with the selected exercise's primary measured result, followed by supporting statistics and a full-width lead chart. Period, location and method filters remain visible and are repeated in the highlight context. Working-weight comparisons use the same filtered current/prior periods; an absent estimated 1RM is no longer replaced with the working weight. Missing primary measurements say “Not measured”, with no invented change. Climbing's separate all-history overview is explicitly labelled and collapsible below exercise results.

Charts use larger labels, clearer selected points, keyboard accessibility support and straight lines between observations. Null measurements remain gaps. Goal figures are more prominent, planner accents use orange and informational blue, and settings navigation uses quieter icons. Page headings share one responsive scale; tabs and text areas now match the other controls.

A barbell-and-trend mark replaces the generic header icon, with matching SVG browser icon, PNG app/Apple icons and a separate maskable icon. Browser chrome and launch colours match the navy theme. The header mark is included in the existing offline shell cache.

Validation: 263 component tests passed across 50 files, excluding the known environment-blocked PostgreSQL reconstruction test. Two new regressions cover location/period filtering, missing primary measurements and missing estimates. TypeScript passed. The new raster icon was visually inspected; full-screen browser layout verification remains outstanding under this session's restrictions.
