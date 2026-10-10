# Base Strength personal programmes — 10 October 2026

Volume/Intensity and Bullmastiff can now be set up from their Programme Library previews. Choose enabled Strength exercises, each main lift's and variation's own phase-specific estimated 1RM, load rounding, location, start date and personal supporting targets. Saving creates a paused personal version through the existing person-scoped `create_personal_programme` flow. It does not replace or start the current programme.

## Prescriptions and personal choices

- Volume/Intensity retains the configurable base, heavier-base and peak waves. Percentage work follows the saved calendar targets; AMRAP sets retain the source's effort guidance. Peak top sets use RPE 7 and require a personally chosen load. Row and chin-up sets and reps are supplied by the user.
- Bullmastiff retains 18 weeks and 72 sessions. Main lifts keep their source set/rep waves, variations use their own maxes, and the first two base accessory waves keep the printed prescriptions. Third-wave base and peak accessory targets come from explicitly entered personal choices.
- Later-phase maxes may remain blank during setup. Unknown percentage loads, RPE-based top-set loads and performance-dependent Bullmastiff loads remain blank until reviewed. Starting rejects missing loads and unresolved percentage references. Future sessions can be edited through My Programme; entering a reference max recalculates that session's percentage loads.
- Personal dates use the existing relative programme schedule. Sessions use Day 1/3/5 or Day 1/2/4/5 labels so choosing a start date other than Monday does not give a misleading weekday name.
- Generic copy-to-later-session controls are hidden for these source plans, and generic strength-week reductions are excluded in the model and database. Review future sessions individually to preserve periodisation, or explicitly choose personal progression rules.

## Linked progression

My Programme shows a separate “Review completed plus set” action for future Bullmastiff main-lift sessions. The server matches the preceding programme week by assignment, workout, movement key, exercise ID and recorded movement order. It uses the linked completed session and its actual individual sets. Standalone logs, supporting plans and previous runs cannot supply the evidence.

Within a wave, every prescribed set must be complete and meet its rep target, with a consistent known external load and no aggregate or special-method sets. The original started prescription must match the saved source prescription; easier or reviewed reductions require a separate decision. Extra final-set reps add 1% of the reference 1RM per rep to the actual working load, then round once. No extra reps hold the actual load. New waves reset to the next starting percentage, and the peak phase requires its own reassessed reference max.

The user sees the previous final-set performance, proposed load and explanation before clicking “Apply to this session”. Approval updates only that future movement's loads. Assignment locking, revision checks, an evidence fingerprint and started-session guards reject stale decisions. The fingerprint is checked again at session start so later changes to the linked log cannot silently reuse an old approval. Completed prescriptions and logs remain unchanged. Restarting these programmes creates a paused run and clears previous-run plus-set approvals and dependent loads.

## Database delivery

`supabase/migrations/20261010134112_add_base_strength_personal_programmes.sql` adds shared sequence scaffolds for Bullmastiff and the supported Volume/Intensity durations, source-rule validation, progression review/apply functions, source snapshot/start guards and restart handling. All functions use security invoker with an empty search path; existing assignment/session RLS protects personal data, and public/anonymous execution is revoked. Shared scaffolds contain no personal exercises or loads and are hidden from the ordinary template cards; the two Base Strength previews are the setup entry points.

Programme sequences are fetched per template, so the extra scaffolds cannot truncate another programme at the API's global row limit.

After user approval, the migration was applied to the live Train & Track Supabase project (`dvcdghmcqqfvlbzufpyy`) on 10 October 2026. Remote migration history records `20261010134112`; the local filename and database test reference match that version. All required preceding migrations were already present, including personal strength-week reviews. The app frontend has **not been published or synchronised through Lovable**. A signed-in save in the released frontend remains unverified.

## Live database verification

- Six source scaffolds contain 432 workouts: Bullmastiff has 72 across 18 weeks; Volume/Intensity has 54, 63, 72, 81 and 90 across 18–30 weeks. All sequence indices are contiguous from zero, all week counts match their durations, and no shared exercise prescriptions were inserted.
- All eight new or replaced functions use security invoker and an empty search path. Authenticated execution is granted and anonymous execution is denied. All five new guards/snapshot triggers are enabled; assignment and personal programme/session tables retain RLS.
- The Data API recognises the new read-only progression RPC. An anonymous request receives the expected permission-denied response (`401`, PostgreSQL `42501`), rather than a missing-function/schema-cache error. This verifies registration and anonymous denial, not a signed-in save.
- Before/after counts and complete-row fingerprints match for assignments, personal programmes, personal sessions, suggested workouts, logged sessions, session entries and sets. No personal programme was created or activated during verification.
- After matching the local migration filename to remote history, the isolated Base Strength database regression suite was rerun: nine tests passed, none failed or skipped. The migration SQL itself is unchanged.
- Security and performance advisors introduce no new findings. The existing [disabled leaked-password protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains. Existing performance notices are two [unindexed foreign keys](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) and 53 [unused indexes](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

## Verification

- Full Node suite: 230 passing tests, including real isolated PostgreSQL lifecycle/regression cases, with no skipped database tests. Added targeted checks also pass for standalone/support exclusion, cross-person apply denial, wave resets, a distinct peak max, protected completed history and cleared restart state.
- Component suite: 67 passing tests. Personal setup calls only the paused create flow, database-unavailable errors remain visible, linked evidence is displayed before a separate apply click, and the exact displayed revision/fingerprint is sent. Existing programme editor and coaching component coverage remains passing.
- Type checking, production build and lint pass. Lint retains existing fast-refresh warnings plus a warning in the ignored local review harness; no lint errors.
- Actual setup and progression components were inspected in a local browser harness with example exercises. The setup prepared 54 demo sessions without writing training data. Both 445 px and 1280 px layouts were checked for horizontal overflow; none was present. The progression review showed 70 kg / 11 reps / 100 kg reference max producing a 75 kg next load.
- The harness is explicitly labelled as a local example; it is not evidence of a signed-in live save or live deployment.

Source basis: Alex Bromley, *Base Strength: Program Design Blueprint*, Kindle ASIN B08R5J58F8, Volume/Intensity pp. 83–85 and Bullmastiff pp. 93–97, reviewed in the signed-in reader. See the programme catalogue and initial preview verification documents for source gaps and interpretation boundaries.
