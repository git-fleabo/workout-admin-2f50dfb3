# Workout App Context

Last updated: 2026-07-22

This file is the handoff document for the Training Tracker workout app. A new chat or bot should be able to read this file first and understand the current product direction, local repo, Supabase project, Lovable/GitHub workflow, schema, key files, and sensible next steps.

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
- `supabase/migrations/20260714150600_add_daily_rotation.sql`: configurable daily-practice pool, persisted per-date assignments, completion state, RLS, grants, and indexes.
- `supabase/migrations/20260716072606_add_structured_goals.sql`: applied additive structured-goal fields for goal type, linked exercise, canonical measurement, numeric target/unit, starting value, and deadline.
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

Rows: 73 active in the live library as of 2026-07-22

Key columns:

- `id uuid primary key`
- `activity_type_id uuid -> activity_types.id nullable`
- `name text`
- `focus_area text nullable`
- `equipment text nullable`
- `default_metric text nullable`
- `suggested_sets text nullable`
- `suggested_reps text nullable`
- `circuit_suitability text` (`preferred`, `available`, or `excluded`)
- `circuit_pattern text`
- `circuit_difficulty text` and `circuit_impact text`
- `circuit_dose_mode text`, `circuit_dose_min numeric`, `circuit_dose_max numeric`
- `circuit_dose_per_side boolean`
- `notes text nullable`
- `is_active boolean`
- `source_sheet text nullable`
- `source_row integer nullable`
- timestamps

Important active library decisions:

- `default_metric` now stores one of eleven stable tracking keys rather than free text: `weight_reps`, `reps_only`, `hold`, `grip_hold`, `distance_time`, `duration`, `conditioning`, `carry`, `mobility_position`, `power`, or `climbing`. The Library editor exposes these as labelled dropdown choices and changes its contextual defaults accordingly.
- The unified logger treats the selected tracking mode as authoritative. It exposes mode-specific fields for standard sets, reps with progression/assistance, holds, loaded grip, distance/time with units, duration-only work, conditioning, carries, mobility positions, power/jumps, and climbing. Non-strength metrics now survive recent-workout repeat/correction round trips.
- Unified climbing entries use whole `duration_minutes` as their canonical time metric. The form labels the unit explicitly, gives the `1h 15m = 75` conversion example, rejects missing/non-integer values and values above 720 minutes, and requires a positive problems/routes count when that tracking mode is selected. Persistence repeats the validation so drafts or other callers cannot bypass it. Legacy `hours` rows remain read-compatible but new saves do not dual-write hours.
- Hold and loaded-grip movements use the individual-set editor: every attempt stores its own `entry_sets.duration_seconds`, optional load, RPE, progression, and assistance/load-type metadata. The multi-movement save payload must preserve these set rows (not collapse them into the aggregate fallback). Recent-workout copies preserve separate hold rows, while older single-row records with an aggregate set count remain readable as repeated equal-duration attempts.
- Mobility/flexibility `feel` is an integer 1-5: 1 means restricted, 3 normal, and 5 free and comfortable. Pain is not part of the score and should stop the movement. The logger enforces the numeric range, and Progress repeats the same interpretation.
- Workout review, History timeline, session detail, and Progress exact history describe duration-based work as attempts, calculate total and best hold time correctly for both individual and legacy aggregate rows, and retain assistance such as a Front Lever counterweight.
- The workout review summary parses hold inputs with the same numeric-prefix rule as persistence, so a value such as `7.5s` is counted rather than silently discarded by strict JavaScript number conversion. Hold inputs are numeric going forward, and review shows the per-attempt addition before the total.
- Progress resolves the exercise tracking profile before choosing its analysis. Hold/isometric and loaded-grip exercises show best-set seconds, accumulated weekly hold seconds, and exact duration-per-set history instead of estimated 1RM and load-volume charts. Strength exercises retain their existing load, estimated-strength, and kg-volume view.
- Progress now has a complete profile-to-analysis map. Reps-only movements show best-set and weekly reps with RPE; distance/time work shows pace and normalized distance; duration and conditioning show time, rounds, and density; carries show load/distance trade-offs; mobility positions show distance, hold, and feel without assuming which direction is better; power shows height, jump volume, and effort; climbing shows minutes, problems/routes, RPE, and the latest grade as a label rather than forcing unlike grading systems onto one numeric scale.
- `getExerciseHistoryClient` is the shared aggregation boundary for these views. It reads nested `entry_sets` and `entry_metrics`, normalizes m/yd/km to kilometres for comparable distance charts, accepts legacy climbing `hours`, preserves raw mobility units for display, and keeps all profile-specific charts on one session-point model.

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

- climbing metrics such as canonical `duration_minutes`, `tracking_mode`, `boulders`, `grade`, and Kilter-only `gradient`; legacy rows may use `hours`
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
- `goal_type text`, one of `legacy`, `consistency`, `performance`, `duration`, `milestone`
- `exercise_id uuid -> exercises.id nullable`
- `tracking_mode text nullable`
- `goal_metric text nullable`, a stable measurement key such as `sessions`, `max_weight`, `hold_seconds`, or `distance_km`
- `target_value numeric nullable`
- `target_unit text nullable`
- `starting_value numeric nullable`
- `deadline date nullable`
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

`suggested_workout_entries` stores ordered movement names, workout types, source dates, plain-language
progression reasons, a canonical `tracking_mode`, and a structured `target_metrics` object for
movement-level duration, distance/unit, rounds, height, and detail. `suggested_workout_sets` stores
ordered reps, weight, per-set `duration_seconds`, RPE, and completion targets for each entry. Existing
plans without the newer fields remain readable through tracking-mode inference and empty-target
defaults.

`suggested_workout_method_blocks` stores an ordered exercise-group or timed/density method snapshot for
a plan, including rounds, rest, duration, intervals, and structured configuration.
`suggested_workout_method_block_entries` links each block to its planned movements in sequence. The
method rows stay separate from the ordinary set targets so planned volume remains attributable to the
underlying exercises.

RLS:

- Authenticated SELECT/INSERT/UPDATE/DELETE policies use `app_private.person_is_accessible` directly on the plan and through the parent plan for entry/set rows.
- Planned method blocks and memberships allow authenticated SELECT/INSERT only. Their policies require
  an accessible parent plan, a method definition with the matching family/person, and member entries
  belonging to that same plan.
- A rollback-only authenticated test inserted and read one plan, entry, and set successfully after the 2026-07-13 migration.
- A live authenticated-role smoke test inserted and read a Superset with two ordered planned movements,
  confirmed update/delete are not granted, then deleted the parent plan and confirmed cascade cleanup.

Programme-template decision:

- The umbrella model is `Percentage Strength Blocks`.
- Seeded templates are `Operator Style Strength Block` and `Fighter Style Strength Block`.
- Operator is 3 sessions/week.
- Fighter is 2 sessions/week and better for clients who need more room for conditioning, sport, running, climbing, or other training.
- This extends the existing `programs`, `program_workouts`, `program_workout_entries`, and `program_assignments` model, with a new `program_assignment_exercises` table for slot-to-exercise mappings.
- No new app or database is being created.
- Programme assignment setup and opt-in session generation now use these tables. Merely assigning or
  ignoring a programme has no effect on Today, Plan, Log, or existing saved workouts.
- A live 2026-07-16 audit confirmed both seeded templates and their 30 workouts / 102 entries are
  present. Template read policies are active, and `program_assignment_exercises` has managed-person
  CRUD policies. Managed-person SELECT/INSERT/UPDATE/DELETE policies were added to
  `program_assignments` on 2026-07-16, resolving the live `rls_enabled_no_policy` advisor warning for
  that table. Insert/update additionally require the selected programme to be a protected template.

## App Behavior And Screens

### Manage

`/manage` is the administration landing page. The primary navigation stays focused on everyday
training and review, while Manage links to Exercise Library, Training Methods, Programme Templates,
Daily Rotation, Goals, and Training Locations. Those existing routes remain stable and make Manage
appear active while open. The landing page also reserves clearly non-interactive planned homes for
Preferences and People & Access; these placeholders do not imply that the features are implemented.

Daily actions remain close to the training flow: Today still shows and completes the selected daily
practice, while Manage owns its rotation configuration. Goals are configured in Manage, but future
quick check-ins can still surface in Today or review views.

`/locations` manages the existing person-owned `training_locations` rows. It can add places, rename
them, and archive or restore them. Archiving is non-destructive: inactive locations disappear from new
workout selection while completed sessions retain their location relationship and name. `Home` and
`Gym` remain the two core planning contexts, so the UI protects the last active location of each kind
from archival and keeps an existing core location's kind stable. `Other` locations are available in
the unified logger without applying Home/Gym exercise filtering. The page uses the table's existing
managed-person RLS policies and requires no schema change.

`/programmes` reads the protected template rows from `programs`, `program_workouts`, and
`program_workout_entries`, lets the user compare Operator and Fighter cadence, and exposes an
expandable week-by-week prescription. Its assignment wizard selects a managed person, start date and
initial status, then maps every programme slot to a distinct enabled Library movement with its training
max. Active and paused assignments appear above the template browser and can be paused, resumed, or
archived. Templates remain read only. Pausing or archiving also archives any uncompleted linked
programme suggestion so it no longer appears as Ready.

Programme methodologies are dispatched through `programs.method_type`. Shared programme structure,
assignment lifecycle, and slot mappings remain methodology-neutral; `src/lib/programme-methods.ts`
currently registers the Percentage Strength assignment fields and prescription builder. It calculates
working weights from the assignment training max and template intensity, rounds to the configured
increment, and uses the template's minimum/maximum set choice. A future methodology should add a
registry entry and its method-specific setup/prescription renderer, using additive configuration only
when the existing generic set, rep, load, duration, RPE, rest, and notes fields are insufficient.

### Dashboard

The dashboard reads from Supabase and shows weekly training, climbing, strength, monthly summaries, recent PRs, and long-term trend data.

Workout counts should count distinct workout days, not individual exercise rows. Logging multiple exercises on the same day should still count as one workout in summary stats.

Dashboard workout counts/details should include any completed non-climbing session with completed entries, regardless of `source_sheet`. This keeps manually sent Strength Block Builder sessions visible in the dashboard when they already appear in History.

Clicking a day in the Dashboard `This Week` calendar opens a compact activity review whose fields follow each movement's Library tracking profile and recorded metrics. Weighted work shows sets, total reps, top load, and volume; reps-only work omits load; holds show attempts and hold times; duration, distance/time, conditioning, carries, mobility, power, and climbing each use their own relevant labels. The day total counts a session-level duration once rather than repeating it for every movement, and falls back to recorded entry durations when the session has no total.

The dashboard should remain focused. Weekly workout and weekly active-minute goals should stay visible. Do not reintroduce a bulky active-goals panel without a fresh decision.

The dashboard has a manual refresh button. Use this to force a fresh Supabase read without needing a browser hard refresh.

Dashboard links to a dedicated `/weekly-review` route without adding another permanent navigation
tab. The review treats Monday through Sunday as a week and, for the current week, compares only the
same elapsed days from the previous week. It summarizes completed sessions, active days, minutes,
exact segment-aware strength kg-volume, plan/programme adherence, activity and location mix, PRs, RPE
coverage, and cautiously worded recovery signals. It always produces three evidence-labelled next
actions. Historical weeks use the full seven-day span. The feature is read only and uses existing
sessions, entry sets and set segments, suggested workouts, programme links, locations, and PR data;
it does not introduce a new score, schema, or persistence model.

Dashboard presentation now uses three semantic accent families: primary lime for general training
and trends, amber for climbing/minutes/PR context, and rose for strength. Weekly workout and minute
goals use compact progress rings, the weekly snapshot uses a thicker labelled gradient bar, calendar
days use credited/climbing/rest dots with future days faded, monthly workout counts include relative
mini bars, and recent PR values render as compact pills.

### Log

The log screen supports:

- workout entries
- climbing entries from the dedicated `Climb` mode
- 1RM tests
- bodyweight logs

Climbing now has a dedicated `Climb` mode alongside Workout, 1RM, and PRs. It deliberately bypasses
the workout composer: there is no Home/Gym choice, set editor, movement ordering, advanced-method
section, completion toggle, or review dialog. The compact form uses four direct choices
(`Bouldering`, `Ropes`, `Kilter`, and `Mix`), friendly hours/minutes inputs, an optional
movement-aware problems/routes count, optional max grade and RPE, Kilter-only gradient, and collapsed
date/notes. A blank count saves `Time only`; entering a count saves `Problems / routes`. The screen
still writes through `addWorkoutSessionClient`, so it keeps canonical `duration_minutes` and the same
session/entry/metric contract consumed by Dashboard, History, Progress, and Goals. Climbing movements
and climb-only recent sessions are excluded from the Workout composer so they cannot accidentally
pick up workout sets or advanced methods.

1RM logging uses Epley as the fixed/default estimate formula. The formula selector is intentionally hidden from the UI, but new rows still save `formula = 'Epley'` in `one_rm_tests`.

Legacy quick-log aggregate `Reps` mean total reps across all sets. Calculations that need reps per set use `ceil(total reps / sets)` for those historical single-row entries. New unified-logger entries store each set separately, so estimated 1RM, total reps, and mixed-load volume use the exact set rows.

Recent workout summaries on the log screen should display sets and reps as separate labels, for example `3 sets · 12 total reps`, because reps are total reps across all sets rather than reps per set.

The PR tab groups calisthenics/skill PRs by normalized skill name. For each skill, it should show at most one best hold and one best reps item, with progression and assistance details inside the same skill card rather than repeated cards such as multiple `Front Lever` or `Pistol Squat` rows caused by progression, assistance, casing, spacing, or punctuation differences.

Live Supabase library and logs were standardized on `Pistol Squat` instead of `Pistol Squats`.

Successful logs should show confirmation messages. Delete confirmations should use app dialogs, not browser-native popups.

After a workout/climb is saved, the Log form clears all fields back to a fresh blank state.

Before saving a workout or climb, the app checks for an existing same-date, same-movement entry in Supabase. If one exists, it shows an app dialog asking whether to save another anyway.

The Log tab now has one workout-session composer rather than separate `Quick log` and `Full workout` modes. It starts with one blank movement, so a one-movement entry is simply a workout with one movement. It begins with Home/Gym context, keeps session date/name/duration/intensity/RPE/notes inside an optional collapsed section, and uses a searchable movement picker without a separate type selection.

Meaningful workout edits are autosaved immediately to a versioned local browser draft scoped to the signed-in account. Refreshing, navigating away, or reopening the app restores the unfinished form, including its movements, sets, session details, location, and any link to a saved suggested workout. A newly started plan intentionally replaces an older local draft. The form shows the last autosave time and a prominent `Cancel workout` action beside the finish workflow; Today also offers `Cancel draft` next to Resume. Both routes use the same confirmation copy and clear only the local unfinished draft, never a completed workout. A successful Supabase session insert clears the local draft immediately; drafts themselves do not create partial database rows.

For standard set/reps movements, the unified logger records one `entry_sets` row per real set with its own weight, reps, and RPE. Selecting a movement now starts with a clean set and shows the most recent matching workout immediately above the editor, preferring history from the selected Home/Gym context when available. `Copy previous workout` copies that full set pattern, `Repeat last set` adds the current load/reps with blank RPE, and `Add blank set` adds an empty row. Weight and reps use larger mobile touch targets, while optional movement notes are collapsed. Legacy single-row aggregate entries remain readable and analytics distinguish them from newer multi-row set data.

Movement selection is grouped into account-scoped local favourites, recent movements for the chosen Home/Gym context, and the remaining filtered library. The star beside a selected movement toggles its favourite status. Movement cards can be moved up or down and the reordered entry array is preserved by draft autosave. `Repeat a recent workout` groups existing recent entries by session, prefers the chosen location, and loads the full movement order and targets into today's draft; replacing a meaningful draft requires confirmation. These features reuse existing Supabase history and do not add schema or RLS changes.

Finishing a workout is now a two-step action. `Review and finish` opens a summary of location, movement count, recorded sets, and each movement's work before the final Supabase write. A successfully completed workout stores an account-scoped local same-day pointer plus its form snapshot, so the Log screen can show `Today's workout is saved` after navigation or refresh and reopen it for correction. Corrections create the replacement session first, remove the original only after the replacement succeeds, and relink any completed suggested workout; if replacement or original deletion fails, the original remains intact. Correction state is also included in draft autosave so a refresh cannot accidentally turn an edit into a duplicate new session.

Home/Gym selection is saved on `sessions.training_location_id` and remembered locally for the next workout entry. History details show the saved location. The workout movement picker filters enabled exercises using the selected person's `person_exercises.location_scope`: Home, Gym, or Both.

### Today

The app now starts at `/`, which is a compact Today launch screen rather than redirecting straight to Log. Today prioritises an account-scoped unfinished draft, then shows saved Next Workouts, the latest completed Home and Gym sessions, an empty-workout action, and a link to Progress. Starting a saved plan accepts it and hands the editable targets to the unified logger. Repeating a recent session uses a short-lived local session ID so the logger can rebuild the full existing session template without flattening non-standard exercise fields. If a draft exists, Today protects it and asks the user to resume or discard it before starting another workout. A same-day completed snapshot links back to the existing review/edit flow in Log.

When no saved Next Workout exists, Today builds a normal-readiness Home or Gym recommendation with the same transparent history and progression rules as Plan. It filters movements by their Library location availability, uses explicit location history where available, explains any locationless-history fallback, shows the source pattern and each movement's proposed target/reason, and lets the user either start immediately or carry the selected location into Plan for readiness, basis, movement, and set editing. Starting immediately saves the recommendation as an accepted suggested workout before loading the unified logger, so normal completion linking remains intact.

Today also has a separate `Daily practice` card for small movements that should rotate independently of the main workout. `/rotation` manages the pool. Each item has a name, free-text daily target, cue, relative selection weight from 1–5, eligible weekdays, minimum repeat gap from 0–30 days, and active/paused state. The app makes a deterministic weighted pick from eligible items and persists one assignment per person/date, so refreshing does not change the movement. If every item is inside its repeat gap, it falls back to the eligible weekday pool rather than leaving the day empty. The Today card can mark the assignment done or undo it; completion does not create a workout session or affect training history.

An active programme adds a separate `Programme session` card to Today. This card is explicitly
optional and does not replace or suppress saved Next Workouts, recommendations, recent-workout repeat,
or empty logging. It previews the exact rounded sets/reps/load and only creates an accepted
`suggested_workout` after `Start programme session` is pressed. Home/Gym choices are limited to a
location shared by every mapped Library movement. Programme suggestions are deduplicated independently
from normal location-based plans, and creating a programme suggestion never archives another plan.
Programme setup only offers enabled Strength movements. Main Lift 1 is required for both Percentage
Strength templates; every later lift is optional, so an assignment can generate single-lift sessions.
Mapped optional lifts remain part of the prescription, while omitted optional lifts are skipped.
The unified logger remains fully editable. On successful completion,
`complete_suggested_workout(uuid, uuid)` atomically links the completed session and advances
`program_assignments.current_workout_index`; the final session marks the assignment complete. The RPC
is security-invoker, uses existing managed-person RLS, validates that the completed session belongs to
the same person, rejects an out-of-order template workout, and is idempotent for the same session.

### Daily rotation

`daily_rotation_items` stores the person-owned configurable pool. `daily_rotation_assignments` stores the selected item and optional completion timestamp for a date, with a unique `(person_id, assigned_date)` constraint. Both tables have RLS enabled, authenticated CRUD grants, and managed-person policies for all four operations. Assignment insert/update policies also require the referenced item to belong to the same person. The live migration and policy/grant audit were completed on 2026-07-14. Supabase security advisors reported no new daily-rotation issue; unrelated existing advisor notices remain.

Climbing:

- Type: `Climbing`
- Movements: `Bouldering Session`, `Ropes/Belay`, `Kilter`, `Mix`
- Field label: `Boulders/Routes`
- Intensity is included
- Gradient appears and saves only for `Kilter`; stale gradient values are cleared when a different climbing movement is selected or repeated
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
- a circuit-status filter plus structured circuit metadata on every movement: Preferred/Available/
  Excluded suitability, primary pattern, difficulty, impact, default dose unit/range, and per-side dose

History tiles in the library were made visually distinct from exercise tiles.

Filtered Library views show their movement count. Movement cards use colour-coded type and focus
chips, while edit/delete controls stay visible on touch layouts and become hover/focus actions on
larger screens so the always-used location, enable, and history controls remain accessible.

Circuit metadata is stored directly on `exercises` so Library edits remain atomic with the movement
record and stable exercise identity. The 2026-07-22 migration seeds all existing rows conservatively:
aggregate sessions, classes, climbing sessions, and already-composed workouts are excluded; common
atomic circuit movements are preferred; all remaining atomic movements are available. The future
generator must filter by per-person enabled/location scope first, then use these structured fields for
balance and dosing instead of relying on free-text focus/equipment values or movement-name guesses.

### Goals

Goals read/write Supabase. The Goals tab has a lightweight checklist flow:

- active, paused, completed, and archived status views
- current-week/month/quarter/year check-in counts and progress for consistency/general goals
- period grouping labelled This week, This month, This quarter, This year, and Long-term
- structured goal creation for consistency, performance, duration, and milestone goals
- exercise links whose measurement defaults follow the Library movement tracking profile
- direct links from exercise goals into the matching exercise on Progress
- automatic current-period progress for completed sessions, active days, and active minutes
- automatic exercise-history progress for top load, estimated 1RM, reps, hold time, duration,
  distance, rounds, height, and completed climbing problems
- best-performance dates and automatic/manual source labels on each progress card
- starting-value-aware progress bars for performance and duration goals
- an explicit Mark complete action when measured progress reaches the target; goal status is never
  changed silently
- mark active goals off for today
- show recent check-ins
- remove mistaken check-ins
- archive or pause goals without deleting them permanently

Goal cards use their existing real Supabase-backed progress bars. Their icon treatment is also
period-aware: weekly goals use primary lime, monthly goals amber, quarter/year goals violet, and
long-term/static goals stay muted. Period headings remain human-readable and capitalized.

Check-ins are stored in `goal_checkins`.

Existing imported goals remain `goal_type = 'legacy'` and retain their original free-text
target/metric fields and manual check-in behavior. New structured goals also mirror their numeric
target and unit into the legacy `target` and `metric` columns so Dashboard weekly-workout/minute goal
parsing remains compatible.

Automatic consistency progress reads completed sessions that contain at least one completed entry.
Session minutes prefer the saved session duration, then entry duration metrics, then timed-set
seconds. Exercise goals reuse the same enriched exercise history as Progress and evaluate the best
matching single-session result inside the goal's current week/month/quarter/year, or across all
history for long-term goals. A configured starting value changes the progress-bar baseline but does
not replace the measured current value. Reaching a target exposes Mark complete but does not
silently update the goal lifecycle.

Migration `20260716072606_add_structured_goals` was applied to the shared Training Admin project on
2026-07-16 through a linked single-file SQL execution because the checkout's older migration history
does not align one-to-one with the live history. The exact migration version was then recorded as
applied. Verification confirmed all eight columns, four constraints, the partial exercise index,
five preserved active legacy goals, enabled RLS, and authenticated table grants. Database advisors
reported no new schema issue; the existing leaked-password-protection Auth warning remains.

### Progress

The top-level Progress workspace is designed to be especially useful on larger screens while retaining a stacked mobile layout. It includes:

- a searchable exercise selector that starts with Bench Press when available
- exercise choices limited to movements that occur in the signed-in profile's completed Workout Log history; stable exercise IDs are preferred and normalized names retain legacy name-only entries
- exercise choices filtered by the selected All/Home/Gym view using per-person location availability
- 4, 8, 12, and 26-week plus all-time periods
- All, Home, and Gym location filters
- session count, top working weight, best estimated 1RM, and average weekly volume summaries
- comparisons against the previous equivalent period
- separate aligned performance and weekly-volume charts so unlike units are not mixed on one axis
- a cautious recovery/progression signal based on performance and volume changes
- exact recent set history, with older single-row aggregate logs explicitly labelled as totals
- a mobile-first next-decision card before the charts, with exact supporting evidence
- planned-versus-actual cards for completed suggested workouts linked through `completed_session_id`
- full-workout drill-down from chart points, exact-history rows, and linked plan comparisons

Exercise history now groups by session rather than only by date and retains each set's weight, reps, RPE, completion state, and saved training location. This enriched history remains shared with the Library exercise detail view.

The Progress decision layer is deliberately cautious and follows Noam's five-rep progression preference. Latest working sets below 5 reps recommend keeping the load and building reps. Sets at 5+ recommend progressing only when every comparable working set also has RPE 8 or below; high effort or missing RPE recommends holding the load. Lower period performance combined with at least 10% more weekly volume, or repeated RPE 9+ sessions alongside a recent performance decline, recommends considering lighter work. Non-weighted or sparse histories remain baseline/continue messages rather than receiving invented load advice. Every result shows the latest set evidence, latest effort evidence, and available period comparison.

Plan-versus-actual comparisons read only completed `suggested_workouts` with a non-null `completed_session_id`, then pair the selected exercise's `suggested_workout_sets` with the linked session's real `entry_sets`. They classify prescribed work as `met`, `exceeded`, `partial`, or `missed`, show the exact planned and actual sets, and calculate weighted-volume variance when both sides have load and reps. Exercise ID is preferred when present, with normalized name matching retained because current suggested entries can be name-only. The Progress period and Home/Gym controls also filter these comparisons. As of 2026-07-13 there are no completed linked suggestions yet, so the authenticated app correctly shows an explanatory empty state until the first recommendation is started and finished.

Selecting a performance-chart point, exact-history row, or linked plan comparison opens the same responsive session-detail dialog. The detail query is scoped to the signed-in person's `person_id` before returning session metadata, every movement, exact sets, saved metrics, and notes. This keeps the user in the Progress decision workspace while exposing the original evidence. The authenticated local preview was verified against the 13 July Bench Press session, including its Deadlift and Stretch Session entries.

### Plan

The top-level Plan workspace builds an editable next-workout draft either from recent completed
Workout Log history or from the movement Library's Circuit Builder:

- A `Next 7 days` overview sits above the workout builder. On mobile it is a horizontally scrollable day strip; on larger screens all seven days align in one row.
- Expected Home and Gym weekdays come only from distinct, explicitly location-labelled training days in the previous eight weeks. The UI shows the number of source days and low/medium/high confidence; it does not assign a Home cadence when no Home-labelled history exists.
- Separate Home and Gym cards show the next learned repeat or alternating rotation and its movement list. Their action scrolls directly to the existing editable workout builder with the chosen location selected.
- The weekly cards reuse the normal next-workout suggestion, so `Due to progress` appears only when the same five-rep plus comfortable-RPE rule would increase load. `Watch fatigue` appears only after at least two of the latest three matching exercise logs record RPE 9+.
- Authenticated preview verification on 2026-07-13 showed the completed Gym workout on Today, one expected Gym day with low confidence from one labelled source day, no invented Home cadence, and working Home/Gym card actions that switch the editable builder's location.
- A separate profile-scoped session read classifies non-strength load as Climbing, Running, Class, Sport/conditioning, or Recovery/mobility. Mixed sessions containing strength work are not misclassified as recovery merely because they also contain stretching or mobility.
- Other-load patterns use distinct dates from the previous eight weeks. At least two source days are required before an activity is automatically placed into the coming week; a one-off remains visible as `not scheduled`.
- Each day has an `Adjust` dialog for Home, Gym, climbing, running, class, sport/conditioning, and recovery. Adjustments are saved in local storage using the signed-in auth user ID plus seven-day start date, and `Use inferred day` removes the override. Completed items remain separate and cannot be rewritten by planning.
- Authenticated verification found Climbing and Recovery at two inferred days per week with high confidence, while the single Class and Sport/conditioning records stayed unscheduled. A Friday Run + Class adjustment survived reload and was then reset to the inferred open day.
- A `Recovery decision` card combines the last 14 days of strength and other training load with the preceding 14 days, counts distinct RPE 9+ days, detects a latest high-effort estimated-performance drop of at least 5% against the prior two comparable exercise dates, and checks the editable coming week for a load spike. It always shows the exact evidence rather than hiding the rules behind a score.
- A single warning can set only the next workout to `Tired`. Stronger repeated-hard-week evidence can apply a full account/week-local deload mode, which keeps the planned training days but gives every strength suggestion one fewer set and about 10% less load until the user returns to normal.
- The authenticated local preview showed `No deload signal yet`: 15.3 recent load points versus 14 previously, no RPE 9+ days, no exercise-level decline, and only 8% RPE coverage. Its `Use lighter next workout` action correctly selected the Tired targets without changing workout history.
- Home and Gym are analysed separately when explicit location history exists.
- Movements excluded from the selected location in the Library are also excluded from suggestions.
- If the selected location has no labelled history yet, the app clearly falls back to older locationless logs instead of pretending those sessions are known to be Home or Gym.
- Legacy separate movement sessions are grouped back into training days so older history can still form a workout pattern.
- If the last three matching training days clearly resemble an A/B/A rotation, the planner suggests the B pattern next; otherwise it repeats the most recent matching training day.
- `Based on` keeps that automatic recommendation as the default but also lets the user choose one of the six most recent matching Home/Gym training days. The choices show their date and movements, scroll horizontally on mobile, and form a compact grid on larger screens.
- Choosing a historical day rebuilds the suggestion from that day while retaining the same readiness and progression rules; switching Home/Gym resets the choice to Recommended.
- `Normal`, `Fresh`, and `Tired` readiness options recalculate every movement.
- The builder can switch between `From history` and `Circuit Builder` without creating a separate
  workout type or persistence flow.
- Circuit Builder asks for 10-45 minutes, Home/Gym, readiness, balanced/upper/lower/core/
  conditioning/mobility focus, gentle/moderate/hard intensity, mixed/rep-led/time-led format,
  available equipment, high-impact/advanced exclusions, and named movements to avoid.
- Circuit generation is deterministic for the same brief and Library state. It filters per-person
  enabled movements by Library location first, then applies structured suitability, dose mode,
  difficulty, impact, equipment, and exclusions. Free-text equipment is normalised only for
  eligibility; selection and dose do not infer suitability from movement names.
- The generator favours preferred movements and the requested focus while penalising repeated
  movement patterns. It calculates a movement count, per-movement dose, rounds, rest between
  movements, rest between rounds, and an estimated total duration, with warnings when the available
  catalogue cannot closely fill the requested time.
- Every generated movement shows its reps, seconds, metres, or rounds and a visible selection reason.
  Tired readiness forces gentle filtering/doses; non-hard circuits exclude high-impact movements by
  default.
- A generated circuit is saved or started through the existing suggested-workout contract and an
  enabled system `Circuit` method block. Starting it restores timed movement sets in the unified
  logger instead of flattening them into aggregate duration fields. Completion therefore counts as a
  normal workout and remains linked to History and Progress.
- Below 5 reps, weighted work keeps the load and adds one rep per set up to 5.
- Comfortable 5+ rep sets require a logged RPE of 8 or below before `Normal` moves load up 2.5 kg and resets the target to 3 reps. `Fresh` allows that small move without the RPE confirmation; `Tired` removes one set and reduces load by about 10%.
- Every movement shows the source date and a plain-language reason. Suggested sets remain editable and movements can be removed.
- `Save for later` persists the editable plan to Supabase. One current Home plan and one current Gym plan can coexist; saving a newer plan archives the older current plan for that location.
- `Start this workout` persists the plan as accepted, then opens the workout logger with location, movements, and sets prefilled through a short-lived browser handoff.
- The workout logger shows saved plans in a `Next workout` area with Load and Skip actions. Loading keeps every target editable.
- Saving a workout that came from a plan marks the plan completed and links it to the newly created session through `completed_session_id`.

### History

Top-level History tab includes:

- Week / Month / Quarter / Year controls
- previous/next period navigation
- filters for All, Workouts, Climb, 1RM, Bodyweight
- summary tiles
- entries grouped by date
- click/tap detail dialog
- delete from the detail dialog for session-backed workout/climb entries, including Strength Block Builder sessions

History workout counts should also count same-day workout exercises as one workout in the summary.

History detail notes combine movement-level and session-level notes, but exact duplicate note text should be shown once. Single-exercise logs currently save the same note to both places, so the timeline mapper dedupes before rendering the detail dialog.

### Training Methods

The top-level Methods settings screen starts Phase 5 advanced-method support:

- `training_methods` stores protected system definitions and person-owned custom methods with stable UUIDs, one of three families (`exercise_group`, `set_method`, or `timed_density`), a description, and structured JSON defaults.
- `person_training_methods` stores account/person-scoped visibility and future per-person default overrides without mutating the system definition.
- Seventeen system methods are seeded: supersets, tri-sets, giant sets, circuits, jump sets, PHA, complex training, drop/strip sets, clusters, rest-pause, rep targeting, partial reps, eccentrics, pyramid, negatives, EDT, and Tabata.
- System definitions cannot be edited or deleted, but can be hidden or duplicated into an editable personal copy. Custom methods support create, edit, duplicate, deactivate/reactivate, and permanent deletion while they are not yet referenced by logged training.
- RLS reuses `app_private.person_is_accessible(person_id)`. System rows are readable by authenticated users; custom definitions and preferences are limited to accessible people. Both tables have explicit authenticated Data API grants and four CRUD policies.
- Live verification originally found 7 exercise-group, 5 set-method, and 2 timed/density system rows, RLS enabled, explicit select grants, and four policies on each table. The 2026-07-13 method-library update added Eccentrics, Pyramid, and Negatives as enabled set methods, taking the live system library to 17 rows (7 exercise-group, 8 set-method, and 2 timed/density). The Supabase advisor identified one missing foreign-key index, which was added. Existing unrelated advisor notices remain unchanged.
- The local preview reached the new route, but its prior auth session had expired before browser CRUD verification; the page is left ready for sign-in.
- `session_method_blocks` stores the method snapshot, ordered block position, rounds, two rest values, and structured configuration for a completed session. `session_method_block_entries` links the block to its underlying `session_entries` in movement order. Both tables cascade with the session, retain the method definition by foreign key, use explicit authenticated grants, and enforce accessible-person/session consistency through RLS.
- The unified full-workout composer can add, edit, and remove ordered exercise-group blocks from the enabled Methods library. Supersets and tri-sets require exactly two or three movements; other group methods use their configured minimum. A movement belongs to at most one block in this first pass, and moving or deleting exercises updates the block safely.
- The logger now makes the dependency order explicit: first add movements and base sets, then optionally add advanced methods. The second step separates across-movement group/timed methods from within-set methods, whose picker remains attached to the affected set. Creating a block chooses a compatible default from the current movement count: one movement starts with Tabata, two movements start with Superset, and larger workouts use the first compatible enabled definition rather than opening on an impossible method.
- Eccentrics, Pyramid, and Negatives are system set methods available from the within-set picker. Their logged efforts use method-specific wording while retaining the same editable load, reps, RPE, rest, and range fields as other segmented methods.
- Stable client-side movement IDs keep group membership intact while drafting, reordering, and applying same-day corrections. The normal exercise set rows remain unchanged, so existing volume and progress analytics continue to count the underlying work. Saving adds the method block only after its movement entries exist, and rolls back the whole session on any partial failure.
- The finish review labels grouped movements, and completed-session detail shows each method with its ordered exercises, rounds, and rest. Repeating a server-loaded recent session now reconstructs its prior exercise-group and timed blocks, ordered membership, timing/rest configuration, and set-method segments; draft and same-day correction flows preserve them too.
- A live authenticated-role database test saved a temporary Superset with two ordered member entries, read both members through RLS, then deleted the session and confirmed cascade cleanup. The preview session expired again before the new composer could be exercised through the UI, so `/log` is left ready for sign-in.
- `entry_set_segments` adds ordered within-set work without flattening variable loads into one `entry_sets` row. Each row snapshots the method name and definition ID plus load, reps, RPE, rest-after seconds, range of motion, and structured config. It cascades with its parent set, protects referenced method definitions, has explicit authenticated select/insert grants, and applies accessible-session RLS on both operations.
- Rep-targeting sets expose live completed-versus-target feedback without requiring the target to be reached before saving. Deliberate partial-rep sets let the main effort and each added effort record full or partial range independently.
- Progress counts partial reps and their load in workload volume, but deliberately excludes partial-range segments from maximum working weight and estimated-1RM signals. Timeline and session detail still identify the partial work.
- `20260713173500_tighten_entry_set_segment_grants.sql` removes inherited authenticated privileges from `entry_set_segments` and restores only `select` and `insert`, matching its two RLS policies. A live authenticated-role smoke test verified rep-target and partial segments through RLS, checked their aggregate workload/full-range signals, and removed all temporary rows.
- Timed/density methods reuse `session_method_blocks` rather than creating a parallel workout model. EDT defaults to a two-movement 15-minute block; Tabata defaults to one movement, eight 20s/10s rounds. Planned duration, work/rest intervals, planned rounds, and optional completed rounds are explicit columns, while underlying movement sets and reps remain the workload source.
- `20260713173600_add_timed_density_block_fields.sql` adds the timed fields, limits completed rounds to the planned total when one exists, checks that the selected method definition has the same family as the block, and tightens both method-block tables to authenticated `select`/`insert`. A live authenticated-role smoke test inserted and read a one-movement Tabata block, verified all timing fields, and cleaned up every temporary row.
- A loaded set now offers `Add drop / strip set`. The first segment is the normal set row; each subsequent drop gets a thumb-friendly card with load, reps, RPE, rest, and full/partial range controls. The next weight is suggested from the method's configured percentage drop, but every value remains editable. Removing the final drop returns the set to a normal straight set.
- Draft normalization, repeat-last-set, same-day correction, and recent-workout copies preserve segment configuration. The finish summary includes drop-segment reps and volume, session detail shows the complete ordered sequence, and the History/Progress mapper replaces the parent with its segments for reps, maximum load, estimated 1RM, and volume so work is not double counted.
- A live authenticated-role test inserted an 80 kg x 8 segment and a 68 kg x 10 drop, then read 2 segments, 18 reps, and 1,320 kg volume through RLS. Deleting the temporary session cascaded to all segments and left no verification rows. The local preview remains signed out, so mobile browser interaction is still awaiting the next sign-in.
- The same editor now supports enabled Cluster set and Rest-pause definitions. The picker chooses the method per ordinary set: clusters keep the main load and prefill `reps_per_segment`, while rest-pause efforts keep the load and configured short rest but leave reps editable. Labels change to Cluster or Effort, rather than presenting every segment as a drop.
- Custom set methods remain selectable and Methods settings now expose `reps_per_segment` alongside segment count, percentage drop, target reps, and short rest. The saved config snapshots `system_key` when available, so drafts and recent-workout copies preserve method-specific behaviour without another schema change.
- Finishing is blocked only when an attached set method has missing load or reps on its main/extra segments, with a visible explanation. Review counts exercise-group blocks and set-level methods together. This also corrects the drop editor's numbering: the main set is segment 1 and the first added drop/cluster/effort is segment 2.
- A live authenticated-role test saved three Cluster segments and three Rest-pause segments through the existing RLS policy. Each method returned 6 reps and 480 kg volume, and deleting the temporary session left no verification rows. The reloaded local preview is still signed out, so UI interaction remains pending.
- `suggested_workout_method_blocks` and `suggested_workout_method_block_entries` carry exercise-group and
  timed/density methods through the history recommendation, saved-plan, Today, and unified-logger path.
  A recommendation only preserves a method from its selected source session when every member movement
  is present in the proposed workout. The Plan screen exposes the carried block and allows removal before
  saving. Tired recommendations deliberately leave advanced blocks off; they are not auto-added when the
  source session did not contain one.
- Progress derives set-method use from `entry_set_segments` and exercise-group/timed use from
  `session_method_block_entries`. It offers All, Straight sets, and one filter per method actually used
  for the selected exercise. The filter applies consistently to the recommendation, statistics,
  performance/volume charts, linked plan comparisons, and exact history. Session rows show method
  badges, and the method comparison summarizes session count, average volume, and best performance for
  each method in the selected period/location. The underlying exercise sets and segments remain the
  only workload source.
- An authenticated browser smoke test used a temporary Bench Press entry with Drop / strip set segments
  inside a Superset. Progress showed both filters and badges, calculated 1,160 kg from the two segments,
  and reduced the full workspace to the one matching session when Superset was selected. The temporary
  session, segments, and block were then deleted with zero remaining rows.
- `suggested_workout_set_segments` preserves within-exercise method prescriptions in saved plans. It
  stores the method snapshot and ordered load, reps, RPE, short rest, range-of-motion, and configuration
  for each planned set segment. The table cascades with its parent set, uses accessible-person RLS, and
  grants authenticated users only `select` and `insert`; update and delete remain unavailable through
  the Data API.
- Saved-plan reads reconstruct set methods and their segments in the unified logger. Recommendations
  preserve them only when the source set pattern is repeated exactly; progression and tired/deload
  changes omit them. Server-loaded recent repeats reconstruct group/timed blocks and set methods,
  including the one-set case that previously risked being flattened into aggregate reps.
- Planned-versus-completed review now compares method adherence independently from set adherence.
  Progress labels the method result as matched, changed, omitted, added, or straight sets and shows the
  planned and actual method names.
- Empty or non-rep source work no longer becomes an invented `1 rep` target in Today or Plan. Progress
  also preserves fractional loads in headline statistics, so a 72.5 kg top set is no longer rounded to
  73 kg while exact history still says 72.5 kg.
- A live authenticated browser smoke test saved and loaded a temporary Gym plan containing Bench Press
  with Drop / strip set segments inside a Superset. The logger restored both methods, and repeating the
  completed server-loaded workout retained the same block and the 70 kg x 8 plus 60 kg x 10 drop
  sequence. Progress reported `Method matched` and displayed both planned and actual method names. The
  live table returned two segments through RLS with authenticated `select`/`insert` but no
  `update`/`delete`; all temporary plan/session rows and their segments were then removed.
- Phase 5 is complete. The first Phase 6 slice now defines and exposes one workout lifecycle across
  Today, Plan, Log, and History: Planned, Ready, In progress, Completed, Skipped, and Archived. Plans
  and completed sessions remain in Supabase, while In progress truthfully reflects the account-scoped
  browser draft on the current device. Plan includes recent lifecycle activity, and deleting a linked
  completed session archives its plan first so completed plans cannot be left without a session.
- `src/lib/database.types.ts` contains types generated from the live Supabase schema on 2026-07-14.
- People & Access is intentionally deferred as of 2026-07-14 because Noam is currently the only user.
  Do not build multi-user administration until a second user is actually being prepared.
- The Phase 6 climbing-controls audit is complete. The unified logger now owns the specialist climbing
  fields, uses guarded whole minutes as the canonical duration, keeps problem/route counts aligned with
  tracking mode, scopes gradient to Kilter, and reconstructs legacy `hours` rows as minutes. The next
  active product item is the Library inactive-item audit.

## Key Files

- `src/components/admin-shell.tsx`: main shell, navigation, build label, sign out.
- `src/components/exercise-detail.tsx`: exercise history/detail visualization.
- `src/components/session-detail-dialog.tsx`: shared responsive full-session drill-down used by Progress.
- `src/components/weekly-plan-overview.tsx`: responsive next-seven-days strip, editable daily load, and Home/Gym pattern/signal cards.
- `src/components/weekly-recovery-card.tsx`: explainable continue/lighter/deload status and week-mode controls.
- `src/components/supabase-auth-gate.tsx`: email/password auth gate.
- `src/lib/build-info.ts`: build/commit label support.
- `src/lib/date.ts`: date helpers.
- `src/lib/movement-metrics.ts`: movement-to-metric-profile rules for logging fields.
- `src/lib/planned-actual.ts`: pure planned-set versus actual-set comparison and status rules.
- `src/lib/progress-decision.ts`: explainable exercise-level continue/progress/hold/lighter decision rules.
- `src/lib/circuit-metadata.ts`: circuit profile enums, labels, dose defaults, and display helpers.
- `src/lib/circuit-generator.ts`: deterministic circuit eligibility, pattern balance, dosing,
  duration/round budgeting, and explainable selection results.
- `src/lib/supabase-public.ts`: Supabase Auth/session and REST helpers.
- `src/lib/supabase-daily-rotation.browser.ts`: daily rotation CRUD, eligible-day/repeat-gap filtering, stable weighted selection, assignment persistence, and completion toggling.
- `src/lib/supabase-people.browser.ts`: current person/profile helpers.
- `src/lib/supabase-dashboard.browser.ts`: dashboard data loading and aggregation.
- `src/lib/supabase-weekly-review.browser.ts`: read-only weekly comparison, plan adherence, PR, recovery-signal, and next-action aggregation.
- `src/lib/supabase-log.browser.ts`: workout/climbing/1RM/bodyweight log data functions.
- `src/lib/supabase-plans.browser.ts`: save/load/status/completion helpers for persistent workout plans.
- `src/lib/supabase-weekly-load.browser.ts`: profile-scoped non-strength session classification for weekly load inference.
- `src/lib/workout-plan.ts`: transparent history grouping, pattern detection, progression rules,
  tracking-mode-aware targets, backward-compatible plan-draft validation, and Today-to-Plan location
  handoff.
- `src/lib/weekly-plan.ts`: pure expected-day, confidence, rotation, progression, repeated-high-effort, other-load, and adjustment-validation logic for the weekly Plan overview.
- `src/lib/weekly-recovery.ts`: pure combined-load, effort, performance-decline, and deload-decision rules.
- `src/lib/supabase-training-methods.browser.ts`: profile-scoped system/custom training-method reads and settings CRUD.
- `src/lib/supabase-library.browser.ts`: library and person exercise selection data functions.
- `src/lib/supabase-goals.browser.ts`: goals and check-ins data functions.
- `src/lib/supabase-history.browser.ts`: exercise history with method attribution, completed-log exercise keys, and linked planned-versus-actual reads used by Progress.
- `src/lib/supabase-session-detail.browser.ts`: profile-scoped session, movement, set, metric, and notes detail read.
- `src/lib/workout-local-state.ts`: account-scoped draft/favourite/completed keys and compact Today summaries.
- `src/lib/supabase-timeline.browser.ts`: combined History tab data.
- `src/routes/index.tsx`: compact Today startup and workout launch route.
- `src/routes/rotation.tsx`: daily rotation item management and per-item selection settings.
- `src/routes/dashboard.tsx`: dashboard route at `/dashboard`.
- `src/routes/weekly-review.tsx`: weekly training review and evidence-backed next actions at `/weekly-review`.
- `src/routes/log.tsx`: log screen route.
- `src/routes/plan.tsx`: next-workout planner, readiness choices, editable suggested sets, and
  tracking-mode-specific duration, hold, distance, rounds, carry, mobility, and power targets.
- `src/routes/methods.tsx`: advanced training-method settings library, family filters, defaults, visibility, duplication, and custom CRUD.
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
- `supabase/migrations/20260713142913_add_training_methods.sql`: applied and tracked training-method definitions, per-person settings, system seed data, indexes, grants, and RLS.
- `supabase/migrations/20260713212133_add_eccentrics_pyramid_negatives_methods.sql`: adds Eccentrics, Pyramid, and Negatives as idempotent system set-method definitions.
- `supabase/migrations/20260714061929_normalize_exercise_tracking_modes.sql`: normalizes existing exercise metrics into the eleven stable tracking-mode keys used by the Library dropdown and logger.
- `supabase/migrations/20260716072606_add_structured_goals.sql`: applied backward-compatible structured goal fields and the linked-exercise index/foreign key.
- `supabase/migrations/20260713173700_add_suggested_workout_method_blocks.sql`: applied and tracked method blocks and ordered movement memberships for persistent plans.
- `supabase/migrations/20260713173800_add_suggested_workout_set_segments.sql`: applied and tracked within-exercise method segments for persistent plans.
- `supabase/migrations/20260722212241_add_type_aware_workout_plan_targets.sql`: adds canonical tracking
  modes and structured movement targets to saved plan entries plus per-set planned duration seconds.
- `docs/product-roadmap.md`: staged product redesign roadmap; Phase 5 advanced-method logging, planning, round trips, Progress, and adherence review are complete.
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

- The unified Log form only shows advanced training methods after a compatible strength,
  calisthenics, hold/grip, carry, conditioning, or power movement is selected. Duration-only
  classes, cardio/time, mobility/flexibility, yoga, and climbing movements are excluded from method
  blocks; changing a movement to an incompatible profile detaches it from any existing block.
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
3. Confirm app startup opens Today and the Dashboard nav still opens `/dashboard`.
4. Set a few Library movements to Home-only and Gym-only, then confirm the workout movement list filters correctly while Both appears in both lists.
5. Test Log flows for Strength, Run, Class, Mobility/Flexibility, Grip, Climbing, 1RM, and Bodyweight.
6. Test the duplicate-log warning by trying to save the same movement twice on the same date.
7. Test a one-movement save plus Home and Gym multi-movement saves from the deployed authenticated app, including mixed-weight sets, and confirm the location appears in History.
8. Test Progress for Bench Press across multiple periods and Home/Gym, including the new mixed-weight workout.
9. Test Plan for Gym Normal/Tired with both `Save for later` and `Start this workout`; confirm the Next Workout card, location, exact set targets, Skip action, and completed-session link.
10. Log enough explicit Home/Gym full workouts to replace the planner's locationless-history fallback with trustworthy location-specific patterns.
11. Phase 6 lifecycle audit and first visible lifecycle model — implemented across Today, Plan, Log, and History.
12. Phase 6 climbing-controls audit — implemented. The audit found that specialist controls had already moved into the unified logger, but duration and mode validation were still permissive. Climbing now uses guarded whole minutes (`duration_minutes`) with an explicit conversion example and 720-minute ceiling, requires problems/routes when that mode is selected, scopes gradient to Kilter, prevents stale specialist metrics from leaking into other entries, and converts legacy `hours` rows to minutes when repeating a workout. The corrected 2026-07-09 Bouldering and 2026-07-11 Ropes/Belay rows remain stored as 1.25 legacy hours and reconstruct as 75 minutes.
13. Test Library `Show inactive`, especially hidden items such as `Rice Bucket` and old climbing entries.
14. Confirm `Pull-Up`, `Lat Pulldown`, and `Chin-Up` appear separately in the Library and Log movement selector.
15. Decide whether new master exercises should automatically create `person_exercises` rows for Noam, or whether the app should treat missing rows as enabled by default.
16. Tighten the profile-claim bootstrap now that Noam's account is linked.
17. Programme assignment setup and voluntary execution on top of the seeded Percentage Strength
    Blocks — implemented. Today previews the next exact prescription, explicit Start persists it
    without replacing normal workflows, and linked completion advances the assignment atomically.
18. Keep simplifying future custom app ideas around app profiles rather than duplicating data.
19. Only when a second user is planned, build People & Access: create/edit people, link an auth user, assign an app profile, and route exercise selection through the existing per-person Library controls.
20. Test Circuit Builder in the deployed authenticated app across Home/Gym, bodyweight-only,
    rep-led, and time-led briefs, then implement the editable preview controls: swap, lock,
    regenerate, and reorder.

## Future Stage: iPhone App

The current mobile home-screen version is a web app/PWA-like experience. The `Build: local` label seen on mobile bookmarks means the deployed runtime is not receiving build metadata; it does not mean the phone is running local code.

Possible iPhone directions:

- Polish the current web/home-screen app first: icon, manifest, mobile layout, loading/error states, and cache behaviour.
- If Noam wants a real installable iPhone app without rebuilding the UI, use Capacitor to wrap the existing web app and distribute privately through TestFlight. This should preserve the Supabase backend and most app code.
- A full native rebuild in SwiftUI or React Native is possible later, but is much more work and should wait until the product shape is stable.

Best future option if needed: Capacitor wrapper after the web app is stable.
