# Review, progress and backup verification — 11 October 2026

The third repair milestone addresses A6, A7, A8, A9 and A13 from the [app audit](app-audit-2026-10-11.md). The repository changes are verified, and the review-ownership migration is installed. Frontend publication and signed-in production validation remain outstanding.

## Review and programme guidance

Weekly Review counts completed strength plans only when they have both a programme assignment and programme workout link, a completed plan status and a completed session dated within the review period. Session identities are deduplicated. Assignment-linked support completions have a separate counter and highlight; standalone extra plans retain their separate adherence totals. The progression rules and saved training records are unchanged.

Base Strength's saved programmes now explain their existing review workflows instead of reporting nonexistent missing sessions. Volume/Intensity points to saved wave targets and phase-specific estimated 1RMs. Bullmastiff points to the explicit completed-plus-set review and approval controls. DUP points to saved targets and the existing peak back-off calculation. Each has a link to the saved programme in Plan. Started and unavailable generic personal sessions receive different explanations. This change does not apply generic temporary strength reviews to Base Strength or amend prescriptions.

## Climbing grades

The grade charts use numeric grade-order positions with original labels in tooltips and accessible summaries. V-scale, Font, French and YDS appear separately; there is no cross-system conversion or implied equal physical difficulty between grade steps. Letter and plus suffixes are ordered within the supported notation. Ambiguous/unsupported labels and missing systems remain in history and have an explicit unranked state. The chart says that highest recorded grades include attempts. The distinction between grading systems and their notation was checked against [UIAA's climbing difficulty scales](https://theuiaa.org/documents/mountaineering/THESCALESOFDIFFICULTYINCLIMBING_p1b.pdf).

## Profile backup contract

JSON now uses `backup_type: "train-track-profile"` and `schema_version: 1`. Its 55 record collections cover the public training tables except access-management rows, scoped to the selected profile and required catalogue references. The manifest records table counts, external author/reviewer profile IDs and exclusions. Shared catalogue authors' private profile rows are not copied.

Coverage includes personal programmes and exact saved session JSON/revisions; assignments, templates, pools and reviews; strength-week overlays; coaching preferences, decisions and outcomes; mobility runs, drills and assessments; equipment and location links; toolkit links; kettlebell definitions/snapshots; goals, measurements, rotations and training history; and referenced exercises, categories, tags, aliases, methods and app profiles. Inactive or disabled catalogue entries referenced by saved plans remain included.

The exporter pages every collection and batches parent IDs. It bypasses HTTP caches and requires two matching complete reads, rejecting changes caused by concurrent sync/editing rather than downloading a mixed file. It also checks identifiers, foreign-key closure, review/assignment owners and safe numeric IDs. The backup reader rejects missing tables, changed counts, unsupported versions and inconsistent external references.

CSV remains a narrower session-analysis export, including setless activities. It reads only sessions, entries and sets, independently of the profile backup and unrelated coaching/setup tables. Manage explains the distinction.

### Reconstruction proof and boundaries

The reconstruction test populates all 55 exported collections, then exports through the real browser data function with an artificially smaller server page cap. It restores the JSON into a second disposable PostgreSQL cluster using the actual public-table column/constraint snapshot, pure JSON-check helper and unique indexes, plus the new ownership invariant. It retains IDs and defers foreign keys while loading related rows, then checks them before commit. Generated columns are recomputed rather than explicitly inserted, and identity sequences are advanced beyond restored IDs; a subsequent audit-event insert is verified. Every exported collection matches field-for-field after restoration, including programme JSON/revisions, coaching outcomes, mobility data, method members/segments and equipment links.

This is a recoverable **server profile and catalogue-reference backup**. Supabase Auth accounts/credentials, access permissions, database schema/functions/security configuration, private server sync receipts/reversal snapshots and device-only drafts, pending saves, favourites and display preferences are outside its scope and listed in the manifest. Auth linkage UUIDs remain references; they do not recreate sign-in. Restoration needs a matching app schema, explicit mapping of external author/auth identities and separately configured access permissions. The isolated test uses inactive external-author placeholders to satisfy references without exporting their private rows. Reconcile any pending device saves against restored history before enabling sync, because server replay receipts are separate. No production import UI or live restore was added. Export while editing/sync is quiet; the consistency check is an application-level check across REST reads, not a database disaster-recovery snapshot.

## Ownership repair and live evidence

Migration `20261011210526_enforce_strength_review_owner.sql` qualifies the outer review owner in SELECT, INSERT and UPDATE policies. A validated composite foreign key enforces `(program_assignment_id, person_id)` against the assignment independently of RLS, with supporting unique/foreign-key indexes. Existing approval/status-change and deletion behavior remains available.

The isolated ownership test reproduces the old manager-only mismatch before applying the repair. It then verifies valid reviews for either accessible profile; rejected owner mixing, inaccessible-profile and anonymous access; privileged-write and assignment-owner-change protection; and the existing status/cascade lifecycle. The broader personal/adaptive coach database journeys also passed with the new constraint.

All 56 public tables matched the immediately captured pre-migration fingerprint: `68b0a4a6179da53f0102537ad1a7110a`. Counts remained 119 sessions, 206 entries and 399 sets. Before installation there were zero strength-review records or owner mismatches. Live metadata confirms the qualified policy comparisons and validated owner constraint. Authenticated SELECT grants exist for every public table. No live training, programme or coaching records were changed.

Security advisors still report only the existing [disabled leaked-password-protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Performance advisors retain two [unindexed foreign keys](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys); the new ownership foreign key is indexed. Unused-index notices are informational and have not prompted index removal.

## Verification

| Check                                       | Result                                                      |
| ------------------------------------------- | ----------------------------------------------------------- |
| Unit/database suite                         | 295 passed; zero failed or skipped                          |
| Component suite                             | 147 passed across 33 files                                  |
| Ownership after migration-version alignment | Six database tests passed                                   |
| Complete backup reconstruction              | Passed in two disposable PostgreSQL clusters                |
| TypeScript                                  | Passed after restoring unrelated generated route-tree drift |
| Production client/SSR build                 | Passed                                                      |
| Whole-workspace ESLint                      | Zero errors; eight existing React refresh warnings          |
| Frozen Bun installation                     | Passed without dependency/lockfile changes                  |
| Diff whitespace checks                      | Passed                                                      |

No Lovable sync or frontend publication was performed. After publishing, verify the visible build, signed-in Review/Progress and actual backup downloads independently. Any disposable live write/restore test requires separate authorization, a captured baseline, exact cleanup and restoration verification. Remaining audit work is shared control labels, mobile preview friction, pagination and advisory follow-up (A11, A14, A15).

## 14 October update

Profile backups now use schema version 2 and include programme date overrides. The reader also
accepts v1 files made before those overrides existed. The export/reconstruction fixture now includes
a revised programme date and its assignment/workout references. See
[missed-session verification](./programme-reschedule-verification-2026-10-14.md).
