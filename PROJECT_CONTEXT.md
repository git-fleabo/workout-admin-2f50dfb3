# Workout Admin Project Context

The canonical, detailed handoff for this repository is [`workout_context.md`](workout_context.md).
Read that file before database, programme, Library, logging, or deployment work.

## 2026-07-28 Adaptive Strength Engine

The repository now contains a local implementation of the agreed reusable 12-week adaptive strength
programme:

- 36 Monday/Wednesday/Friday sessions on the existing programme/suggested-workout/logging model.
- Training Max defaults for Bench Press, High Bar Squat, Deadlift, Seated Dumbbell Press, and a
  disabled Weighted Pull-Up stream.
- Percentage ranges, lift-specific RPE caps, conservative squat/deadlift prescriptions, heavier bench
  progression, and Week 12 deload/review.
- Assignment-owned power/accessory/pull choices sourced from the existing exercise Library.
- Optional pain, technique, and existing set-RPE evidence feeding progress/repeat/regress decisions.
- Subsequent-cycle generation with lift-specific Training Max increases and prior-cycle linkage.
- Pull-up reintroduction is an explicit enable/disable hook only; the app does not prescribe medical
  rehabilitation.

The additive schema and template seed are tracked in
`supabase/migrations/20260728214855_adaptive_strength_programme_engine.sql`. It is applied to the
linked Training Admin project and verified for template counts, intensity caps, RLS, policies, grants,
and migration-ledger presence. See `workout_context.md` for architecture, exact design decisions, and
validation details.
