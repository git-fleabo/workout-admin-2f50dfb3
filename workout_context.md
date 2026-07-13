# Workout App Context

Last updated: 2026-07-13

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
- Programme-template support is being added inside this existing workout admin app and Supabase database; do not create a new app or database for it.
- The umbrella model for percentage-based strength methodologies is `Percentage Strength Blocks`.
- Seeded percentage strength templates are `Operator Style Strength Block` and `Fighter Style Strength Block`.
- Operator runs 3 sessions/week. Fighter runs 2 sessions/week and is better for clients who need more room for conditioning, sport, running, climbing, or other training.
- Programme UI is intentionally deferred until the schema and seed data are stable.

## Local Repos And Folders

Main repo to work in:

- `/Users/noam/Documents/Codex/gym-sheet-flow/workout-admin/workout-admin-2f50dfb3`

Current branch:

- `codex/unify-skills-workouts`

Git remote:

- `origin`: `https://github.com/git-fleabo/workout-admin-2f50dfb3.git`

Source of truth for the latest commit:

- Run `git log -1 --oneline` in the main repo.
- This file should be updated with each meaningful iteration, but the exact latest hash may move whenever this file itself is committed.

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
- Lovable may auto-commit repair changes when its build fails. Pull/merge those commits, inspect the diff, and preserve intentional app behavior such as the shared toast provider in `src/routes/__root.tsx`.

Known Lovable preview reference found in metadata:

- `id-preview-46daf711--f5b41aaa-913d-486f-9fcc-2d36e65fbf53.lovable.app` appears in generated Open Graph image metadata.

## Supabase

### Shared Training Database

This app uses the shared Training Admin Supabase database. Before database, auth, RLS, schema, migration, or cross-app data work, read:

- /Users/noam/Documents/Codex/SHARED_TRAINING_DATABASE_CONTEXT.md

Shared project ref/id: dvcdghmcqqfvlbzufpyy.

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
- The auth gate verifies that the signed-in Supabase user is linked to a `people` row and has an `admin_people` row before rendering this admin app. If not approved, the session is cleared and the app stays locked.
- Password recovery links are handled by the app: if Supabase opens the app with `#access_token=...&type=recovery`, `SupabaseAuthGate` shows a new-password form, updates the password through Supabase Auth, clears the recovery URL, and returns to normal sign-in.
- Supabase Auth URL Configuration controls whether recovery links go to Lovable preview or the real/published app URL. Keep the correct real app URL as Site URL and include any preview URLs as allowed Redirect URLs while testing.

RLS/settings summary:

- All public tables listed below have RLS enabled.
- Most app data policies are for role `authenticated`.
- Master lookup/library tables generally allow authenticated SELECT.
- Reusable programme templates allow authenticated SELECT through template-only policies on `programs`, `program_workouts`, and `program_workout_entries`.
- Admin-style inserts/updates exist for `activity_types` and `exercises`.
- Managed-person policies exist for goals, sessions, logs, bodyweight, 1RM, and person exercise selections.
- `people_claim_unclaimed_noam` exists as a bootstrap policy for claiming the original Noam person row.

Important data files:

- `docs/product-roadmap.md`: product redesign roadmap organised around Plan, Train, Review, and Adjust; Phase 1 is the unified logger.
- `supabase/schema.sql`: local schema snapshot, may not always reflect every live data tweak.
- `supabase/migrations/20260713100036_add_training_locations.sql`: tracked Home/Gym training-location schema, session foreign key, RLS, grants, and initial location seed.
- `supabase/approved_logging_library_updates.sql`: idempotent data update script for approved library/logging changes.
- `supabase/percentage_strength_blocks.sql`: idempotent seed script for reusable Percentage Strength Blocks, currently Operator Style Strength Block and Fighter Style Strength Block.
- `supabase/program_template_read_policies.sql`: idempotent RLS policy script allowing authenticated users to read reusable template rows from `programs`, `program_workouts`, and `program_workout_entries`.
- `docs/supabase-schema-design.md`: original design direction.
- `docs/supabase-import-status.md`: import history, but some notes are stale because the app is now more migrated than this doc says.

## Current Supabase Row Counts

Live row counts checked on 2026-06-19:

- `activity_types`: 15
- `app_profiles`: 3
- `bodyweight_logs`: 3
- `entry_metrics`: 39
- `entry_sets`: 47
- `exercises`: 72
- `goal_checkins`: 0
- `goals`: 5
- `one_rm_tests`: 1
- `people`: 1
- `person_exercises`: 47
- `program_assignment_exercises`: 0
- `program_assignments`: 0
- `program_workout_entries`: 102
- `program_workouts`: 30
- `programs`: 2
- `session_entries`: 56
- `sessions`: 56
- `suggested_workouts`: 0

Selected live counts rechecked on 2026-07-13 after the workout-logging iteration:

- `sessions`: 95
- `session_entries`: 106
- `entry_sets`: 90
- `training_locations`: 2 (`Home`, `Gym`)

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
- `Power` / `power` / sort `110` (legacy/hidden from logging options when empty; active power movements live under `Conditioning`)
- `Run` / `run` / sort `120` (legacy/hidden from logging options when empty; active run movements live under `Cardio`)
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

Rows: 72

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
- Cardio movements: `Jog`, `Run`, `Bike`, `Row`, `Sprint`; old combined `Run / Bike / Row` is inactive.
- Calisthenics muscle-up tracking is split into `Bar Muscle-Up` and `Ring Muscle-Up`; previous `Muscle-Up` logs/tests were renamed to `Ring Muscle-Up`.
- Skills/Calisthenics active movements include `Handstand Pushups`, `Pistol Squat`, `Pushups`, and `1-Arm Pushups`.
- Conditioning includes power-style movements such as `Box Jumps`.
- Class movements: `Yoga Class`, `Pilates Class`, `Strength Class`, `Conditioning Class`.
- `Other Session` exists as a catch-all.
- Retired/hidden active library items include `Rice Bucket`, old `Indoor Climbing Session`, duplicate Strength `Farmer Carry`, and old Bouldering type movements.

RLS:

- Authenticated SELECT.
- Authenticated admin-style INSERT/UPDATE policies.

### `exercise_tags`

Purpose: future tagging system for master exercises.

Rows: 1

Key columns:

- `id uuid primary key`
- `name text unique`
- `slug text unique`

RLS:

- Authenticated SELECT.

### `exercise_tag_links`

Purpose: many-to-many join between exercises and tags.

Rows: 18

Key columns:

- `exercise_id uuid -> exercises.id`
- `tag_id uuid -> exercise_tags.id`
- composite primary key: `exercise_id`, `tag_id`

RLS:

- Authenticated SELECT.

### `person_exercises`

Purpose: per-person enable/disable/customization of master library exercises.

Rows: 55 (checked 2026-07-13)

Key columns:

- `id uuid primary key`
- `person_id uuid -> people.id`
- `exercise_id uuid -> exercises.id`
- `is_enabled boolean`
- `location_scope text`, one of `home`, `gym`, `both`; default `both`
- `custom_name text nullable`
- `notes text nullable`
- timestamps

RLS:

- Managed-person SELECT/INSERT/UPDATE/DELETE policies.

### `sessions`

Purpose: top-level training session/log row. Workout, climbing, class, run, body of activity data starts here.

Rows: 95

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
- `training_location_id uuid -> training_locations.id nullable`
- `source_sheet text nullable`
- `source_row integer nullable`
- timestamps

RLS:

- Managed-person SELECT/INSERT/DELETE policies.

### `training_locations`

Purpose: explicit training context for logging and future history-based workout suggestions.

Rows: 2

Key columns:

- `id uuid primary key`
- `person_id uuid -> people.id`
- `name text`, currently `Home` or `Gym`
- `kind text`, one of `home`, `gym`, `other`
- `is_active boolean`

RLS:

- Managed-person SELECT/INSERT/UPDATE/DELETE policies use `app_private.person_is_accessible(person_id)`.

### `session_entries`

Purpose: item/movement entries within a session. Most current logs use one entry per session, but schema supports multiple entries.

Rows: 106

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

Rows: 90

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

Rows: 54

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

Purpose: program templates or custom programs. Extended to support Percentage Strength Blocks such as Operator Style Strength Block and Fighter Style Strength Block.

Rows: 2

Key columns:

- `id uuid primary key`
- `name text`
- `description text nullable`
- `created_by_person_id uuid -> people.id nullable`
- `is_template boolean`
- `method_type text nullable`
- `duration_weeks integer nullable`
- `sessions_per_week integer nullable`
- `default_set_choice text nullable`
- `percent_base text nullable`
- `rounding_increment numeric nullable`
- timestamps

### `program_workouts`

Purpose: workouts within a program template. Percentage Strength Blocks use week/session/day numbering on top of sequence order.

Rows: 30

Key columns:

- `id uuid primary key`
- `program_id uuid -> programs.id`
- `name text`
- `sequence_index integer`
- `week_number integer nullable`
- `day_number integer nullable`
- `session_number integer nullable`
- `description text nullable`
- timestamps

### `program_workout_entries`

Purpose: prescribed exercises/steps within a program workout.

Rows: 102

Key columns:

- `id uuid primary key`
- `program_workout_id uuid -> program_workouts.id`
- `exercise_id uuid -> exercises.id nullable`
- `name text`
- `slot_key text nullable`
- `order_index integer`
- `min_sets integer nullable`
- `max_sets integer nullable`
- `min_reps integer nullable`
- `max_reps integer nullable`
- `intensity_percent numeric nullable`
- `percent_base text nullable`
- `rounding_increment numeric nullable`
- `is_optional boolean`, default `false`
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

### `program_assignment_exercises`

Purpose: per-assignment mapping from programme template slots to the actual selected exercises and training maxes for a managed person.

Rows: 0

Key columns:

- `id uuid primary key`
- `program_assignment_id uuid -> program_assignments.id`
- `slot_key text`
- `exercise_id uuid -> exercises.id nullable`
- `exercise_name text`
- `training_max numeric nullable`
- `one_rm_test_id uuid -> one_rm_tests.id nullable`
- `notes text nullable`
- timestamps

RLS:

- Managed-person SELECT/INSERT/UPDATE/DELETE policies via the parent `program_assignments.person_id`.

### `suggested_workouts`, `suggested_workout_entries`, and `suggested_workout_sets`

Purpose: persistent, editable next-workout plans that can move from suggestion to a completed session.

Rows: 0

Key columns:

- `id uuid primary key`
- `person_id uuid -> people.id`
- `program_assignment_id uuid -> program_assignments.id nullable`
- `program_workout_id uuid -> program_workouts.id nullable`
- `training_location_id uuid -> training_locations.id nullable`
- `suggested_for date nullable`
- `status text`, one of `pending`, `accepted`, `completed`, `skipped`, `archived`
- `title text`
- `readiness text`, one of `normal`, `fresh`, `tired`
- `basis text nullable`
- `completed_session_id uuid -> sessions.id nullable`
- `notes text nullable`
- timestamps

`suggested_workout_entries` stores ordered movement names, workout types, source dates, and plain-language progression reasons. `suggested_workout_sets` stores ordered reps, weight, RPE, and completion targets for each entry.

RLS:

- Authenticated SELECT/INSERT/UPDATE/DELETE policies use `app_private.person_is_accessible` directly on the plan and through the parent plan for entry/set rows.
- A rollback-only authenticated test inserted and read one plan, entry, and set successfully after the 2026-07-13 migration.

Programme-template decision:

- The umbrella model is `Percentage Strength Blocks`.
- Seeded templates are `Operator Style Strength Block` and `Fighter Style Strength Block`.
- Operator is 3 sessions/week.
- Fighter is 2 sessions/week and better for clients who need more room for conditioning, sport, running, climbing, or other training.
- This extends the existing `programs`, `program_workouts`, `program_workout_entries`, and `program_assignments` model, with a new `program_assignment_exercises` table for slot-to-exercise mappings.
- No new app or database is being created.
- UI and workout logging behaviour changes are intentionally deferred; the current app should behave exactly as before until a future UI iteration uses these tables.

## App Behavior And Screens

### Dashboard

The dashboard reads from Supabase and shows weekly training, climbing, strength, monthly summaries, recent PRs, and long-term trend data.

Workout counts should count distinct workout days, not individual exercise rows. Logging multiple exercises on the same day should still count as one workout in summary stats.

Dashboard workout counts/details should include any completed non-climbing session with completed entries, regardless of `source_sheet`. This keeps manually sent Strength Block Builder sessions visible in the dashboard when they already appear in History.

The dashboard should remain focused. Weekly workout and weekly active-minute goals should stay visible. Do not reintroduce a bulky active-goals panel without a fresh decision.

The dashboard has a manual refresh button. Use this to force a fresh Supabase read without needing a browser hard refresh.

### Log

The log screen supports:

- workout entries
- climbing entries from the main Log form by choosing type `Climbing`
- 1RM tests
- bodyweight logs

1RM logging uses Epley as the fixed/default estimate formula. The formula selector is intentionally hidden from the UI, but new rows still save `formula = 'Epley'` in `one_rm_tests`.

Legacy quick-log aggregate `Reps` mean total reps across all sets. Calculations that need reps per set use `ceil(total reps / sets)` for those historical single-row entries. New unified-logger entries store each set separately, so estimated 1RM, total reps, and mixed-load volume use the exact set rows.

Recent workout summaries on the log screen should display sets and reps as separate labels, for example `3 sets · 12 total reps`, because reps are total reps across all sets rather than reps per set.

The PR tab groups calisthenics/skill PRs by normalized skill name. For each skill, it should show at most one best hold and one best reps item, with progression and assistance details inside the same skill card rather than repeated cards such as multiple `Front Lever` or `Pistol Squat` rows caused by progression, assistance, casing, spacing, or punctuation differences.

Live Supabase library and logs were standardized on `Pistol Squat` instead of `Pistol Squats`.

Successful logs should show confirmation messages. Delete confirmations should use app dialogs, not browser-native popups.

After a workout/climb is saved, the Log form clears all fields back to a fresh blank state.

Before saving a workout or climb, the app checks for an existing same-date, same-movement entry in Supabase. If one exists, it shows an app dialog asking whether to save another anyway.

The Log tab now has one workout-session composer rather than separate `Quick log` and `Full workout` modes. It starts with one blank movement, so a one-movement entry is simply a workout with one movement. It begins with Home/Gym context, keeps session date/name/duration/intensity/RPE/notes inside an optional collapsed section, and uses a searchable movement picker without a separate type selection.

For standard set/reps movements, the unified logger records one `entry_sets` row per real set with its own weight, reps, and RPE. Selecting a movement prefills the most recent matching set pattern; adding a set copies the previous load/reps and leaves RPE blank. Legacy single-row aggregate entries remain readable and analytics distinguish them from newer multi-row set data.

Home/Gym selection is saved on `sessions.training_location_id` and remembered locally for the next workout entry. History details show the saved location. The workout movement picker filters enabled exercises using the selected person's `person_exercises.location_scope`: Home, Gym, or Both.

Climbing:

- Type: `Climbing`
- Movements: `Bouldering Session`, `Ropes/Belay`, `Kilter`, `Mix`
- Field label: `Boulders/Routes`
- Intensity is included
- Gradient appears and saves only for `Kilter`
- Climbing saves normalise metric rows before inserting `entry_metrics` because Supabase/PostgREST batch inserts require consistent object keys. Blank optional metrics are filtered out. If a detail insert fails after the session is created, the app deletes the partially created session so future duplicate checks are not blocked by half-saved data.
- Normal workout saves should use the same cleanup behavior after creating the session: if entry, set, or metric inserts fail, delete the partially created session.
- The Log screen movement picker respects both `person_exercises.is_enabled` and `person_exercises.location_scope` for the current person and filters immediately after Home or Gym is selected.

Flexible metric profiles:

- Weighted/reps movements use sets/reps/weight as appropriate.
- Carries use rounds/distance/time/load.
- Static holds and grip hangs use attempts/hold/feel/progression or grip style.
- Mobility/Flexibility positions use Distance (cm), Hold (sec), Feel (1-5).
- Time-based Run/Class/Other movements use minutes/distance/feel, with Class also showing Intensity.
- Conditioning includes former power movements and uses movement-appropriate fields.

Recent workout summaries should show logged weight with `kg` so a bare number is not ambiguous.

Dashboard same-week workout detail should display entered set count from `entry_sets.set_number`, not the number of aggregate `entry_sets` rows.

### Library

The library reads from Supabase. It supports:

- master movement list
- add/edit/hide movements
- a type-first new movement dialog with fields/defaults that adapt to the selected type and mirror the logging screen profiles
- per-person enable/disable selections
- per-person Home, Gym, or Both availability, editable inline on each movement
- an All/Home/Gym library filter that includes Both movements in either location view
- exercise history/details
- a `Show inactive` toggle for admin review of hidden/retired movements

History tiles in the library were made visually distinct from exercise tiles.

### Goals

Goals read/write Supabase. The Goals tab has a lightweight checklist flow:

- mark goal off for today
- show recent check-ins
- remove mistaken check-ins

Check-ins are stored in `goal_checkins`.

### Progress

The top-level Progress workspace is designed to be especially useful on larger screens while retaining a stacked mobile layout. It includes:

- a searchable exercise selector that starts with Bench Press when available
- exercise choices filtered by the selected All/Home/Gym view using per-person location availability
- 4, 8, 12, and 26-week plus all-time periods
- All, Home, and Gym location filters
- session count, top working weight, best estimated 1RM, and average weekly volume summaries
- comparisons against the previous equivalent period
- separate aligned performance and weekly-volume charts so unlike units are not mixed on one axis
- a cautious recovery/progression signal based on performance and volume changes
- exact recent set history, with older single-row aggregate logs explicitly labelled as totals

Exercise history now groups by session rather than only by date and retains each set's weight, reps, RPE, completion state, and saved training location. This enriched history remains shared with the Library exercise detail view.

### Plan

The top-level Plan workspace builds an editable next-workout draft from recent completed Workout Log history:

- Home and Gym are analysed separately when explicit location history exists.
- Movements excluded from the selected location in the Library are also excluded from suggestions.
- If the selected location has no labelled history yet, the app clearly falls back to older locationless logs instead of pretending those sessions are known to be Home or Gym.
- Legacy separate movement sessions are grouped back into training days so older history can still form a workout pattern.
- If the last three matching training days clearly resemble an A/B/A rotation, the planner suggests the B pattern next; otherwise it repeats the most recent matching training day.
- `Based on` keeps that automatic recommendation as the default but also lets the user choose one of the six most recent matching Home/Gym training days. The choices show their date and movements, scroll horizontally on mobile, and form a compact grid on larger screens.
- Choosing a historical day rebuilds the suggestion from that day while retaining the same readiness and progression rules; switching Home/Gym resets the choice to Recommended.
- `Normal`, `Fresh`, and `Tired` readiness options recalculate every movement.
- Below 5 reps, weighted work keeps the load and adds one rep per set up to 5.
- Comfortable 5+ rep sets require a logged RPE of 8 or below before `Normal` moves load up 2.5 kg and resets the target to 3 reps. `Fresh` allows that small move without the RPE confirmation; `Tired` removes one set and reduces load by about 10%.
- Every movement shows the source date and a plain-language reason. Suggested sets remain editable and movements can be removed.
- `Save for later` persists the editable plan to Supabase. One current Home plan and one current Gym plan can coexist; saving a newer plan archives the older current plan for that location.
- `Start this workout` persists the plan as accepted, then opens the workout logger with location, movements, and sets prefilled through a short-lived browser handoff.
- The workout logger shows saved plans in a `Next workout` area with Load and Skip actions. Loading keeps every target editable.
- Saving a workout that came from a plan marks the plan completed and links it to the newly created session through `completed_session_id`.

### History

Top-level History tab includes:

- Week / Month / Quarter controls
- previous/next period navigation
- filters for All, Workouts, Climb, 1RM, Bodyweight
- summary tiles
- entries grouped by date
- click/tap detail dialog
- delete from the detail dialog for session-backed workout/climb entries, including Strength Block Builder sessions

History workout counts should also count same-day workout exercises as one workout in the summary.

History detail notes combine movement-level and session-level notes, but exact duplicate note text should be shown once. Single-exercise logs currently save the same note to both places, so the timeline mapper dedupes before rendering the detail dialog.

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
- `src/lib/supabase-plans.browser.ts`: save/load/status/completion helpers for persistent workout plans.
- `src/lib/workout-plan.ts`: transparent history grouping, pattern detection, progression rules, and plan-draft validation.
- `src/lib/supabase-library.browser.ts`: library and person exercise selection data functions.
- `src/lib/supabase-goals.browser.ts`: goals and check-ins data functions.
- `src/lib/supabase-history.browser.ts`: exercise-specific history for library detail.
- `src/lib/supabase-timeline.browser.ts`: combined History tab data.
- `src/routes/index.tsx`: startup redirect from `/` to `/log`.
- `src/routes/dashboard.tsx`: dashboard route at `/dashboard`.
- `src/routes/log.tsx`: log screen route.
- `src/routes/plan.tsx`: next-workout planner, readiness choices, and editable suggested sets.
- `src/routes/progress.tsx`: exercise-specific progress analysis, charts, period/location filters, and set history.
- `src/routes/-workout-form.tsx`: shared workout/climbing log form and metric-field UI.
- `src/routes/library.tsx`: library route.
- `src/routes/goals.tsx`: goals route.
- `src/routes/history.tsx`: history route.
- `src/routes/__root.tsx`: root route and app metadata.
- `src/routeTree.gen.ts`: generated TanStack route tree; builds update it automatically.
- `public/favicon.ico`, `public/apple-touch-icon.png`, `public/app-icon-192.png`, `public/app-icon-512.png`, `public/manifest.webmanifest`: browser and mobile home-screen icon files. Current icon is the dark rounded-square flame inside a colourful ring. Keep these local rather than relying on Lovable-hosted `__l5e` asset URLs.
- `vite.config.ts`: Lovable/TanStack Vite config.
- `package.json`: scripts and dependencies.
- `supabase/schema.sql`: schema/policy snapshot.
- `supabase/migrations/20260713100036_add_training_locations.sql`: applied and tracked training-location migration.
- `supabase/migrations/20260713105054_add_exercise_location_scope.sql`: applied and tracked per-person Home/Gym/Both exercise availability.
- `supabase/migrations/20260713110640_add_persistent_workout_suggestions.sql`: applied and tracked persistent workout plan entries/sets, session link, indexes, grants, and RLS.
- `docs/product-roadmap.md`: staged product redesign roadmap; the active phase is the unified workout logger.
- `supabase/approved_logging_library_updates.sql`: reusable SQL for approved data-library changes.
- `workout_context.md`: this handoff file; keep it current.

## Build And Verification

Standard build:

```bash
npm run build
```

Type check:

```bash
npx tsc --noEmit
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

Recent commits before/around this checkpoint:

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

- Lovable preview can lag behind GitHub. Use the build label to confirm the preview build. The label prefers commit metadata when the build environment exposes it, then falls back to a build timestamp rather than `local`.
- Lovable cache clearing can use tokens.
- Lovable auto-fixes can remove intentional wiring. In particular, keep `Toaster` mounted in `src/routes/__root.tsx` so success/error messages render.
- Do not add service-role keys to Lovable/browser code.
- `docs/supabase-import-status.md` has old migration notes and says some screens were still spreadsheet-backed; current app state is more advanced.
- `Stretching`, `Sport`, and `Bouldering` activity type rows still exist in the database for legacy/history reasons, but app options filter out empty/retired categories.
- `person_exercises` row count can lag master `exercises` count; the library can still display master exercises, and per-person enable rows can be added as needed.
- When changing library data directly in Supabase, also update `supabase/approved_logging_library_updates.sql` or another tracked SQL file so the change is reproducible.

## Future Stage: People And Access Admin

Before opening the app to friends or clients, build an admin-only `People & Access` screen. This should make user setup safe and non-manual, replacing direct database edits for routine access management.

Purpose:

- Keep public signup disabled while still allowing invite-only use.
- Let Noam create and manage people from the app.
- Link a Supabase Auth user to a `people` row.
- Choose which app profile a person should use.
- Select/deselect exercises for that person from the master library.
- Prepare for assigning programs or suggested workouts later.

Suggested screen capabilities:

- List people with status, linked/unlinked auth state, app profile, and admin/coach relationship.
- Add a new person with display name, email, status, and notes.
- Link an existing Supabase Auth user ID or invited email to a person.
- Assign one or more `app_profiles`, with one default profile.
- Create or update `admin_people` rows so Noam can manage that person.
- Bulk enable a sensible starting exercise set for the person.
- Toggle individual `person_exercises` rows on/off.
- Show whether the person has recent logs/goals/bodyweight data before archiving.
- Archive/deactivate a person without deleting their history.

Tables involved:

- `people`: person identity, auth link, status, notes.
- `admin_people`: Noam/admin-to-managed-person relationship.
- `app_profiles`: available app experiences such as full admin, simple logger, runs/classes.
- `person_app_profiles`: app profile assignments per person.
- `exercises`: master library.
- `person_exercises`: per-person library visibility/selection.
- Programme templates now exist in `programs`, `program_workouts`, and `program_workout_entries`; future People & Access work can add `program_assignments`, `program_assignment_exercises`, and `suggested_workouts`.

Permission and safety notes:

- Only an approved admin should be able to access this screen.
- Users should not be able to manage the master library or other people unless they are explicitly admin/coach.
- Keep the current admin app gate strict: signed-in account must be linked to `people` and have an `admin_people` row.
- Do not rely on user-editable auth metadata for permissions.
- Avoid deleting people with history. Prefer `status = 'inactive'` or `status = 'archived'`.
- If opening to clients/friends, verify RLS policies so normal users can see only their own data and Noam can see/manage only people linked through `admin_people`.

Possible first implementation:

1. Add a new top-level `People` or `Access` nav item visible only to admin.
2. Build read-only list/detail first.
3. Add create/edit person.
4. Add app profile assignment.
5. Add exercise selection.
6. Add program/suggested workout assignment later.

## Suggested Next Steps

Recommended next work, in order:

1. Push any local commits via GitHub Desktop if the branch is ahead of remote.
2. In Lovable preview, confirm the commit label matches the latest pushed commit.
3. Confirm app startup opens the unified workout logger and the Dashboard nav still opens `/dashboard`.
4. Set a few Library movements to Home-only and Gym-only, then confirm the workout movement list filters correctly while Both appears in both lists.
5. Test Log flows for Strength, Run, Class, Mobility/Flexibility, Grip, Climbing, 1RM, and Bodyweight.
6. Test the duplicate-log warning by trying to save the same movement twice on the same date.
7. Test a one-movement save plus Home and Gym multi-movement saves from the deployed authenticated app, including mixed-weight sets, and confirm the location appears in History.
8. Test Progress for Bench Press across multiple periods and Home/Gym, including the new mixed-weight workout.
9. Test Plan for Gym Normal/Tired with both `Save for later` and `Start this workout`; confirm the Next Workout card, location, exact set targets, Skip action, and completed-session link.
10. Log enough explicit Home/Gym full workouts to replace the planner's locationless-history fallback with trustworthy location-specific patterns.
11. Implement recoverable autosaved workout drafts from Phase 1.2 of `docs/product-roadmap.md`.
12. Test Library `Show inactive`, especially hidden items such as `Rice Bucket` and old climbing entries.
13. Confirm `Pull-Up`, `Lat Pulldown`, and `Chin-Up` appear separately in the Library and Log movement selector.
14. Decide whether new master exercises should automatically create `person_exercises` rows for Noam, or whether the app should treat missing rows as enabled by default.
15. Build a simple admin-only user management flow before inviting friends: create person, link auth user, select app profile, select/deselect exercises.
16. Tighten the profile-claim bootstrap now that Noam's account is linked.
17. Start implementing programme assignment and suggested workout UI on top of the seeded Percentage Strength Blocks.
18. Consider generating and saving TypeScript types from Supabase once schema/data shape stabilizes.
19. Keep simplifying future custom app ideas around app profiles rather than duplicating data.

## Future Stage: iPhone App

The current mobile home-screen version is a web app/PWA-like experience. The `Build: local` label seen on mobile bookmarks means the deployed runtime is not receiving build metadata; it does not mean the phone is running local code.

Possible iPhone directions:

- Polish the current web/home-screen app first: icon, manifest, mobile layout, loading/error states, and cache behaviour.
- If Noam wants a real installable iPhone app without rebuilding the UI, use Capacitor to wrap the existing web app and distribute privately through TestFlight. This should preserve the Supabase backend and most app code.
- A full native rebuild in SwiftUI or React Native is possible later, but is much more work and should wait until the product shape is stable.

Best future option if needed: Capacitor wrapper after the web app is stable.
