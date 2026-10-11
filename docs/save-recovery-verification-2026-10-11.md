# Save and recovery verification — 11 October 2026

The second repair milestone addresses A4, A5 and A10 from the [app audit](app-audit-2026-10-11.md). Workout and climbing saves now have a durable operation ID, local pending storage and atomic server reconciliation. The repository changes and backend migration are verified; frontend publication and signed-in production write validation remain outstanding.

## Saving and retrying

The normal workout and climbing loggers retain a save on the device before resolving exercise references or issuing a write. An offline finish does not need an exercise lookup. The queue stores the entered workout, profile, plan and mobility provenance. Once connected, it prepares and freezes the validated RPC payload before the first write. Further attempts use the same operation ID and payload, including after reload or a lost response.

Each pending operation has its own storage entry. Overlapping retries share in-flight work; Web Locks serialize sync across supporting browsers and tabs. A new save enqueued during sync cannot be overwritten by an older queue snapshot. A late failed tab cannot resurrect an operation another tab confirmed. In browsers without Web Locks, the server receipt still protects replay.

`save_workout_once` creates a private receipt, saves the session and completes its suggested plan in one transaction. Concurrent copies of an operation return the same session. The receipt contains a SHA-256 payload fingerprint, not a second copy of the workout. A reused ID with different contents is rejected. Failed plan completion rolls back the session, child rows and receipt together. Strength progression happens once; supporting work does not advance it. Mobility association is retained. Deleting a confirmed session does not let a delayed replay recreate it.

The logger resets its form after a durable offline finish. The pending banner shows the saved-on-device count, connection state, retry errors and a retry action. An unchanged draft is cleared on confirmation; newer work remains. Climbing now has an account-scoped draft and a movement ID retained across reloads. Storage failures are reported before issuing an unretained save.

## Sign-in recovery

Parallel requests share a refresh promise, and supporting browsers serialize token rotation across tabs. A late 401 uses an already refreshed token. Stale refresh responses cannot overwrite a logout, another account or newer credentials. REST responses check the account again after asynchronous JSON parsing.

Transient verification/network/service errors preserve sign-in and local work, with a retry action. A previously verified account can use cached logger references offline; an account without a prior approval cannot enter the app through that fallback. Explicit approval denial or expired credentials returns to sign-in while retaining account-scoped drafts and pending saves. Account changes clear query caches and close the previous account's app view. Writes still require server authorization. These choices follow [Supabase's session and refresh-token guidance](https://supabase.com/docs/guides/auth/sessions).

## Verification

| Check                             | Result                                                      |
| --------------------------------- | ----------------------------------------------------------- |
| Unit/database suite               | 282 passed; zero failed or skipped                          |
| Component suite                   | 136 passed across 30 files                                  |
| Migration after version alignment | All six save/replay database tests passed                   |
| TypeScript                        | Passed after restoring unrelated generated route-tree drift |
| Production client/SSR build       | Passed                                                      |
| Whole-workspace ESLint            | Zero errors; eight existing React refresh warnings          |
| Frozen Bun installation           | Passed without dependency or lockfile changes               |
| Diff whitespace checks            | Passed                                                      |

The tests use mocked browser requests/storage and disposable socket-only PostgreSQL clusters. Coverage includes offline finish before reference preparation, loss of connectivity during preparation, reload, committed saves with lost/unreadable responses, new work during sync, quota failure, concurrent callers, independent tabs with and without Web Locks, stale acknowledgements, plan rollback, strength/support/mobility behavior, account isolation, parallel expiry, transient verification, and stale responses after logout/account changes. Database tests execute the actual writer, plan-completion and receipt migrations.

## Live backend evidence

Migration `20261011175107_save_workout_once.sql` is installed. The new RPC uses invoker security and an empty search path. Authenticated execution is enabled; anonymous execution is denied. The private receipt table has RLS with profile-scoped SELECT, INSERT and UPDATE policies, plus a session foreign-key index.

All 56 public tables matched the immediately captured pre-migration fingerprint: `68b0a4a6179da53f0102537ad1a7110a`. Counts remained 119 sessions, 206 entries and 399 sets; the receipt table contained zero rows. No live workouts were created, corrected or deleted. The security advisor still reported only the existing [disabled leaked-password-protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Publication and practical limits

No Lovable sync or frontend publication was performed. After publishing, verify the visible build and the signed-in flows independently. A disposable live start/offline-finish/sync/retry lifecycle needs separate authorization to create training records, a captured baseline, exact cleanup and confirmation of restoration.

Offline reload requires opening the app and logger online first so their shell/assets and references are cached. Pending work belongs to this browser/device and original account; clearing browser storage removes it. Reference caching is for logger/library setup, not coaching or training-history decisions. Workout corrections retain their editable draft and use the existing atomic correction endpoint when connected. The new durable queue covers workout and climbing saves, not 1RM/bodyweight forms.

Older queue entries written before operation IDs are preserved but are not automatically replayed: they may already have committed without a response and cannot safely be assigned a new receipt afterward. The app flags them for review against history and their retained drafts. Backend-rejected pending operations remain visible with their error; retry after resolving the reported plan/profile/reference issue. Other audit findings remain separate milestones.
