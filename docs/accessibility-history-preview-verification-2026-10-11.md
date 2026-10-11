# Accessibility, previews and history verification — 11 October 2026

The fourth repair milestone addresses A11, A14 and A15 from the [app audit](app-audit-2026-10-11.md). All fifteen named audit findings now have repository repairs. Frontend publication and independent signed-in production validation remain outstanding.

## Changes

- **Accessible logger controls (A11):** shared fields expose their visible label to nested date, numeric, select and notes controls. Each control has a stable, distinct React ID. Explicit names such as climbing hours/minutes take priority. The movement picker and search, bodyweight switch and optional set-method controls are named. Repeated sets and method segments have numbered groups. Controlled logger dialogs return focus to the initiating control when dismissed, including method, finish, discard and replacement dialogs. Delete confirmation focuses Cancel; the asynchronous climbing duplicate warning has a submit-button fallback.
- **Compact previews (A14):** the kettlebell picker shows the summary, equipment, duration, compact sequence and start action before an accessible disclosure containing the full prescription. Exactly matching movements are grouped with their original sequence positions; changed targets remain separate. Method timing, rounds, recovery and instructions remain available. Today programme offers also put their actions before detailed targets. Mobile Plan leads with the movement summary and save/start actions, with all target editing available in a disclosure. Single-rep/movement labels and duplicate week labels are corrected. Original logger targets, saved programmes and prescription order are untouched.
- **Complete historical reads (A15):** dashboard, timeline, exercise/climbing progress, goals/check-ins, data-quality history, personal records, weekly review/load and programme-support history exhaust explicit database pages. Date-window filters remain in effect where already supported. Every query has a deterministic primary-key tie-breaker, including composite method-membership keys. Readers continue until an empty response, even when the server cap is smaller than the requested 500 rows. Failed or repeated pages reject the read instead of returning a partial series. Large planned/actual session-ID filters are batched. Profile-dependent reads explicitly scope the selected person. History displays 30 dates at a time with Show more; filtering and totals use the complete result.
- **Foreign-key indexes:** indexes cover `coaching_recommendation_decisions.suggested_workout_id` and `sessions(mobility_practice_run_id, person_id)`. They change no rows or access policies.

## Verification

| Check                         | Result                                                 |
| ----------------------------- | ------------------------------------------------------ |
| Unit/database suite           | 296 passed; zero failures or skips                     |
| Component suite, two workers  | 159 passed across 37 files                             |
| TypeScript                    | Passed                                                 |
| Production client/SSR build   | Passed                                                 |
| Frozen Bun 1.4.3 installation | Passed; package manifest and lockfile unchanged        |
| ESLint                        | Zero errors; eight pre-existing React refresh warnings |
| Diff whitespace               | Passed                                                 |

The tests cover more than 1,000 historical rows, a server cap below the requested page size, a newest measurement and an older best PR beyond the previous limits, later-page errors, repeated responses, composite keys, parent-ID batching, profile query filters, complete climbing-grade pages, History's Show more and period reset, accessible names/unique IDs, select keyboard operation, and delete-dialog focus restoration. Prescription tests retain different targets, group exact repeats and confirm no input mutation. Existing kettlebell timing/start and programme-offer tests also pass.

Real Chromium checks used a local 30-movement fixture with the changed components and app styles at 390×844, 768×1024 and 1440×1000. There was no horizontal overflow before or after expansion. Start remained within the first screen (bottom at 297px on the phone fixture), six identical repeated movement groups replaced thirty detailed rows, and keyboard disclosure/select/dialog checks passed with no browser exceptions. The visible browser accessibility tree also named the date, workout type, optional problem count and notes controls. This is targeted verification, not a full assistive-technology certification or proof of the published app's new behavior.

The index migration was tested twice in an isolated PostgreSQL cluster. Data fingerprints remained unchanged and real query plans used both indexes. The local filename matches the installed migration version: `20261011215523_index_audit_foreign_keys.sql`.

## Live backend evidence

Both indexes are installed on project `dvcdghmcqqfvlbzufpyy`, and their definitions were checked. All **56 public-table fingerprints matched exactly** before and after installation. Counts remain **119 sessions, 206 entries and 399 sets**. No live training, programme, recommendation or history records were created, updated or deleted.

Supabase's performance advisor no longer reports either [unindexed foreign key](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys). Unused-index notices are informational; existing indexes were retained.

## Outstanding release work and advisories

The user still needs to sync/publish through their GitHub/Lovable workflow. No Git push or frontend publication was performed. After publication, independently check the visible build, signed-in logger names/focus, compact Today/Plan actions, History's complete progress and real export downloads. A disposable live save/offline retry/correction workflow requires fresh authorization, a captured baseline, exact cleanup and restoration verification. The isolated fixture/database checks above do not replace that production lifecycle.

[Leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains disabled. Supabase documents this as a Pro-plan-and-above feature. The current billing tier was not inspected; no subscription or Auth configuration was changed. Enabling it remains a project Auth-settings task; the available Supabase connector does not expose an Auth-configuration update operation.

The frozen dependency audit still reports one low [esbuild Windows development-server advisory](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr), with no critical, high or moderate findings. Installed Vite 7.3.5 requires esbuild `^0.27.0`; the patched esbuild 0.28.1 lies outside that range. An unsupported override was not imposed. Resolve it through a compatible toolchain release or separately validated upgrade.

Paged history reads preserve complete existing frontend aggregation. Their total transfer still grows with history size; server-side summaries remain an optional future performance improvement, not a silent cap on the current results.
