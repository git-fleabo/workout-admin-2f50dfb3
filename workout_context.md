# Workout App Context

Last updated: 2026-06-16

## Current Direction

The admin/settings app is now the main workout app. The original tracker app is retired for current work and can be ignored unless explicitly needed for reference.

The app has been moved from spreadsheet-backed data toward Supabase-backed data. The immediate priority is that the app continues working for Noam exactly as it did before, while the database and code are shaped so it can later support separate, simplified apps for friends or clients.

## Product Goals

- Personal training admin app first.
- Future support for custom apps for other people, initially friends and possibly clients later.
- Not a public self-serve product.
- Noam remains the admin and can manage data for others.
- One master exercise library, with per-person exercise selection available later.
- Support suggested workouts/programs and simplified tracking views in future custom apps.
- Preserve real training history and progress/stats above all else.

## Data Model Direction

The agreed direction is a structured Supabase database that keeps:

- People/profiles as first-class records, with Noam treated as another person.
- A master exercise library.
- Per-person availability/selection of exercises.
- Workout sessions and session entries.
- Sets and metrics attached to session entries.
- Climbing/runs/classes represented through structured activity/session data rather than ad hoc sheets.
- 1RM tests and bodyweight logs preserved for progress tracking.
- Goals tracked separately from historical logs.

The schema is designed to support Noam's current app plus future simplified apps without forking the core data model.

## Supabase Project

- Supabase project id: `dvcdghmcqqfvlbzufpyy`
- The app currently uses Supabase Auth with email/password sign-in.
- Sign-up UI was removed from the app.
- The app should not allow arbitrary public users to start using it. Supabase Auth signups should remain disabled in Supabase settings.
- Public database access is through the app's Supabase REST helper using the publishable key plus the signed-in user's access token.

## Lovable / GitHub Flow

- Lovable project id: `654d9e63-5a5b-4579-af55-ed2f97dd4f62`
- GitHub Desktop is currently being used by Noam to push local commits.
- Lovable builds from GitHub after commits are pushed.
- A build label is displayed in the app so the Lovable preview can be compared against the expected commit.
- It is okay to push a new commit while Lovable is still building an older one; Lovable should eventually build the newest pushed commit.

## Important App Decisions

- The spreadsheet helper code and old password gate were removed from the active app.
- The old data-check route was removed because it depended on spreadsheet-style environment variables and was no longer useful in Lovable.
- The app uses Supabase directly for dashboard, log, library, goals, and history data.
- Signup was removed from the app UI; users should be created/approved administratively.
- Delete confirmations use app dialogs, not browser-native popups.
- Success messages are shown after logging/updating/deleting where relevant.

## Current Main Screens

### Dashboard

The dashboard reads from Supabase and shows weekly training, climbing, strength, monthly summaries, recent PRs, and long-term trend data.

Workout counts on the dashboard count distinct workout days rather than individual exercise rows, so logging multiple exercises on one day does not inflate the workout total.

### Log

The log screen supports adding:

- Workout entries
- Climbing entries from the main Log form by choosing type `Climbing`
- 1RM tests
- Bodyweight logs

Successful logs show confirmation messages.

Climbing is no longer a separate top-level Log tab. In the main Log form, choosing `Climbing` changes movement options to `Bouldering Session`, `Indoor Ropes`, `Kilter`, and `Mix`, and shows climbing-specific fields such as hours, boulders, max grade, and gradient.

### Library

The library reads from Supabase. It supports managing movements and showing exercise history/details. History tiles were made visually distinct from exercise tiles.

### Goals

Goals are stored and read from Supabase.

When goals are added, updated, deleted, or the profile is connected from the Goals tab, the app invalidates both the goals and dashboard data. This means the dashboard picks up changed goal targets when returning to it without needing a hard refresh.

The dashboard should stay focused and avoid a large custom goals section. Weekly workout and weekly active-minute goals should remain visible on the dashboard. A future custom-goals workflow should allow goals to be added and marked off without disrupting the dashboard layout.

The Goals tab now has a lightweight checklist workflow. Goals can be marked off for today, recent check-ins are shown on each goal card, and a mistaken check-in can be removed. Check-ins are stored in `goal_checkins` and cascade-delete with their parent goal.

### History

A new top-level History tab was added.

It includes:

- Week / Month / Quarter period controls
- Previous / next period navigation
- Filters for All, Workouts, Climb, 1RM, Bodyweight
- Summary tiles
- Entries grouped by date
- Click/tap detail dialog

Important counting rule: workout exercises logged on the same day count as 1 workout in the summary, even though the timeline can still show individual exercise entries for detail.

## Key Files

- `src/components/admin-shell.tsx` - main app shell, navigation, build label, sign out.
- `src/lib/supabase-public.ts` - Supabase Auth/session and REST helpers.
- `src/lib/supabase-people.browser.ts` - current person/profile helpers.
- `src/lib/supabase-dashboard.browser.ts` - dashboard data loading and aggregation.
- `src/lib/supabase-log.browser.ts` - logging workouts/climbing/1RM/bodyweight.
- `src/lib/supabase-library.browser.ts` - library management and person-specific exercise selection.
- `src/lib/supabase-goals.browser.ts` - goals data.
- `src/lib/supabase-history.browser.ts` - exercise-specific history for the library.
- `src/lib/supabase-timeline.browser.ts` - combined timeline data for the History tab.
- `src/routes/history.tsx` - History tab UI.
- `src/routes/log.tsx` - log screen.
- `src/routes/library.tsx` - library screen.
- `src/routes/index.tsx` - dashboard.
- `src/routeTree.gen.ts` - generated TanStack route tree; updated automatically by builds.
- `supabase/schema.sql` - local copy of the current database schema/policies.
- `vite.config.ts` and `src/lib/build-info.ts` - commit/build label support.

## Recent Commits

- `e8064c4` Count workouts by day in history
- `cc51ed4` Add history timeline view
- `b061f90` Show build commit in app
- `4d0c842` Use app dialog for log deletes
- `d6dff1b` Improve log confirmations and history styling
- `249e062` Add log entry deletion controls
- `2a73711` Remove retired sheets and password gate helpers
- `d4f1348` Remove signup path and data check route
- `e2c9d31` Separate shared training types from sheets helpers
- `4e35028` Migrate log screens to Supabase

## Verification Pattern

Usual local build command:

```bash
/Users/noam/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node ./node_modules/vite/bin/vite.js build
```

If visual verification is needed, start the local Vite app and open it in the Codex in-app browser. Local browser sessions may not already be signed into Supabase, so sign-in state can limit what is visible locally.

## Working Agreement

After completing each step, clearly state either:

- the action Noam needs to take, or
- a Y/N question asking whether to proceed.

Keep this file updated with meaningful future changes so new work can resume quickly.
