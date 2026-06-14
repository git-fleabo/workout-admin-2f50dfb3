# Supabase Import Status

Supabase project:

- Name: `Training Admin`
- Project ID: `dvcdghmcqqfvlbzufpyy`
- URL: `https://dvcdghmcqqfvlbzufpyy.supabase.co`

Live spreadsheet source:

- Spreadsheet ID: `17bxY64sce1_QcoWVf0gYHlbWkOVwu3MvZj6eUtTbT7o`

## Imported

### People

- `Noam` seeded as the first tracked person.
- `Noam` assigned the `full-training-admin` app profile.

### Exercise Library

Source ranges:

- `Exercise Library!A5:H33`
- `Exercise Library!A234:H251`

Imported:

- 47 `exercises`
- 47 enabled `person_exercises` rows for Noam

Notes:

- Duplicate movement names are preserved, including separate Strength and Grip `Farmer Carry` rows.
- Source row traceability is stored with `source_sheet = 'Exercise Library'` and `source_row`.
- `focus_area` was added to preserve the current admin app library shape.

### Goals

Source range:

- `Goals!A2:E7`

Imported:

- 6 `goals`

### Workout Log

Source range:

- `Workout Log!A5:X33`

Imported:

- 29 `sessions`
- 29 `session_entries`
- 27 aggregate `entry_sets`

Notes:

- Historical `Calisthenics` rows were normalized to `Skills/Calisthenics`.
- Rest dropdown values are preserved in `entry_sets.rest_time`.
- Each spreadsheet row is imported as one session and one entry for now. This preserves current app behavior and keeps row-level source traceability.

### Climbing Log

Source range:

- `Climbing Log!A10:L14`

Imported:

- 5 `sessions`
- 5 `session_entries`
- 11 `entry_metrics`

### 1RM Tracker

Source range:

- `1RM Tracker!A70:R70`

Imported:

- 1 `one_rm_tests`

### Bodyweight

Source range:

- `1RM Tracker!J7:L8`

Imported:

- 2 `bodyweight_logs`

### Legacy Skills Tracker

Source range:

- `Skills Tracker!A41:O49`

Imported:

- 9 `sessions`
- 9 `session_entries`
- 9 `entry_sets`
- 22 `entry_metrics`

Notes:

- Imported as `source_sheet = 'Skills Tracker'` so legacy PR/history rows stay distinguishable from unified `Workout Log` skill rows.
- `Callisthenics` / `Calisthenics` values were normalized to `Skills/Calisthenics`.
- Grip movements such as `Fat Grip Hang` and `Hangboard` were kept as `Grip`.
- Legacy PR flags are preserved as `entry_metrics.metric_key = 'legacy_pr'`.
- Raw legacy assistance text is preserved as `entry_metrics.metric_key = 'legacy_assistance'`, but it is not stored on `entry_sets.assistance_detail` because current app logic treats legacy skill rows as unassisted history.

## Applied Import Prep Migrations

- `add_exercise_focus_area`
- `prepare_library_import`
- `prepare_goals_import`
- `prepare_training_log_import`
- `add_entry_set_rest_time`
- `prepare_bodyweight_import`
- `enable_auth_rls_for_client_goals`
- `optimize_active_rls_auth_uid_calls`
- `enable_client_library_management`
- `combine_people_select_rls_policies`
- `enable_client_exercise_history_read`

## Still To Import Or Reconcile

- Any future new rows added to the spreadsheet after this import checkpoint.
- A query-level comparison between Supabase PR/dashboard calculations and the current spreadsheet/app output.
- Generated TypeScript database types should be saved once the app starts reading from Supabase.

## Current Supabase Totals

- 47 `exercises`
- 6 `goals`
- 43 `sessions`
- 43 `session_entries`
- 36 `entry_sets`
- 35 `entry_metrics`
- 1 `one_rm_tests`
- 2 `bodyweight_logs`

## App-Side Comparison Layer

Added server-only Supabase helpers:

- `src/lib/supabase.server.ts`
- `src/lib/supabase-admin.functions.ts`

Available comparison functions:

- `listExercisesFromSupabase`
- `listGoalsFromSupabase`
- `getSupabaseImportSummary`

These are wired into the internal `/data-check` route. They sit beside the existing Google Sheets functions so Library and Goals can be compared before switching the app's source of truth.

Required runtime env before using them:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Lovable note:

- The `/data-check` route and server-only comparison helpers are for local/admin-side verification only.
- Do not put a service-role key into browser code or any Lovable runtime that cannot keep it secret.
- The app migration should use Supabase Auth plus row-level security for normal screens.

## App Migration Progress

- Goals is the first Supabase-backed screen.
- `src/routes/goals.tsx` now uses browser-side Supabase Auth/RLS for list, create, update, and delete.
- Library is the second Supabase-backed screen.
- `src/routes/library.tsx` now uses browser-side Supabase Auth/RLS for the master exercise list, add/edit/hide, person selection, and enable/disable toggles.
- `src/components/supabase-auth-gate.tsx` adds email/password Supabase login.
- `src/lib/supabase-public.ts` contains the public Supabase URL/key and REST/Auth helpers.
- `src/lib/supabase-people.browser.ts` contains shared person/profile helpers.
- `src/lib/supabase-goals.browser.ts` contains the Goals data layer and Noam-profile claim flow.
- `src/lib/supabase-library.browser.ts` contains the Library data layer.
- `src/lib/supabase-history.browser.ts` contains the Library exercise-history data layer.
- Dashboard still reads goals from the spreadsheet until its data layer is migrated.
- Log, Dashboard, PRs, and recent workout/climbing history remain Sheets-backed.
- The old `PasswordGate` is still in front of the app while those Sheets-backed screens depend on the existing server auth middleware.

## Current Auth Model

- The first Supabase-backed screen is protected with email/password Supabase Auth.
- An authenticated user can claim the existing unlinked `Noam` person row from the Goals screen.
- After claim, Goals data is read and written through RLS policies using that person's row.
- This bootstrap claim is intentionally temporary and should be tightened once your own Supabase account is linked.

## Next Recommended Step

In the app preview:

1. Sign up or sign in with Supabase email/password.
2. Open Goals.
3. Click `Connect profile` to link your Supabase user to the imported Noam data.
4. Add, edit, and delete one test goal, then remove it.
5. Open Library and confirm the exercise list loads from Supabase.
6. Toggle one movement off/on for Noam and confirm the disabled badge appears/disappears.
7. Open a movement history panel and confirm its chart/recent sessions load.

Then migrate the remaining screens away from the spreadsheet in this order:

1. Dashboard weekly summary and goals summary.
2. Workout/climbing log creation and recent history.
3. PR/history calculations, especially assisted/unassisted skill PRs.
4. Remove the old password gate and server env-var dependency once the app no longer needs Sheets-backed server functions.

Local/admin-only verification can still use `/data-check` with a service-role key, but the Lovable app should not depend on that key.
