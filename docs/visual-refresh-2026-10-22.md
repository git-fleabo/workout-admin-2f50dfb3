# Visual refresh — 22 October 2026

The shared theme now uses a restrained navy palette, quieter card borders and orange primary actions. Inputs retain stronger boundaries and keyboard focus rings. Default buttons, inputs and selects have consistent 44px heights.

Today gives the next programme session or resumed workout a highlighted surface, larger heading and clearer exercise preview. Supporting sections use fewer nested borders. Warnings and completion states retain their own colours and text. Mobile draft actions stack to accommodate their labels.

The logger uses a consistent desktop content width, larger exercise names and tabular workout values. Recorded strength and hold entries have green borders and a labelled check badge with a short animation that respects reduced-motion preferences. Recording, skip, save and progression behaviour is unchanged. The header now uses a dumbbell mark; the build label is in Settings.

## Validation

- Full component suite: 261 passed. The profile-backup reconstruction test could not initialise its local PostgreSQL instance because the environment blocks shared memory creation.
- TypeScript and production build passed; ESLint reported no errors and eight existing fast-refresh warnings.
- Browser verification was attempted but blocked: local server binding returned EPERM and Chromium could not register its macOS Mach port. Mobile and desktop screenshots have therefore not been verified for this change.

Before release, visually check Today (programme, draft and completed states), Log (all movements, focused view, per-set editing and finish review), and Plan at phone and desktop widths. Shared control sizing also affects other routes.
