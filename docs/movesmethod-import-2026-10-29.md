# Movesmethod Mobility Toolkit import — 29 October 2026

Status: added to Noam's live Mobility & Recovery account. All five routines start paused,
with manual day/week selection and no calendar schedule. The programme data is available now.
The accompanying quick-reference target-label correction is local and still needs publication.

## Source and fidelity

Read directly from the user's signed-in Firefox course:

- [Mobility Toolkit by Movesmethod](https://www.skool.com/movesmethod/classroom/828d6756)
- [How to use this toolkit](https://www.skool.com/movesmethod/classroom/828d6756?md=9e3ad9537ad34c35be6d713886ff59f2)
- All 24 daily lesson pages, all seven joint index pages, progression/injury guidance and the
  supplementary material catalogue. Original videos remain on the provider's site; no transcripts
  or full teaching prose were copied.

`src/lib/movesmethod-source.ts` retains the factual catalogue and doses. Its expanded facts match
the browser capture's independent 32-bit FNV-1a fingerprint, `45d0d061`. Pattern compression only
deduplicates verified rows; it does not calculate a generic weekly progression.
`src/lib/movesmethod.ts` builds and validates the five personal routine inputs. It is import
support code, not an automatic page-load seed.

## Live records

| Routine                  | Sessions | Contents                                                  | Record ID                              |
| ------------------------ | -------- | --------------------------------------------------------- | -------------------------------------- |
| Week 1                   | 6        | 5 measured + Flow 1                                       | `9eb59418-c663-42b1-b57e-7b8d8fad54b2` |
| Week 2                   | 6        | 5 measured + Flow 2                                       | `3ffeec87-982c-4ff1-9914-98f54917b057` |
| Week 3                   | 6        | 5 measured + Flow 3                                       | `3524f805-55e6-4e53-a3fe-98977e2fc494` |
| Week 4                   | 6        | 3 measured + Flows 1, 2 and 3                             | `3c968d8e-56cd-46b3-838c-a1e50539205b` |
| Optional joint resources | 7        | Shoulders, spine, hamstrings, hips, knees, wrists, ankles | `86785d3f-066d-4377-ad34-470018f7daa7` |

Owner: existing Noam profile `c497a408-8f8a-4efb-903a-5c2109d96797`. The insert checked the exact
active profile and existing self-admin relationship. A single atomic statement inserted only
absent named routines using fixed prepared IDs, with no existing-record updates. Creation times
are separated by milliseconds to retain source week order in the existing ascending reader.

The 18 measured sessions retain 166 written movement prescriptions. Six flows have no written
round/rep/hold prescription, so each remains a linked quick practice. The optional joint indices
contain 34 demonstration references; these are choices, not seven prescribed circuits. Notes
explain that completion means the selected practice only, not every listed drill.

## Prescription handling

- The guide conflicts internally: six days per week, but also five active days plus two rest
  days. The six actual lessons per week are retained; no weekday calendar was guessed.
- All loads remain blank. Added-load fields mean total external load; bands, assistance and
  setup belong in technique notes. No measured result, completion, symptom or readiness decision
  was imported from provider ticks or inferred from a prescription.
- Thoracic rotation/extension targets say ten total and clarify five per side. The logger uses
  five reps on each separate side, preventing an accidental twenty-rep total.
- Exact hangs/balances are seconds. Jefferson Curl lowering tempo is not a hold. Ten-second
  pauses on the final rep stay in guidance, not a ten-second target on every repetition.
  Thoracic Extensions retain two pauses per rep in notes; the scalar target is one two-second
  pause. Standing Pullover retains its two-second bottom pause.
- Wrist Rock counts remain per direction; directions are not reinterpreted as body sides.
- Shoulder Protocol stays one linked sequence: its twenty reps are per demonstrated movement,
  not twenty total. Notes describe recording uniform counts only, or leaving numeric reps blank
  and explaining different per-movement counts. No unverified component exercises were invented.
- Hamstring Curls' written dose has a trailing incomplete slash. Single Leg Squat to Box does
  not explicitly say whether its count is per leg or combined. Both ambiguities are flagged,
  with no additional side multiplier.
- Flows and joint references use quick completion and no actual set results. The schema's one
  reference row is explained as bookkeeping, not a source-prescribed set. The logger correction
  hides that target line only when quick practice has no explicit dose/load/hold and one row;
  existing quick practices with explicit targets still display them.
- Session minutes are clearly labelled app estimates, separate from video length: measured
  sessions show 25/35/45 minutes by week; flows/joint choices show ten. These are not course facts.
- No automatic activation, day advancement, notifications or combined scheduling with Shoulder
  Blueprint was introduced. Morning checks are off.

## Verification and use

- All five saved payloads exactly match the validated import, have the correct owner and version 1.
- Fourteen source/import/recovery logic tests and five focused component tests pass. TypeScript,
  focused ESLint, formatting and production build pass.
- Before/after full-row fingerprints match for all twelve checked existing tables: 137 workouts,
  252 entries, 497 sets, 213 metrics, three strength assignments, forty suggested workouts, four
  toolkit runs, two drills, 389 shared exercises, 337 person-exercise settings, four existing
  Shoulder Blueprint routines and zero dedicated recovery sessions. New routine IDs were excluded
  only from the existing-routine fingerprint. No schema, policy or shared library changes.
- Published UI shows all four weeks and all seven optional joint templates. Week 1's editor
  loads six sessions with the expected flow/measurement choices and targets. It was closed
  without saving. No live session was started or logged. The local target-label correction was
  checked by component tests; it has not yet been published for a live browser check.

Open Mobility & Recovery → Paused & archived → Movesmethod · Mobility Toolkit · Week 1 → Edit
routine → Routine details and status → Routine status. Choose Active, review and save when ready.
Choose numbered days manually; activate later weeks when wanted.

The existing environment marks `.git` read-only, so committing may need GitHub Desktop. Publish
the small logger change through the usual GitHub/Lovable workflow. The imported programme data
does not depend on that release.

[Live Week 1 screenshot](movesmethod-live-2026-10-29.jpg).
