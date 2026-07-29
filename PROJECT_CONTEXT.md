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

## 2026-07-29 Programme Start, Rest, And Location Follow-up

- Active programme workouts do not appear on Today before their configured Mon/Wed/Fri date,
  calculated from the assignment start date plus each template workout's week/day position.
- Main-lift prescriptions include percentage-sensitive rest guidance: 120–150 seconds below 70%,
  150–180 seconds from 70%, 180–210 seconds from 80%, and 210–240 seconds from 87.5%.
- The chosen rest interval is visible in Today and prefilled into the unified logger.
- Programme sessions select an exact named training location, remember the latest choice, and default
  to the remembered location (The Font for the current user) when all mapped lifts are available there.
- Main lifts and optional power/accessory/pull choices use the existing Library contract based on
  `exercise_equipment_items` plus `training_location_equipment`; changing the named location
  immediately filters the optional pools.
- Starting a programme session persists that exact `training_location_id` instead of choosing the
  first active location with the same Home/Gym kind.
