# Scheduled training database verification

Verified 2026-10-04 against Training Admin (`dvcdghmcqqfvlbzufpyy`).

## Installation

Migration `20261004142817_add_scheduled_training_plans.sql` was applied through Supabase's
migration tool. It adds a constrained plan type and an optional link from a saved workout to an
active mobility practice. Existing `suggested_workouts` ownership policies and authenticated table
grants remain the access boundary.

The mobility link is guarded by an authenticated, security-invoker trigger. A mobility plan must
point to an active practice belonging to the same accessible person. Other plan types cannot carry
a mobility-practice link. Public and anonymous execution of the trigger function is denied.

## Verification

- `plan_kind` and `mobility_practice_run_id` exist on `suggested_workouts` with the expected text
  check and foreign key.
- The schedule and mobility-link indexes exist, and the guard trigger is enabled.
- Authenticated execution is granted for the guard function; public execution is denied.
- Generated live TypeScript types match the checked-in `suggested_workouts` row, insert, update and
  relationship definitions.
- The isolated PostgreSQL suite accepts a same-owner active mobility practice and rejects a
  different owner's practice, a paused practice and a non-mobility plan carrying the link.
- Security advisors are unchanged. The existing leaked-password-protection warning remains; this
  migration introduced no security warning.

## Existing data preservation

The migration inserted, updated and deleted no training data. Counts and fingerprints matched
before and after installation. For `suggested_workouts`, the post-migration fingerprint excludes
the two newly added null columns so it is directly comparable with the pre-migration row shape.

| Table                       | Rows before and after | Comparable fingerprint             |
| --------------------------- | --------------------: | ---------------------------------- |
| `suggested_workouts`        |                     8 | `7f15f85108e4baa4134c2cab4c10e1d1` |
| `suggested_workout_entries` |                    21 | `c6ccd23c9dfdbaa4c507a0997ca4abea` |
| `suggested_workout_sets`    |                    69 | `b1bd571ae58e626bdb68826464cc209c` |
| `mobility_practice_runs`    |                     4 | `eef4d93666290ff68f6293e6026d740b` |

No real weekly session, mobility practice or workout was created during verification.
