# Pike & Head to Toe and Bridge mobility pilot

Status: design for review, 30 September 2026. No programme, assessment, or workout data has been created.

## Purpose

Give the user one clear place in Train & Track to follow personal Pike & Head to Toe and Bridge practices while continuing their existing training programme. The two skills have separate phases, measurements, drill lists, and history; Bridge also has a readiness check. The toolkit remains the source for assessment instructions, drill demonstrations, and individualised prescriptions. Train & Track records the user's chosen plans, measurements, sessions, and progress.

## Source flows observed

### Pike & Head to Toe

1. Open the toolkit's [Pike & Head to Toe Assessment](https://www.matthewismith.com/products/mobility-flexibility-toolkit/categories/2156535269/posts/2182813313). Its lesson covers five tests and a repeatable filming setup.
2. Use the [Touching Toes Individualised Program builder](https://www.matthewismith.com/products/mobility-flexibility-toolkit/categories/2156535269/posts/2182876546) on the toolkit site. The embedded form asks for assessment angles and sends the individualised programme by email. Train & Track does not submit this form or infer its output.
3. Enter the chosen exercises and targets from the received programme into Train & Track. Keep [How to Read Your Program](https://www.matthewismith.com/products/mobility-flexibility-toolkit/categories/4547878/posts/2180210255) and relevant drill lessons as links.
4. Log practice in Train & Track; repeat the assessment when the user decides it is time to review a phase.

### Bridge

1. Start with [Am I Ready to Train Bridge?](https://www.matthewismith.com/products/mobility-flexibility-toolkit/categories/2154754548/posts/2185116156). Its embedded check uses left and right shoulder-flexion measurements to suggest whether to start with Bridge or shoulder work. Train & Track records the user's chosen readiness state; it does not calculate or override the toolkit's result.
2. When ready, open the [Bridge Assessment](https://www.matthewismith.com/products/mobility-flexibility-toolkit/categories/2157012532/posts/2185295227). The programme builder identifies five assessment tests.
3. Use the [Bridge Individualised Program builder](https://www.matthewismith.com/products/mobility-flexibility-toolkit/categories/2157012532/posts/2184901013) on the toolkit site. It asks for assessment angles and sends the individualised programme by email. Train & Track does not submit the form or infer its output.
4. Enter the selected exercises and targets from the received programme into Train & Track. Keep the toolkit's [Bridge General Warm Up](https://www.matthewismith.com/products/mobility-flexibility-toolkit/categories/2159951865/posts/2184253564), [Bridge Cooldown](https://www.matthewismith.com/products/mobility-flexibility-toolkit/categories/2159951865/posts/2184909418), and chosen drill lessons as links.
5. Log Bridge practice and repeat the assessment or readiness check when the user decides to review it.

The source site's [terms](https://www.matthewismith.com/pages/terms) grant personal, noncommercial access and restrict copying or harvesting for redistribution. Store lesson links, the user's own measurements and notes, and user-entered targets. Do not store course videos, PDFs, lesson text, or an automated copy of the catalogue in the repository or database.

## User experience

### Plan

Add one compact **Mobility practice** area after **My programme**, so the existing strength programme stays the primary plan. Give Pike and Bridge their own row, each showing current phase or readiness, last practice, latest assessment date, and one next action:

| Skill and state | Main action |
| --- | --- |
| Bridge, readiness not checked | Open Bridge readiness check |
| Bridge, shoulder work suggested | Revisit readiness when ready; keep Bridge practice on hold |
| Either skill, no assessment | Open that skill's assessment lesson |
| Either skill, assessment recorded but no personal plan | Open that skill's program builder |
| Either skill, plan received but no drills entered | Add drills and targets from my plan |
| Either skill, practising | Log that skill's practice |
| Either skill, review date reached | Record a new assessment |

Secondary actions for each skill: view measurement history, open toolkit resources, edit phase or targets, pause/end practice. Pausing or ending either skill must keep its measurements and completed workouts. The two skills may be active at the same time.

### Today and Log

Show compact Pike and Bridge practice actions on Today when each is active and ready to practise. They must not displace the main workout action or mark the main programme session complete. Starting one opens the existing workout logger with that skill's saved drill list. The user can change or omit drills on the day. Each drill uses its appropriate existing tracking mode: reps and load for strength movements, seconds for holds, and distance/hold/feel for a mobility position. A finished session appears in normal History and Progress and belongs to the skill the user started. Shared drills must not make one session count for both skills automatically.

### Assessments

Record dated results for each skill's assessment tests, allowing left/right results where relevant. Each result has a user-visible name, number and unit or short text result, side, and optional setup note. Keep baseline and later checks together per skill so comparisons use the same test and unit. Link to the relevant toolkit assessment beside the entry form; Train & Track should not reproduce its protocol or interpret a result as a diagnosis. Bridge also records the user's readiness outcome and check date separately from its assessment results.

The pilot should support degrees because both toolkit builders request angles. The current `mobility_position` logger captures distance in cm, hold seconds, and feel; its existing position-measurement option supports a specific block-based cm setup. Neither is a general angle assessment. Assessments therefore need their own small measurement record instead of forcing degrees into workout sets.

## Proposed storage and integration

- **Practice runs:** person-owned runs keyed by skill (`pike` or `bridge`), with status, start/end dates, current phase, optional review date, and user notes. Allow one current run per person and skill. A new run archives the previous run for that skill and keeps its history. These runs are separate from `program_assignments`, which drives the primary programme's next session.
- **Bridge readiness:** the user's recorded outcome, check date, and optional left/right measurement and note belong to a Bridge run. A "shoulders first" outcome pauses Bridge's practice action until the user updates readiness. The app does not make the readiness recommendation itself.
- **Assessment results:** dated, typed measurements belonging to a run and a skill-specific test. Preserve the original result and permit a clear correction. Index by run, test, side, and date.
- **Chosen drills:** the user's ordered list, editable targets, optional `exercise_id`, and the exact toolkit lesson URL they chose. Do not seed a fixed programme from the course. Save a reference to the relevant exercise in the existing library where possible.
- **Completed sessions:** continue using the existing workout/session tables and logger. Link each completed mobility session to the Pike or Bridge run explicitly so the card can show frequency and last practice without guessing from exercise names.
- **Access:** apply the app's existing person-based authorization to every new table, enable row level security, and index foreign keys. Keep any course URL as a reference, never an authentication token or copied media URL.

## Pilot acceptance checks

1. A user can begin Pike and Bridge practices independently without changing their active strength programme.
2. Bridge begins with the linked readiness check; recording "shoulders first" keeps Bridge on hold while Pike remains usable.
3. Assessment values in degrees or cm, including a side and setup note, survive reload and show baseline versus latest for the correct skill.
4. The user can add their own drill sequence and targets after receiving each individualised programme; the app never creates a prescription on its own.
5. Pike and Bridge sessions open in the normal logger, can be edited, and appear in History and Progress. Completing one updates only its linked practice run.
6. The mobility area offers one useful next action per skill and keeps phase controls secondary.
7. Ending or restarting either practice preserves its prior assessments and completed session history.
8. Authenticated lesson links open the original toolkit pages; no course files or media are imported.

## Delivery sequence

1. Build person-owned practice and assessment records for both skills, the Plan area, Bridge readiness state, and source links.
2. Add the editable drill list and launch it through the existing logger.
3. Link saved sessions to the selected skill run, then show practice frequency and measurement changes for Pike and Bridge separately.
4. Verify mobile flow, access rules, restart/history behavior, and that the main programme's progress is unaffected.

The first implementation should be verified with test data only. Creating real Pike or Bridge runs, entering personal assessment results, or assigning sessions to the user's training history requires a separate explicit go-ahead.
