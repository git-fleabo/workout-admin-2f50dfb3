# Core repair verification — 11 October 2026

The first repair milestone addresses A1, A2, A3 and A12 from the [app audit](app-audit-2026-10-11.md). The repository changes are verified. The correction migration is installed in Supabase. Frontend publication and signed-in production write validation remain outstanding.

## Changes

- **Programme offers (A1):** Today can offer the next saved personal session for Volume/Intensity, Bullmastiff and DUP programmes without requiring a generic method configuration. Saved prescriptions, approved review overlays, revisions and pending-plan duplicate checks remain in effect.
- **Exports (A2):** JSON and CSV traverse explicit parent IDs, paginate every exported table and batch ID filters. Assigned programme templates are included. CSV retains setless activities, sessions without entries and headers for an empty profile. The broader backup-contract expansion in A9 remains a later milestone.
- **Corrections (A3):** One `correct_workout` transaction rewrites a session's contents while retaining its ID, linked plans/reviews, original source metadata and mobility reference. A validation error rolls back the whole correction. Retrying after a lost response updates the same session; the browser no longer deletes either session or attempts plan relinking.
- **Reproducible dependencies (A12):** Bun 1.4.3 and `bun.lock` are authoritative; the stale npm lockfile is removed. Compatible dependency patches were applied. The root error component accepts the current router's `unknown` error type. Lint excludes existing ignored preview/generated directories. The [README](../README.md) documents installation and checks.

## Verification

Checks ran against the updated frozen Bun installation, not the old npm dependency tree.

| Check                                   | Result                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------- |
| Unit/database suite                     | 276 passed; zero failed or skipped                                        |
| Component suite, bounded to two workers | 105 passed across 26 files                                                |
| TypeScript                              | Passed, including after restoring unrelated generated route-tree drift    |
| Production client/SSR build             | Passed with Vite 7.3.5                                                    |
| Whole-workspace ESLint                  | Zero errors; eight existing React refresh warnings                        |
| Independent clean frozen installation   | Passed in a disposable directory using only `package.json` and `bun.lock` |
| Repository frozen installation          | Passed without lockfile changes                                           |
| Dependency audit                        | One low advisory; no critical, high or moderate advisories                |
| Diff whitespace checks                  | Passed                                                                    |

Regression coverage exercises all three personal programme families, reviewed prescriptions and start parameters, duplicate pending plans, exports beyond 1,000 rows and below the requested server page cap, profile isolation, empty/setless CSV output, and both actual download-file creation paths with mocked database responses.

The correction tests use a disposable PostgreSQL cluster and the real migration/writer. They verify owner and anonymous-access rejection, invalid/late-failing payload rollback, sets/metrics/method blocks and mixed activities, retained plan/review/mobility links and source metadata, retry after an uncertain response, and compatibility with ordinary `save_workout`. The six correction database tests also passed after aligning the local migration filename with Supabase's recorded version.

One low [esbuild Windows development-server advisory](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr) remains in Vite's dependency range. Its fixed version is outside that range; no incompatible override was imposed. These checks did not demonstrate exposure on this macOS development environment or the production build.

## Live backend evidence

Migration `20261011150503_correct_workout_atomically.sql` is installed on the Train & Track Supabase project. `correct_workout`, the shared writer and `save_workout` use invoker security and an empty search path. Authenticated execution is available; anonymous execution is denied. Child-delete policies enforce ownership through the session's training profile.

All 56 public-table fingerprints matched the pre-migration baseline: `f7f9a378fc58d95d9dde57b1e823a160`. The database still contained 119 sessions, 206 entries and 399 sets at verification. Applying this schema migration did not change training rows. The security advisor continued to report the existing disabled leaked-password-protection warning; no new security advisory appeared.

## Publication and remaining validation

No Lovable sync, frontend publication or live workout correction was performed. The repository checks and database migration do not prove the published frontend uses these fixes.

After syncing and publishing, verify the visible build, the next personal programme offer and export downloads while signed in. A disposable start/log/correct lifecycle needs separate authorization to create training records, a captured baseline, exact cleanup and confirmation that the baseline is restored. Remaining audit findings stay open, including offline saving, idempotent new-session replay and session recovery (A4, A5, A10).
