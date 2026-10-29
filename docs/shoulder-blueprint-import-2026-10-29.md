# Shoulder Blueprint import — 29 October 2026

Status: added to Noam's live Mobility & Recovery records. No frontend release is required to use
the routines. This is a personal data import, with no schema, permission or shared Library changes.

## Source

The user's signed-in Firefox course was reviewed directly:

- [The Shoulder Blueprint](https://theptinitiative.mykajabi.com/products/the-shoulder-blueprint)
- [How to use the programme](https://theptinitiative.mykajabi.com/products/the-shoulder-blueprint/categories/2153923406/posts/2171821965)
- Six weekly module pages covering all 30 numbered days, plus the bonus prevention module.

The source specifies three phases of two weeks each, with five sessions per week. Rest days can
move. Phase progression depends on the user's form and symptoms; repeating a phase is allowed.
The bonus routines are for after the main programme, as optional warm-ups/accessory work.

Only exercise names, prescriptions and lesson references were imported. Course videos,
transcripts and explanatory prose were not copied. The structured source transcription has
matching `938b707d` fingerprints before/after transfer from the browser (32-bit FNV-1a), and the
saved database JSON was separately checked for exact equality with the validated import payload.

## Live records

| Routine                            | Days / templates | Exercise prescriptions | Initial status | Record ID                              |
| ---------------------------------- | ---------------- | ---------------------- | -------------- | -------------------------------------- |
| Phase 1 · Foundations & Essentials | Days 1–10        | 56                     | Active         | `32c99ace-b9f3-413d-bbed-203f3d29eb34` |
| Phase 2 · Stability & Optimisation | Days 11–20       | 52                     | Paused         | `51679e16-441b-425c-a2d5-045f76d82a41` |
| Phase 3 · Progression & Resilience | Days 21–30       | 52                     | Paused         | `334a040a-c07c-4010-8ee4-bc850d257075` |
| Optional prehab & prevention       | Five routines    | 22                     | Paused         | `a5776304-9a22-4eb9-8492-2200c2e9272f` |

All four belong to the existing Noam profile `c497a408-8f8a-4efb-903a-5c2109d96797`. The import
used fixed prepared record IDs and inserted only absent records; it never overwrote a routine.
All 35 templates use the existing measured logger. The existing 12-template limit is respected
by grouping the course into its three phases rather than placing 30 days in one routine.

Open Mobility & Recovery → Shoulder Blueprint · Phase 1 → Day 1 → Start. Choose numbered days
in order; the existing recovery system does not automatically advance course days or phases.
Later phases and bonus routines are under Paused & archived. To activate one, use Edit routine
→ Routine details and status → Routine status, then review and save.

Sessions are manual/unscheduled, so the course can start on any day and does not generate a
calendar backlog. The displayed 20-minute main-session and 15-minute mobility/bonus durations
are labelled as app estimates in each session's notes, not course-prescribed durations.

## Target fidelity and uncertainties

- All 182 prescriptions keep their own lesson URL and original dose in setup guidance. Main
  course days retain exercise order, including every fifth day's mobility work.
- Fixed kg values stay blank. The course's 8–10 lb press example is preserved as guidance with
  its approximate kg equivalent, not turned into a chosen load or an automatic progression.
- Time ranges stay ranges in guidance; the single-value hold field stays blank for a range.
  Exact timed targets are converted to seconds. Repetition tempo is not converted into a hold.
- Where the source gives one dose without a set count, one logging row represents that dose;
  the guidance explains this. Explicit per-side work uses separate left/right actuals. A carry's
  per-leg steps, circle directions and a plank movement's complete cycle are not doubled into
  left/right arm sets.
- Day 15's Banded Thoracic Rotations title says 3 × 6 per side while the description mentions
  five rotations. The saved target follows the title and flags the discrepancy beside the link.
- Bonus Routine 2's Seated Overhead Mobilization title omits the unit for its “2 hold”; Bonus
  Routine 3's Banded Overhead Flexion Stretch omits the hold length. Those scalar targets stay
  blank, with notes to check the demonstrations.
- Custom movement records use stable namespaced identities, with minor spelling/plural aliases.
  No uncertain shared Library match was forced. Morning checks remain off; optional symptoms
  and actual results remain unknown until the user records them.
- Provider lesson-completion ticks were not treated as completed workouts. No sessions were
  started or logged during verification.

## Verification

- Ten programme-import and existing recovery logic tests pass, including all 30 day identities,
  all lesson references, the 160 + 22 prescription counts, ranges, tempo, step counts, source
  ambiguities and blank actuals/loads. TypeScript, focused ESLint and the production build pass.
- Each saved routine matches every imported field and template exactly, has the correct owner
  and remains at version 1.
- Counts and full-row fingerprints are unchanged for all checked pre-existing records:
  137 workouts, three strength programme assignments, four toolkit runs and two toolkit drills.
  Dedicated recovery sessions remain empty, with zero invented training completions.
- The signed-in published app shows the active Phase 1, all later paused phases and all five
  bonus routines. The editor correctly loads the ten Phase 1 sessions and the Day 1 exercise.
  It was closed without saving any edits.

[Live programme screenshot](shoulder-blueprint-live-2026-10-29.jpg).

Reproducible source and builder: `src/lib/shoulder-blueprint-source.ts` and
`src/lib/shoulder-blueprint.ts`. These are import-support modules, not an automatic seed or a
page-load mutation. The live data is already available independently of a GitHub/Lovable release.
