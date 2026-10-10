# Multiple Exercise Library categories

An exercise keeps its existing default category and can also appear in other categories. The editor exposes “Default category” and “Also in these categories”; extra categories do not change tracking, logging defaults, existing prescriptions or logs. Library filters match either the default or extra categories. The movement list and detail show all categories without duplicate entries or badges.

The accompanying programme-picker fix admits enabled, active exercises by supported tracking format across categories. This makes a weight/reps Kettlebell Swing available even when its default Library category is Conditioning. Rep-based Base Strength setup and the shared programme editor retain their existing supported tracking formats.

## Storage and access

`exercise_activity_types` stores additional category links with exercise/category foreign keys and a uniqueness constraint. The existing `exercises.activity_type_id` remains the default. A separate link identity avoids introducing an ambiguous inferred many-to-many API relationship that could break existing `activity_types(name)` joins. Both foreign keys have covering indexes.

`set_exercise_categories` validates named categories before atomically replacing extras. It locks the exercise, removes duplicate/default-category links and rejects unknown or invalid categories. It uses security invoker with an empty search path. RLS and the existing Library administrator check permit authenticated reads and administrator writes; anonymous table access and function execution are revoked. Legacy callers omitting the optional extra-category field preserve existing links.

The live database migration was applied on 10 October 2026 as `20261010212137_add_exercise_categories.sql`, matching the local migration and schema snapshot. Verification found the table empty, RLS enabled and correct grants, and complete-row fingerprints for existing exercises and sessions unchanged. No live exercise was retagged. The Data API accepted the old default-category join plus the new nested extra-category join in a read-only query, confirming schema registration without relationship ambiguity.

Security and performance advisors introduced no new findings. The pre-existing [leaked-password protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), two [unindexed foreign keys](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), and 53 [unused indexes](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) remain outside this change.

## Verification and release

- 251 model/database tests passed, none skipped. Category tests cover atomic replace/clear, duplicate/default suppression, unknown-category rollback and anonymous/non-administrator write rejection. The category database case passed again after migration-history alignment.
- 82 component tests passed. Coverage includes extra-category save/reopen/removal, unchanged default/tracking, API mapping/save payloads, old-caller preservation and the original programme swing regression.
- Type checking, scoped lint, production build and diff checks passed.
- The actual editor was checked at the normal 1280 px app-panel width in a local harness. A demo swing retained Conditioning as its default, saved Strength as an extra, and retained weight/reps tracking. No horizontal overflow occurred; demo saving wrote no live data.

Repository implementation and live database readiness are verified. The frontend is not yet released through Lovable, and a signed-in category edit in the released app remains unverified.
