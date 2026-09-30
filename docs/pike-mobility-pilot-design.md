# Pike & Head to Toe mobility pilot

Status: design for review, 30 September 2026. No programme, assessment, or workout data has been created.

## Purpose

Give the user one clear place in Train & Track to follow a personal Pike & Head to Toe practice while continuing their existing training programme. The toolkit remains the source for assessment instructions, drill demonstrations, and the individualised prescription. Train & Track records the user's chosen plan, measurements, sessions, and progress.

## Source flow observed

1. Open the toolkit's [Pike & Head to Toe Assessment](https://www.matthewismith.com/products/mobility-flexibility-toolkit/categories/2156535269/posts/2182813313). Its lesson covers five tests and a repeatable filming setup.
2. Use the [Touching Toes Individualised Program builder](https://www.matthewismith.com/products/mobility-flexibility-toolkit/categories/2156535269/posts/2182876546) on the toolkit site. The embedded form asks for assessment angles and sends the individualised programme by email. Train & Track does not submit this form or infer its output.
3. Enter the chosen exercises and targets from the received programme into Train & Track. Keep [How to Read Your Program](https://www.matthewismith.com/products/mobility-flexibility-toolkit/categories/4547878/posts/2180210255) and relevant drill lessons as links.
4. Log practice in Train & Track; repeat the assessment when the user decides it is time to review a phase.

The source site's [terms](https://www.matthewismith.com/pages/terms) grant personal, noncommercial access and restrict copying or harvesting for redistribution. Store lesson links, the user's own measurements and notes, and user-entered targets. Do not store course videos, PDFs, lesson text, or an automated copy of the catalogue in the repository or database.

## User experience

### Plan

Add one **Pike practice** card after **My programme**, so the existing strength programme stays the primary plan. The card shows the current phase, last practice, latest assessment date, and one next action:

| State | Main action |
| --- | --- |
| No assessment | Open assessment lesson |
| Assessment recorded, no personal plan | Open program builder |
| Plan received, no drills entered | Add the drills and targets from my plan |
| Practising | Log Pike practice |
| Review date reached | Record a new assessment |

Secondary actions: view measurement history, open toolkit resources, edit phase or targets, pause/end practice. Pausing or ending must keep measurements and completed workouts.

### Today and Log

Show a compact Pike practice action on Today only when the practice is active. It must not displace the main workout action or mark the main programme session complete. Starting it opens the existing workout logger with the user's saved Pike drill list. The user can change or omit drills on the day. Each drill uses its appropriate existing tracking mode: reps and load for strength movements, seconds for holds, and distance/hold/feel for a Pike position. A finished session appears in normal History and Progress.

### Assessments

Record dated results for the toolkit's five Pike tests, allowing left/right results where relevant. Each result has a user-visible name, number and unit or short text result, side, and optional setup note. Keep baseline and later checks together so comparisons use the same test and unit. Link to the toolkit assessment beside the entry form; Train & Track should not reproduce its protocol or interpret a result as a diagnosis.

The pilot should support degrees because the toolkit builder requests angles. The current `mobility_position` logger captures distance in cm, hold seconds, and feel; its existing position-measurement option supports a specific block-based cm setup. Neither is a general angle assessment. Assessments therefore need their own small measurement record instead of forcing degrees into workout sets.

## Proposed storage and integration

- **Practice runs:** one person-owned Pike run with status, start/end dates, current phase, optional review date, and user notes. A new run archives the previous one and keeps its history. This is separate from `program_assignments`, which drives the primary programme's next session.
- **Assessment results:** dated, typed measurements belonging to a run. Preserve the original result and permit a clear correction. Index by run, test, side, and date.
- **Chosen drills:** the user's ordered list, editable targets, optional `exercise_id`, and the exact toolkit lesson URL they chose. Do not seed a fixed programme from the course. Save a reference to the relevant exercise in the existing library where possible.
- **Completed sessions:** continue using the existing workout/session tables and logger. Link each completed Pike session to its practice run so the card can show frequency and last practice without guessing from exercise names.
- **Access:** apply the app's existing person-based authorization to every new table, enable row level security, and index foreign keys. Keep any course URL as a reference, never an authentication token or copied media URL.

## Pilot acceptance checks

1. A user can begin a Pike practice without changing their active strength programme.
2. Assessment values in degrees or cm, including a side and setup note, survive reload and show baseline versus latest.
3. The user can add their own drill sequence and targets after receiving their individualised programme; the app never creates a prescription on its own.
4. A Pike session opens in the normal logger, can be edited, and appears in History and Progress. Its completion updates Pike practice only.
5. The card always offers one useful next action and keeps phase controls secondary.
6. Ending or restarting the practice preserves prior assessments and completed session history.
7. Authenticated lesson links open the original toolkit pages; no course files or media are imported.

## Delivery sequence

1. Build the person-owned practice and assessment records, the Plan card, and source links.
2. Add the editable drill list and launch it through the existing logger.
3. Link saved sessions to the Pike run, then show practice frequency and measurement changes.
4. Verify mobile flow, access rules, restart/history behavior, and that the main programme's progress is unaffected.

The first implementation should be verified with test data only. Creating a real Pike run, entering personal assessment results, or assigning sessions to the user's training history requires a separate explicit go-ahead.
