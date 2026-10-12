# UI follow-up verification — 12 October 2026

The remaining UI gaps from the [signed-in release check](signed-in-release-verification-2026-10-12.md) are repaired in the repository. Updated frontend publication and a signed-in check of the new build remain necessary.

## Changes

- **Plan's next action:** Go to next workout now follows the current session summary. Weeks, supporting goals/schedules, the full saved-session editor and lifecycle controls are separate disclosures. Active programmes start with those details folded. Paused personal drafts keep their editor open for advance review; activation and the explanation of an existing active run remain near the primary action. Closing details keeps their editor mounted, preserving unsaved edits.
- **Accessible fields:** movement notes have distinct stable IDs and names containing their movement number and exercise. Strength, conditioning and climbing briefs share an associated duration label that includes minutes, unique IDs and optional warm-up help. Their existing bounds, steps and update rules are retained. Sign-in/recovery inputs also have explicit names.
- **Honest loading states:** sign-in verification displays Checking sign-in until hydration/approval finishes, including when the account changes. Protected content still requires approval. Offline recovery, denial, expired-login and stale-response handling are unchanged. Today waits for training references or offers Retry training setup; genuine location incompatibility appears only after successful reads. Programme starts are disabled after a failed reference refresh, even if old cached references remain. A strength brief with existing candidates prompts the user to build a preview instead of claiming that no history exists.
- **Display copy:** programme summary/session-choice labels avoid adding a second copy of a saved week label. Singular movement, set and rep wording is corrected in the reviewed Today/logger/Plan/saved-session/history displays. Saved names, prescriptions, numerical history and progression rules are unchanged.

## Verification

| Check                         | Result                                               |
| ----------------------------- | ---------------------------------------------------- |
| Node/unit/database suite      | 296 passed; no failures or skips                     |
| Component suite               | 170 passed across 38 files                           |
| TypeScript                    | Passed                                               |
| Production client/SSR build   | Passed                                               |
| Frozen Bun 1.4.3 installation | Passed; dependencies and lockfile unchanged          |
| ESLint                        | No errors; eight pre-existing React refresh warnings |
| Diff whitespace               | Passed                                               |

The new regressions cover server rendering and pending approval without a credential-form flash or protected-content exposure; account changes and genuinely missing sessions; delayed, failed, retried and stale training-reference reads; genuine location mismatch; named, distinct movement-note controls and duration labels; and next-action order, paused-draft visibility, unchanged assignment data and unsaved edits retained across disclosure changes. Existing approval denial, offline recovery, saves, programme activation, backups and database journeys continue to pass.

A local browser fixture used the real programme-overview/auth/duration components, app styles and 54 mocked saved sessions, with writes disabled. At 390×844 the next-workout link began at **519px**, within the first screen. It began at **415px** at both 768×1024 and 1440×1000. No horizontal overflow was observed with details folded or expanded. All four overview disclosures started closed for the active run; opening/closing targets retained an unsaved edit. The native accessibility tree named the duration control and showed Checking sign-in during delayed approval. These are fixture measurements, not measurements of a newly published production build.

Local screenshots: [phone overview](/Users/noam/Documents/Codex/gym-sheet-flow/workout-admin/workout-admin-2f50dfb3/ui-followup.local/plan-phone.png), [desktop overview](/Users/noam/Documents/Codex/gym-sheet-flow/workout-admin/workout-admin-2f50dfb3/ui-followup.local/plan-desktop.png). Fixture files/screenshots are ignored and were not committed.

## Release boundary

No live database operations, schema/Auth configuration changes, Git push or Lovable publication were performed for this follow-up. The user can sync/publish the repository changes, then repeat the signed-in UI checks on that build. Existing climbing-grade metadata and live start/save/offline retry/correction/restore tests remain outside this UI work. Those live write tests still require a separately authorized disposable workflow with a baseline and exact restoration. The password-protection and development-tool advisories remain separately tracked.
