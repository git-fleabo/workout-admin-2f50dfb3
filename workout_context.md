# Workout App Context

Last updated: 2026-06-16

This file is the handoff document for the Training Admin workout app. A new chat or bot should be able to read this file first and understand the current product direction, local repo, Supabase project, Lovable/GitHub workflow, schema, key files, and sensible next steps.

## Project Status

The admin/settings app is now the main workout app. The original tracker app is retired for current work and should be ignored unless explicitly requested for historical reference.

The app has been moved from Google Sheets toward Supabase. Current priority is still that the app works for Noam exactly as it does now. Future flexibility matters, but preserving real training history, progress, and stats is more important than speculative redesign.

Product direction:

- Personal training admin app first.
- Not a public self-serve app.
- Noam is the admin and can manage data for others.
- Friends first, possibly clients later.
- One master exercise library.
- Per-person exercise selection should be supported.
- Future custom apps may be separate simplified Lovable apps on top of the same Supabase database.
- Future custom apps could show simplified libraries, suggested workouts/programs, class/run logging, and simpler tracking.

## Local Repos And Folders

Main repo to work in:

- `/Users/noam/Documents/Codex/gym-sheet-flow/workout-admin/workout-admin-2f50dfb3`

Current branch:

- `codex/unify-skills-workouts`

Git remote:

- `origin`: `https://github.com/git-fleabo/workout-admin-2f50dfb3.git`

Current latest known commit at this handoff:

- `64f7368 Split pull movements in library`

Other local folders that may exist but are not the current app:

- `/Users/noam/Documents/Codex/gym-sheet-flow/gym-sheet-flow`
- `/Users/noam/Documents/Codex/workout-tracker`
- `/Users/noam/Documents/Codex/workout-tracker/tracker-app`
- `/Users/noam/Documents/Codex/workout-tracker/settings-app`
- `/Users/noam/Documents/Codex/Workout Tracker/source`
- `/Users/noam/Documents/Codex/Workout Settings/source`

Use the main repo above unless Noam explicitly says otherwise.

## Workflow

Noam is using GitHub Desktop to push commits. Codex should make local changes, build/test, commit locally, then tell Noam to push via GitHub Desktop. Do not assume Codex can or should push unless Noam asks and the GitHub tooling is confirmed available.

Standard workflow:

1. Check local git status before changes.
2. Make narrowly scoped edits.
3. Apply any required Supabase data changes directly through the Supabase connector.
4. Update `workout_context.md` when a meaningful project decision or schema/library change is made.
5. Run a local build.
6. Commit locally with a clear message.
7. Tell Noam the commit hash and action: push via GitHub Desktop.
8. Ask Y/N whether to proceed after the action.

Working agreement with Noam:

- After completing each step, clearly state either the action Noam needs to take or a Y/N question asking whether to proceed.
- Keep responses non-technical where possible, but include exact file paths and commit hashes when useful.
- The user prefers GitHub Desktop for push/publish.

## Lovable

Lovable project id:

- `654d9e63-5a5b-4579-af55-ed2f97dd4f62`

Lovable local metadata:

- `.lovable/project.json`
- Template: `tanstack_start_ts_2026-05-29`

Lovable/GitHub behavior:

- Lovable builds from GitHub after Noam pushes commits.
- It is okay to push a new commit while Lovable is still building an older preview; Lovable should eventually build the newest pushed commit.
- The app displays a build/commit label so the Lovable preview can be checked against the expected commit.
- Lovable may require cache clearing to show the newest preview, but clearing cache uses Lovable tokens, so only do it when needed.
- Lovable does not allow setting arbitrary environment variables for this app, so the app must not depend on server-only env vars.

Known Lovable preview reference found in metadata:

- `id-preview-46daf711--f5b41aaa-913d-486f-9fcc-2d36e65fbf53.lovable.app` appears in generated Open Graph image metadata.

## Supabase

Supabase project:

- Name: `Training Admin`
- Project/ref/id: `dvcdghmcqqfvlbzufpyy`
- URL: `https://dvcdghmcqqfvlbzufpyy.supabase.co`
- Region: `eu-west-1`
- Database engine: Postgres 17
- Current known status: active/healthy

Frontend Supabase helper:

- `src/lib/supabase-public.ts`

Publishable key in frontend code:

- `sb_publishable_iqg20-V7vRrN97WXoG1miw_Jw8QR2uk`

Auth model:

- Supabase Auth email/password is used.
- App sign-up UI was removed.
- This should remain private/personal for now. Users should be created/approved administratively, not public self-signup.
- Keep Supabase public signups disabled in Supabase settings.
- Browser code uses the publishable key plus the signed-in user's access token.
- Never put a service role key in browser code or Lovable runtime.

RLS/settings summary:

- All public tables listed below have RLS enabled.
- Most app data policies are for role `authenticated`.
- Master lookup/library tables generally allow authenticated SELECT.
- Admin-style inserts/updates exist for `activity_types` and `exercises`.
- Managed-person policies exist for goals, sessions, logs, bodyweight, 1RM, and person exercise selections.
- `people_claim_unclaimed_noam` exists as a bootstrap policy for claiming the original Noam person row.

Important data files:

- `supabase/schema.sql`: local schema snapshot, may not always reflect every live data tweak.
- `supabase/approved_logging_library_updates.sql`: idempotent data update script for approved library/logging changes.
- `docs/supabase-schema-design.md`: original design direction.
- `docs/supabase-import-status.md`: import history, but some notes are stale because the app is now more migrated than this doc says.

## Current Supabase Row Counts

Live row counts checked on 2026-06-16:

- `activity_types`: 15
- `app_profiles`: 3
- `bodyweight_logs`: 3
- `entry_metrics`: 35
- `entry_sets`: 40
- `exercises`: 65
- `goal_checkins`: 0
- `goals`: 5
- `one_rm_tests`: 1
- `people`: 1
- `person_exercises`: 47
- `programs`: 0
- `session_entries`: 48
- `sessions`: 48
- `suggested_workouts`: 0

## Database Schema

All tables are in schema `public` and currently have RLS enabled.

### `people`

Purpose: one row per person whose training can be managed or tracked. Noam is just another person.

Rows: 1

Key columns:

- `id uuid primary key`
- `auth_user_id uuid unique nullable`
- `display_name text`
- `email text nullable`
- `status text`, one of `active`, `inactive`, `archived`
- `notes text nullable`
- timestamps

Relationships:

- Parent for goals, logs, bodyweight, 1RM, program assignments, app profiles, and admin relationships.

RLS:

- `people_select_accessible`
- `people_claim_unclaimed_noam`

### `admin_people`

Purpose: maps an admin/coach person to a managed person. Supports Noam managing other people later.

Rows: 1

Key columns:

- `id uuid primary key`
- `admin_person_id uuid -> people.id`
- `managed_person_id uuid -> people.id`
- `role text`, one of `admin`, `coach`
- `created_at`

RLS:

- `admin_people_select_for_admin`

### `app_profiles`

Purpose: defines app variants/features for full admin or simplified future apps.

Rows: 3

Current profiles:

- `full-training-admin`: Full dashboard, logging, library, goals, PRs, climbing, strength tests, bodyweight.
- `runs-and-classes`: Simplified future profile for runs/classes/history.
- `simple-workout-logger`: Simplified future profile for suggested workouts/log/history.

Key columns:

- `id uuid primary key`
- `name text`
- `slug text unique`
- `description text nullable`
- `config jsonb`
- timestamps

RLS:

- `app_profiles_select_authenticated`

### `person_app_profiles`

Purpose: assigns app profiles to people; currently Noam has the full admin profile.

Rows: 1

Key columns:

- `id uuid primary key`
- `person_id uuid -> people.id`
- `app_profile_id uuid -> app_profiles.id`
- `is_default boolean`
- `created_at`

### `activity_types`

Purpose: master activity categories used by sessions and exercises.

Rows: 15

Current activity types:

- `Strength` / `strength` / sort `10`
- `Cardio` / `cardio` / sort `20`
- `Yoga` / `yoga` / sort `30`
- `Stretching` / `stretching` / sort `40` (legacy category, no longer active in app options when empty)
- `Mobility/Flexibility` / `mobility-flexibility` / sort `45`
- `Sport` / `sport` / sort `60` (hidden from active app options for now)
- `Skills/Calisthenics` / `skills-calisthenics` / sort `70`
- `Grip` / `grip` / sort `80`
- `Climbing` / `climbing` / sort `90`
- `Bouldering` / `bouldering` / sort `95` (legacy/hidden)
- `Conditioning` / `conditioning` / sort `100`
- `Power` / `power` / sort `110`
- `Run` / `run` / sort `120`
- `Class` / `class` / sort `130`
- `Other` / `other` / sort `999`

Key columns:

- `id uuid primary key`
- `name text unique`
- `slug text unique`
- `sort_order integer`
- `created_at`

RLS:

- Authenticated SELECT.
- Authenticated admin-style INSERT/UPDATE policies.

### `exercises`

Purpose: master exercise/movement library. One library supports Noam now and future custom apps later.

Rows: 65

Key columns:

- `id uuid primary key`
- `activity_type_id uuid -> activity_types.id nullable`
- `name text`
- `focus_area text nullable`
- `equipment text nullable`
- `default_metric text nullable`
- `suggested_sets text nullable`
- `suggested_reps text nullable`
- `notes text nullable`
- `is_active boolean`
- `source_sheet text nullable`
- `source_row integer nullable`
- timestamps

Important active library decisions:

- `Pull-Up / Lat Pulldown` was split into `Pull-Up`, `Lat Pulldown`, and `Chin-Up`.
- `Ropes/Belay` replaced `Indoor Ropes`.
- Climbing active movements: `Bouldering Session`, `Ropes/Belay`, `Kilter`, `Mix`.
- Mobility/Flexibility active positions include `Side Split`, `Pancake`, `Pike`, `Bridge`, `Shoulder Flexion`, plus existing mobility/stretch items moved from `Stretching`.
- Run movements: `Jog`, `Run`, `Sprint`.
- Class movements: `Yoga Class`, `Pilates Class`, `Strength Class`, `Conditioning Class`.
- `Other Session` exists as a catch-all.
- Retired/hidden active library items include `Rice Bucket`, old `Indoor Climbing Session`, duplicate Strength `Farmer Carry`, and old Bouldering type movements.

RLS:

- Authenticated SELECT.
- Authenticated admin-style INSERT/UPDATE policies.

### `exercise_tags`

Purpose: future tagging system for master exercises.

Rows: 0

Key columns:

- `id uuid primary key`
- `name text unique`
- `slug text unique`

RLS:

- Authenticated SELECT.

### `exercise_tag_links`

Purpose: many-to-many join between exercises and tags.

Rows: 0

Key columns:

- `exercise_id uuid -> exercises.id`
- `tag_id uuid -> exercise_tags.id`
- composite primary key: `exercise_id`, `tag_id`

RLS:

- Authenticated SELECT.

### `person_exercises`

Purpose: per-person enable/disable/customization of master library exercises.

Rows: 47

Key columns:

- `id uuid primary key`
- `person_id uuid -> people.id`
- `exercise_id uuid -> exercises.id`
- `is_enabled boolean`
- `custom_name text nullable`
- `notes text nullable`
- timestamps

RLS:

- Managed-person SELECT/INSERT/UPDATE/DELETE policies.

### `sessions`

Purpose: top-level training session/log row. Workout, climbing, class, run, body of activity data starts here.

Rows: 48

Key columns:

- `id uuid primary key`
- `person_id uuid -> people.id`
- `activity_type_id uuid -> activity_types.id nullable`
- `session_date date`
- `title text nullable`
- `source text`, default `manual`
- `completed boolean`
- `duration_minutes numeric nullable`
- `intensity text nullable`
- `rpe numeric nullable`
- `notes text nullable`
- `source_sheet text nullable`
- `source_row integer nullable`
- timestamps

RLS:

- Managed-person SELECT/INSERT/DELETE policies.

### `session_entries`

Purpose: item/movement entries within a session. Most current logs use one entry per session, but schema supports multiple entries.

Rows: 48

Key columns:

- `id uuid primary key`
- `session_id uuid -> sessions.id`
- `exercise_id uuid -> exercises.id nullable`
- `activity_type_id uuid -> activity_types.id nullable`
- `entry_kind text nullable`
- `name text`
- `progression_level text nullable`
- `order_index integer`
- `completed boolean`
- `notes text nullable`
- `source_sheet text nullable`
- `source_row integer nullable`
- timestamps

RLS:

- Managed-person SELECT/INSERT policies.

### `entry_sets`

Purpose: structured numeric set data for entries. Also stores one aggregate row for simple/manual logs where appropriate.

Rows: 40

Key columns:

- `id uuid primary key`
- `session_entry_id uuid -> session_entries.id`
- `set_number integer nullable`
- `reps numeric nullable`
- `weight numeric nullable`
- `duration_seconds numeric nullable`
- `distance numeric nullable`
- `distance_unit text nullable`
- `rpe numeric nullable`
- `rest_seconds integer nullable`
- `rest_time text nullable`
- `assistance_type text nullable`
- `assistance_detail text nullable`
- `quality text nullable`
- `completed boolean`
- `notes text nullable`
- `created_at`

RLS:

- Managed-person SELECT/INSERT policies.

### `entry_metrics`

Purpose: flexible key/value metrics for data that does not fit cleanly in set columns.

Rows: 35

Key columns:

- `id uuid primary key`
- `session_entry_id uuid -> session_entries.id`
- `metric_key text`
- `metric_value numeric nullable`
- `metric_text text nullable`
- `metric_unit text nullable`
- `created_at`

Used for:

- climbing metrics such as `tracking_mode`, `hours`, `boulders`, `grade`, `gradient`
- legacy skill metrics such as `legacy_pr` and `legacy_assistance`
- flexible logging metrics such as `rounds`, `feel`, `height`, `detail`

RLS:

- Managed-person SELECT/INSERT policies.

### `one_rm_tests`

Purpose: strength test/estimated 1RM data.

Rows: 1

Key columns:

- `id uuid primary key`
- `person_id uuid -> people.id`
- `test_date date`
- `exercise_id uuid -> exercises.id nullable`
- `exercise_name text`
- `source text nullable`
- `load_type text nullable`
- `bodyweight_used boolean`
- `bodyweight_contribution text nullable`
- `external_weight numeric nullable`
- `reps numeric nullable`
- `rpe numeric nullable`
- `formula text nullable`
- `estimated_total numeric nullable`
- `estimated_external numeric nullable`
- `is_pr boolean`
- `notes text nullable`
- source trace columns
- timestamps

RLS:

- Managed-person SELECT/INSERT/DELETE policies.

### `bodyweight_logs`

Purpose: bodyweight history.

Rows: 3

Key columns:

- `id uuid primary key`
- `person_id uuid -> people.id`
- `logged_date date`
- `bodyweight numeric`
- `notes text nullable`
- source trace columns
- `created_at`

RLS:

- Managed-person SELECT/INSERT/DELETE policies.

### `goals`

Purpose: stored goals. Dashboard currently stays focused on weekly workouts and active minutes, while the Goals tab handles custom checklist-style goals.

Rows: 5

Key columns:

- `id uuid primary key`
- `person_id uuid -> people.id`
- `goal text`
- `metric text nullable`
- `target text nullable`
- `period text nullable`
- `notes text nullable`
- `status text`, one of `active`, `paused`, `complete`, `archived`
- source trace columns
- timestamps

RLS:

- Managed-person SELECT/INSERT/UPDATE/DELETE policies.

### `goal_checkins`

Purpose: lightweight check-off history for goals.

Rows: 0

Key columns:

- `id uuid primary key`
- `goal_id uuid -> goals.id`
- `person_id uuid -> people.id`
- `checked_date date`
- `note text nullable`
- `created_at`

RLS:

- Managed-person SELECT/INSERT/DELETE policies.

### `programs`

Purpose: future program templates or custom programs.

Rows: 0

Key columns:

- `id uuid primary key`
- `name text`
- `description text nullable`
- `created_by_person_id uuid -> people.id nullable`
- `is_template boolean`
- timestamps

### `program_workouts`

Purpose: workouts within a program template.

Rows: 0

Key columns:

- `id uuid primary key`
- `program_id uuid -> programs.id`
- `name text`
- `sequence_index integer`
- `description text nullable`
- timestamps

### `program_workout_entries`

Purpose: prescribed exercises/steps within a program workout.

Rows: 0

Key columns:

- `id uuid primary key`
- `program_workout_id uuid -> program_workouts.id`
- `exercise_id uuid -> exercises.id nullable`
- `name text`
- `order_index integer`
- `sets`, `reps`, `weight`, `duration`, `rpe`, `rest` as text nullable
- `progression_level`, `assistance_type`, `assistance_detail`, `notes` nullable
- timestamps

### `program_assignments`

Purpose: assign a program to a person, with progress state.

Rows: 0

Key columns:

- `id uuid primary key`
- `program_id uuid -> programs.id`
- `person_id uuid -> people.id`
- `assigned_by_person_id uuid -> people.id nullable`
- `status text`, one of `active`, `paused`, `complete`, `archived`
- `current_workout_index integer`
- `started_on date nullable`
- `completed_on date nullable`
- `notes text nullable`
- timestamps

### `suggested_workouts`

Purpose: future suggested workout instances for a person.

Rows: 0

Key columns:

- `id uuid primary key`
- `person_id uuid -> people.id`
- `program_assignment_id uuid -> program_assignments.id nullable`
- `program_workout_id uuid -> program_workouts.id nullable`
- `suggested_for date nullable`
- `status text`, one of `pending`, `accepted`, `completed`, `skipped`, `archived`
- `title text`
- `notes text nullable`
- timestamps

## App Behavior And Screens

### Dashboard

The dashboard reads from Supabase and shows weekly training, climbing, strength, monthly summaries, recent PRs, and long-term trend data.

Workout counts should count distinct workout days, not individual exercise rows. Logging multiple exercises on the same day should still count as one workout in summary stats.

The dashboard should remain focused. Weekly workout and weekly active-minute goals should stay visible. Do not reintroduce a bulky active-goals panel without a fresh decision.

### Log

The log screen supports:

- workout entries
- climbing entries from the main Log form by choosing type `Climbing`
- 1RM tests
- bodyweight logs

Successful logs should show confirmation messages. Delete confirmations should use app dialogs, not browser-native popups.

Climbing:

- Type: `Climbing`
- Movements: `Bouldering Session`, `Ropes/Belay`, `Kilter`, `Mix`
- Field label: `Boulders/Routes`
- Intensity is included
- Gradient appears and saves only for `Kilter`

Flexible metric profiles:

- Weighted/reps movements use sets/reps/weight as appropriate.
- Carries use rounds/distance/time/load.
- Static holds and grip hangs use attempts/hold/feel/progression or grip style.
- Mobility/Flexibility positions use Distance (cm), Hold (sec), Feel (1-5).
- Time-based Run/Class/Other movements use minutes/distance/feel, with Class also showing Intensity.
- Conditioning and power movements use their movement-appropriate fields.

### Library

The library reads from Supabase. It supports:

- master movement list
- add/edit/hide movements
- per-person enable/disable selections
- exercise history/details

History tiles in the library were made visually distinct from exercise tiles.

### Goals

Goals read/write Supabase. The Goals tab has a lightweight checklist flow:

- mark goal off for today
- show recent check-ins
- remove mistaken check-ins

Check-ins are stored in `goal_checkins`.

### History

Top-level History tab includes:

- Week / Month / Quarter controls
- previous/next period navigation
- filters for All, Workouts, Climb, 1RM, Bodyweight
- summary tiles
- entries grouped by date
- click/tap detail dialog

History workout counts should also count same-day workout exercises as one workout in the summary.

## Key Files

- `src/components/admin-shell.tsx`: main shell, navigation, build label, sign out.
- `src/components/exercise-detail.tsx`: exercise history/detail visualization.
- `src/components/supabase-auth-gate.tsx`: email/password auth gate.
- `src/lib/build-info.ts`: build/commit label support.
- `src/lib/date.ts`: date helpers.
- `src/lib/movement-metrics.ts`: movement-to-metric-profile rules for logging fields.
- `src/lib/supabase-public.ts`: Supabase Auth/session and REST helpers.
- `src/lib/supabase-people.browser.ts`: current person/profile helpers.
- `src/lib/supabase-dashboard.browser.ts`: dashboard data loading and aggregation.
- `src/lib/supabase-log.browser.ts`: workout/climbing/1RM/bodyweight log data functions.
- `src/lib/supabase-library.browser.ts`: library and person exercise selection data functions.
- `src/lib/supabase-goals.browser.ts`: goals and check-ins data functions.
- `src/lib/supabase-history.browser.ts`: exercise-specific history for library detail.
- `src/lib/supabase-timeline.browser.ts`: combined History tab data.
- `src/routes/index.tsx`: dashboard route.
- `src/routes/log.tsx`: log screen route.
- `src/routes/-workout-form.tsx`: shared workout/climbing log form and metric-field UI.
- `src/routes/library.tsx`: library route.
- `src/routes/goals.tsx`: goals route.
- `src/routes/history.tsx`: history route.
- `src/routes/__root.tsx`: root route and app metadata.
- `src/routeTree.gen.ts`: generated TanStack route tree; builds update it automatically.
- `vite.config.ts`: Lovable/TanStack Vite config.
- `package.json`: scripts and dependencies.
- `supabase/schema.sql`: schema/policy snapshot.
- `supabase/approved_logging_library_updates.sql`: reusable SQL for approved data-library changes.
- `workout_context.md`: this handoff file; keep it current.

## Build And Verification

Standard build:

```bash
npm run build
```

Alternative explicit build command used previously:

```bash
/Users/noam/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node ./node_modules/vite/bin/vite.js build
```

If visual verification is needed:

1. Start the local Vite dev server.
2. Open the local app in the Codex in-app browser.
3. Local browser may not already be signed into Supabase, so auth state can limit verification.

## Recent Commits

Most recent known commits:

- `64f7368` Split pull movements in library
- `bd958ea` Refine climbing and mobility logging
- `c036d4c` Add flexible logging metric profiles
- `54ab110` Fold climbing into main log flow
- `fe34022` Add goal checklist check-ins
- `f8ef58d` Remove active goals panel and fix bodyweight layout

Earlier important commits:

- `35b77d1` Show active goals on dashboard
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

## Known Gotchas

- Lovable preview can lag behind GitHub. Use the build label to confirm the preview commit.
- Lovable cache clearing can use tokens.
- Do not add service-role keys to Lovable/browser code.
- `docs/supabase-import-status.md` has old migration notes and says some screens were still spreadsheet-backed; current app state is more advanced.
- `Stretching`, `Sport`, and `Bouldering` activity type rows still exist in the database for legacy/history reasons, but app options filter out empty/retired categories.
- `person_exercises` row count can lag master `exercises` count; the library can still display master exercises, and per-person enable rows can be added as needed.
- When changing library data directly in Supabase, also update `supabase/approved_logging_library_updates.sql` or another tracked SQL file so the change is reproducible.

## Suggested Next Steps

Recommended next work, in order:

1. Push any local commits via GitHub Desktop if the branch is ahead of remote.
2. In Lovable preview, confirm the commit label matches the latest pushed commit.
3. Test Log flows for Strength, Run, Class, Mobility/Flexibility, Grip, Climbing, 1RM, and Bodyweight.
4. Confirm `Pull-Up`, `Lat Pulldown`, and `Chin-Up` appear separately in the Library and Log movement selector.
5. Decide whether new master exercises should automatically create `person_exercises` rows for Noam, or whether the app should treat missing rows as enabled by default.
6. Build a simple admin-only user management flow before inviting friends: create person, link auth user, select app profile, select/deselect exercises.
7. Tighten the profile-claim bootstrap now that Noam's account is linked.
8. Start implementing suggested workouts/programs using the existing empty program tables.
9. Consider generating and saving TypeScript types from Supabase once schema/data shape stabilizes.
10. Keep simplifying future custom app ideas around app profiles rather than duplicating data.
