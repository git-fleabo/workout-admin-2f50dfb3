# Supabase Schema Design

## Goal

Move the main admin app from Google Sheets to Supabase without changing how it works for Noam today, while making the database ready for separate simplified apps for friends and future clients.

Current priority:

- Preserve current dashboard, log, library, goals, PR, climbing, 1RM, bodyweight, skill, and grip behavior.
- Preserve actual training data well enough that progress and stats remain trustworthy.
- Keep migration incremental so the app can be verified area by area.

Future-ready priority:

- Noam is just another tracked person.
- Noam is also an admin who can manage other people.
- Friends/clients can log their own workouts in separate custom apps.
- Apps can suggest the next workout from a flexible program.
- Noam can select or deselect exercises from one master library for each person.
- Custom apps can expose simplified tracking without requiring a separate database shape.

## Design Principles

1. Use a platform schema, not a spreadsheet clone.
2. Keep current app behavior stable while replacing the data source.
3. Store training logs in structured tables so PRs and progress queries stay reliable.
4. Keep simplified tracking flexible enough for classes, runs, yoga, climbing, skills, grip, and strength.
5. Use one master exercise library with per-person availability.
6. Support flexible programs where the next suggested workout can be sequence-based rather than calendar-bound.
7. Keep Supabase service-role access server-side only.

## Core Model

### People And Access

`people`

Represents anyone whose training can be tracked, including Noam.

Suggested columns:

- `id uuid primary key`
- `display_name text not null`
- `email text`
- `status text not null default 'active'`
- `notes text`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

`admin_people`

Represents who can manage whose data. For now this can just make Noam admin for all people.

Suggested columns:

- `id uuid primary key`
- `admin_person_id uuid not null references people(id)`
- `managed_person_id uuid not null references people(id)`
- `role text not null default 'admin'`
- `created_at timestamptz not null default now()`

`app_profiles`

Represents separate custom apps or app modes, such as full admin, simple run tracker, class tracker, or calisthenics app.

Suggested columns:

- `id uuid primary key`
- `name text not null`
- `slug text not null unique`
- `description text`
- `config jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

`person_app_profiles`

Assigns app experiences to people.

Suggested columns:

- `id uuid primary key`
- `person_id uuid not null references people(id)`
- `app_profile_id uuid not null references app_profiles(id)`
- `is_default boolean not null default false`
- `created_at timestamptz not null default now()`

## Master Library

`activity_types`

Examples: Strength, Cardio, Yoga, Stretching, Mobility, Sport, Skills/Calisthenics, Grip, Climbing, Run, Class, Other.

Suggested columns:

- `id uuid primary key`
- `name text not null unique`
- `slug text not null unique`
- `sort_order integer not null default 0`
- `created_at timestamptz not null default now()`

`exercises`

One master library for movements and activities.

Suggested columns:

- `id uuid primary key`
- `activity_type_id uuid references activity_types(id)`
- `name text not null`
- `equipment text`
- `default_metric text`
- `suggested_sets text`
- `suggested_reps text`
- `notes text`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

`exercise_tags`

Useful for filtering and custom app views without duplicating exercises.

Suggested columns:

- `id uuid primary key`
- `name text not null unique`
- `slug text not null unique`

`exercise_tag_links`

Suggested columns:

- `exercise_id uuid not null references exercises(id)`
- `tag_id uuid not null references exercise_tags(id)`
- `primary key (exercise_id, tag_id)`

`person_exercises`

Controls which master-library exercises are available to each person.

Suggested columns:

- `id uuid primary key`
- `person_id uuid not null references people(id)`
- `exercise_id uuid not null references exercises(id)`
- `is_enabled boolean not null default true`
- `custom_name text`
- `notes text`
- `created_at timestamptz not null default now()`
- `unique (person_id, exercise_id)`

This is the key table for "select/deselect exercises for people".

## Logging

`sessions`

One training event on one date. This replaces the top-level idea of a row in Workout Log, Climbing Log, or a simple custom tracker.

Suggested columns:

- `id uuid primary key`
- `person_id uuid not null references people(id)`
- `activity_type_id uuid references activity_types(id)`
- `session_date date not null`
- `title text`
- `source text not null default 'manual'`
- `completed boolean not null default true`
- `duration_minutes numeric`
- `intensity text`
- `rpe numeric`
- `notes text`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

`session_entries`

One exercise/activity inside a session. A strength workout may have many entries; a run or class may only have one.

Suggested columns:

- `id uuid primary key`
- `session_id uuid not null references sessions(id) on delete cascade`
- `exercise_id uuid references exercises(id)`
- `activity_type_id uuid references activity_types(id)`
- `entry_kind text`
- `name text not null`
- `progression_level text`
- `order_index integer not null default 0`
- `completed boolean not null default true`
- `notes text`
- `created_at timestamptz not null default now()`

`entry_sets`

Structured set-level data for strength, skills, grip, and any repeated work.

Suggested columns:

- `id uuid primary key`
- `session_entry_id uuid not null references session_entries(id) on delete cascade`
- `set_number integer`
- `reps numeric`
- `weight numeric`
- `duration_seconds numeric`
- `distance numeric`
- `distance_unit text`
- `rpe numeric`
- `rest_seconds integer`
- `assistance_type text`
- `assistance_detail text`
- `quality text`
- `completed boolean not null default true`
- `notes text`

`entry_metrics`

Flexible metrics for simplified apps and activity-specific tracking fields that should not become permanent columns too early.

Suggested columns:

- `id uuid primary key`
- `session_entry_id uuid not null references session_entries(id) on delete cascade`
- `metric_key text not null`
- `metric_value numeric`
- `metric_text text`
- `metric_unit text`
- `created_at timestamptz not null default now()`

Examples:

- Run: `distance = 5`, `distance_unit = km`, `duration_seconds = 1800`
- Class: `class_type = Pilates`, `duration_minutes = 60`, `rpe = 7`
- Climbing: `grade = V4`, `gradient = 30`, `boulders = 12`
- Skill: `hold_seconds = 18`, `assistance_type = Band`, `assistance_detail = Light`

## Strength And Bodyweight

`one_rm_tests`

Keep this as a dedicated table because current app behavior and PR logic depend on it.

Suggested columns:

- `id uuid primary key`
- `person_id uuid not null references people(id)`
- `test_date date not null`
- `exercise_id uuid references exercises(id)`
- `exercise_name text not null`
- `source text`
- `load_type text`
- `bodyweight_used boolean not null default false`
- `bodyweight_contribution text`
- `external_weight numeric`
- `reps numeric`
- `rpe numeric`
- `formula text`
- `estimated_total numeric`
- `estimated_external numeric`
- `is_pr boolean not null default false`
- `notes text`
- `created_at timestamptz not null default now()`

`bodyweight_logs`

Suggested columns:

- `id uuid primary key`
- `person_id uuid not null references people(id)`
- `logged_date date not null`
- `bodyweight numeric not null`
- `notes text`
- `created_at timestamptz not null default now()`

## Programs And Suggestions

`programs`

Reusable structured plans.

Suggested columns:

- `id uuid primary key`
- `name text not null`
- `description text`
- `created_by_person_id uuid references people(id)`
- `is_template boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

`program_workouts`

A workout inside a program, ordered flexibly rather than tied to a fixed calendar date.

Suggested columns:

- `id uuid primary key`
- `program_id uuid not null references programs(id) on delete cascade`
- `name text not null`
- `sequence_index integer not null default 0`
- `description text`
- `created_at timestamptz not null default now()`

`program_workout_entries`

Structured planned exercises inside a program workout.

Suggested columns:

- `id uuid primary key`
- `program_workout_id uuid not null references program_workouts(id) on delete cascade`
- `exercise_id uuid references exercises(id)`
- `name text not null`
- `order_index integer not null default 0`
- `sets text`
- `reps text`
- `weight text`
- `duration text`
- `rpe text`
- `rest text`
- `progression_level text`
- `assistance_type text`
- `assistance_detail text`
- `notes text`

`program_assignments`

Assigns a program to a person and tracks flexible progress through it.

Suggested columns:

- `id uuid primary key`
- `program_id uuid not null references programs(id)`
- `person_id uuid not null references people(id)`
- `assigned_by_person_id uuid references people(id)`
- `status text not null default 'active'`
- `current_workout_index integer not null default 0`
- `started_on date`
- `completed_on date`
- `notes text`
- `created_at timestamptz not null default now()`

`suggested_workouts`

Stores the specific suggestion shown to a person in a custom app. This can point to a program workout or be ad hoc.

Suggested columns:

- `id uuid primary key`
- `person_id uuid not null references people(id)`
- `program_assignment_id uuid references program_assignments(id)`
- `program_workout_id uuid references program_workouts(id)`
- `suggested_for date`
- `status text not null default 'pending'`
- `title text not null`
- `notes text`
- `created_at timestamptz not null default now()`

## Current Spreadsheet Mapping

`Workout Log`

- Creates `sessions` rows.
- Creates one `session_entries` row per logged exercise.
- Creates one or more `entry_sets` rows depending on how much structure can be inferred from sets/reps.
- Skill/grip metadata maps to `session_entries.progression_level` and `entry_sets.assistance_*`, `entry_sets.duration_seconds`, `entry_sets.quality`.

`Climbing Log`

- Creates `sessions` rows with activity type `Climbing`.
- Creates one `session_entries` row named after the climbing type.
- Climbing-specific fields can live in `entry_metrics` until they deserve first-class columns.

`Skills Tracker`

- Legacy history only.
- Import as historical skill `sessions`, `session_entries`, and `entry_sets`.
- Mark source as `legacy_skills_tracker` so PR logic can include it but future UI does not need to recreate the old tracker.

`1RM Tracker`

- Imports to `one_rm_tests`.
- Bodyweight section imports to `bodyweight_logs`.

`Exercise Library`

- Imports to `exercises`.
- Old focus/type quirks should be normalized during import.

`Settings`

- Imports to `activity_types` and lookup/tag seed data.
- Not every Settings list needs its own table immediately.

`Goals`

- Can remain a simple `goals` table tied to `person_id`, or later become part of programs.

## MVP Migration Phases

### Phase 1: Schema And Import Prototype

- Create Supabase schema in a branch or staging project.
- Import a copy of the live spreadsheet data.
- Verify counts and recent rows per tab.
- Verify PR calculations against current app output.

### Phase 2: Data Access Layer

- Add Supabase server client.
- Create repository-style functions matching current app needs:
  - `getDashboardData`
  - `listExercises`
  - `addExercise`
  - `updateExercise`
  - `deleteExercise`
  - `listGoals`
  - `addWorkout`
  - `addClimb`
  - `add1RMTest`
  - `addBodyweight`
  - `getPRs`
- Keep UI components largely unchanged.

### Phase 3: Switch Low-Risk Areas

- Move Library to Supabase.
- Move Goals to Supabase.
- Confirm app behavior and admin password flow still work.

### Phase 4: Switch Logging

- Move workout, skill, grip, climbing, 1RM, and bodyweight writes to Supabase.
- Keep Google Sheets read-only as a fallback during verification if useful.

### Phase 5: Switch Dashboard And PRs

- Rebuild dashboard and PR queries from Supabase.
- Compare against spreadsheet output before retiring Sheets.

### Phase 6: Custom App Foundation

- Build admin controls for `person_exercises`.
- Build program creation and assignment flows.
- Build first simplified custom app profile.

## Access Model

Short-term:

- Keep the existing admin password gate for the admin app.
- Use Supabase service role only in server functions.
- Do not expose service role credentials to the browser.

Later:

- Add Supabase Auth for friends/clients.
- Use RLS so clients can read/write only their own assigned data.
- Keep Noam's admin capability separate from client access.

## Open Decisions

- Whether custom apps share one codebase with different app profile config, or are separate Lovable apps that all point at the same Supabase project.
- Whether `entry_metrics` should be used heavily, or whether runs/classes/climbing deserve dedicated typed tables after the first migration.
- Whether program suggestions should automatically advance after completion or require admin review.
- Whether historical spreadsheet formulas need to be preserved as computed columns/views or simply reimplemented in app queries.

## Recommended Next Step

Create the first SQL schema draft for Phase 1, then run it against a staging Supabase project. After that, import a small sample of the live spreadsheet and compare:

- total rows imported by source tab
- latest 10 workout logs
- latest 10 climbing logs
- 1RM PRs
- assisted/unassisted skill PRs
- dashboard weekly summary

Only after those checks pass should the admin app start reading from Supabase.
