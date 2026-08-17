# Workout Admin Project Context

The canonical, detailed handoff for this repository is [`workout_context.md`](workout_context.md).
Read that file before database, programme, Library, logging, or deployment work.

## 2026-08-17 Supabase Hardening And Schema Cleanup

- The linked Training Admin project has no remaining `simple_strength_*` tables. They were empty,
  unused by workout-admin, and removed by
  `supabase/migrations/20260817105254_remove_unused_simple_strength_schema.sql`.
- The generated Simple Strength definitions were removed from `src/lib/database.types.ts`.
- `supabase/migrations/20260817103920_add_explicit_authenticated_roles_to_workout_policies.sql`
  makes the workout suggestion/method policies explicitly authenticated-only.
- `supabase/migrations/20260817104538_revoke_anon_workout_table_privileges.sql` removes all anon
  table privileges from the suggestion and method tables. Live verification confirmed no effective
  anon privileges while authenticated access remains available.
- The linked Supabase migration ledger contains historical versions absent from this checkout. The
  two 2026-08-17 migrations were applied narrowly through the linked SQL API and recorded in the
  remote ledger; do not run a blanket `supabase db push` until the migration-history divergence is
  deliberately reconciled.

## 2026-08-03 Navigation And Visual Hierarchy Refresh

- Mobile uses a persistent bottom navigation for Today, Log, Plan, and Review; desktop keeps the
  existing header navigation.
- History groups workout movements into their parent session, while preserving individual climbing,
  strength-test, and bodyweight entries.
- Plan and Dashboard use readable vertical week agendas on narrow screens instead of compressed or
  horizontally scrolling seven-day cards.
- Dashboard and Weekly Review label missing workout duration as not recorded and avoid presenting an
  empty adherence bar as measured zero progress.
- Progress puts the decision, headline statistics, and charts first; method and plan comparisons are
  available in a collapsed deeper-analysis section.
- Logger location and mode selection are more explicit, and the review/finish action stays available
  above mobile navigation without using the completion gradient while disabled.
- Settings removes speculative placeholders, moves Data Quality into Maintenance, and collapses the
  block-height reference. Library cards are quieter on mobile and destructive actions live in a
  secondary menu.
- Page-specific colour remains a restrained semantic accent system rather than separate full-page
  themes. Decorative subtitles were removed where they did not explain an action or data state.

## 2026-08-03 Monthly And Annual Training Stories

- History adds one compact narrative recap when Month or Year is selected; Week and Quarter remain
  unchanged.
- Stories are derived from the existing timeline and summarise active days, parent sessions,
  movement variety or repetition, the busiest month, recorded training time, climbing, and PRs when
  those facts are available.
- Movement rows from one workout count as one parent session, and the story always describes the
  whole period even when the visible History list is filtered.
- The logger remains deliberately focused: no timer, plate-loading tool, or warm-up calculator was
  added.

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

## 2026-07-29 Programme Schedule In Plan

- Plan's `Next 7 days` strip now layers active programme sessions onto their fixed assignment dates.
- Programme items are visually distinct from history-derived Home/Gym/activity predictions and
  cannot be removed by the device-local Adjust controls.
- Each scheduled item shows its week/session and mapped main movements in advance.
- The schedule is read-only: Today remains the only place that offers and starts a due programme
  session, Log records it, and completion remains the only action that advances the assignment.
- The schedule reuses the existing programme/template/assignment reads. No new table, write path, or
  schema migration was added.

## 2026-07-29 Programme Adherence In Weekly Review

- Weekly Review now separates ordinary saved-plan adherence from scheduled programme adherence.
- Programme adherence is calculated from fixed assignment dates, so a past due session can be
  classified as missed even when the user never pressed Start.
- The review shows due, on-time, late, outstanding, missed, and skipped programme sessions and uses
  completed/due for the programme percentage.
- Current weeks only assess programme dates through today; future Mon/Wed/Fri sessions are not
  counted early.
- Strength-volume highlights show the actual current and comparison totals instead of a potentially
  misleading large percentage. Low comparison baselines are labelled explicitly.
- This is a read-only aggregation over existing assignments, templates, linked suggestions, and
  sessions. No schema migration or live data rewrite was required.
