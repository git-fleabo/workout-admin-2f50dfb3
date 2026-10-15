# Signed-in release verification — 15 October 2026

The published app at `https://workout-admin.lovable.app/` passed the read-only checks below while signed in. No release regression was found in the inspected flows. This is a preview/navigation check, not a live write-lifecycle test.

## Release identity

- Local implementation and GitHub `main` both pointed to `cfd6a61e0a2856f7f393df98743e021da2d3071b` at the start of this check (`git ls-remote origin refs/heads/main`).
- The published desktop header displayed **Build `20261015T0845`**. This is a timestamp label rather than a commit identifier, so it does not prove exact source equivalence with that SHA.
- The new Today hierarchy, rescheduling preview, goal summaries/trends, and Weekly Review programme-adjustment entry point were independently observed in production.
- No push, Lovable edit, sync or publication was performed during this check.

## Observed results

| Area | Published result |
| --- | --- |
| Today | The active programme offers its next unfinished session with location selection and enabled Continue/Ease back in controls. Optional sections stay collapsed. Saved movement targets expand. No workout was started. |
| Rescheduling | Plans changed opens a dated preview covering the remaining unstarted sessions. Apply stays disabled while clashes load, then becomes available with other planned training listed. Cancel closes the preview. No dates were applied; live Undo was not exercised. |
| Goals | Weekly completed-session progress, measured best/latest/target values, and the manually confirmed milestone state render distinctly. |
| Four-week trends | Weekly totals and measured results expand with partial-week labels. Selecting an unmeasured week shows “Not measured” and explains that no performance change can be established. Returning to the current measured week restores its evidence link. |
| Source evidence | The current measured-week link opens the exact History session and its three recorded movements. The modal closes without deletion. |
| Programme adjustments | The active source-based programme offers Edit base levels and identifies its next unstarted session. A temporary input change produces an exact preview of 11 affected future sessions with old/new maxes and rounded loads. Escape closes the preview; reopening shows the original saved value. Nothing was applied. |
| Historical Review | Previous week loads the completed week. Programme editing is replaced by a read-only explanation and Review current programme, which returns to the current week. |
| Plan | Desktop week workspace loads. My Programme expands the saved overview with the next action ahead of the full weeks, supporting schedule, targets and controls. Phone layout retains that hierarchy. No schedule or programme edits were saved. |
| Logger | The empty workout form loads, Focused view changes the movement workspace, and Show all movements restores the original mode. No workout was loaded, values entered, or finish action submitted. |
| Reload recovery | Full reload restores the signed-in Today page. Training actions remain disabled while location references load, then enable when the selected location is available. |
| Runtime | No warning/error messages were returned by the browser console checks. |

## Responsive checks

Checked phone **390×844** and desktop **1440×1000**. Phone document scroll width was **390px** on Plan, Log, Review (including expanded trend content), and Today (including saved targets). The phone base-level and rescheduling dialogs each measured **388px** client width and **388px** scroll width within the 390px viewport. Desktop Log measured 1440px document width within the 1440px viewport. Desktop Today, Review, Plan and the base-level preview were also inspected.

The temporary viewport override was reset. The browser was left signed in on Today with no dialog open.

## Preservation and remaining coverage

No live start, save, finish, skip, apply, correction, deletion, import or restore action was submitted. The temporary base-level input existed only inside the cancelled preview; reopening confirmed the original saved value. The logger was returned to its original view mode.

No database migration, direct database write or live fingerprint comparison was performed in this pass. Consequently this report does not claim independently proven database-wide equality. The current account exercised the source Base Strength programme path; generic personal/adaptive approvals and Bullmastiff plus-set approvals retain the isolated coverage recorded in `weekly-programme-adjustments-verification-2026-10-15.md`, rather than fresh production write coverage.

Live start/finish, offline retry, approval persistence, stale-write rejection and exact cleanup remain a separately authorized disposable-record lifecycle test. Existing repository validation was not rerun because this pass changes documentation only.
