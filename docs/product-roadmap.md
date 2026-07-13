# Training Admin Product Roadmap

Last updated: 2026-07-13

## Product Direction

Training Admin should be organised around the training loop rather than around database categories:

1. Decide what to do next.
2. Log the work with minimal friction.
3. Review performance and fatigue.
4. Adjust the next workout or week.

This is a product redesign, not a ground-up technical rewrite. Keep the existing TanStack application, Supabase database, authentication, exercise library, and historical data. Evolve the interface and session lifecycle in small, verifiable releases.

## Product Principles

- One obvious logging path. A one-movement entry is simply a workout with one movement.
- Mobile is for deciding, logging, resuming, and finishing quickly.
- Larger screens are for analysis, comparisons, planning, and administration.
- Store individual sets for weighted and rep-based movements.
- Keep recommendations transparent and editable.
- Treat Home and Gym as first-class training contexts.
- Preserve history and stable exercise identity during every iteration.
- Prefer explainable signals over confident but opaque coaching claims.

## Target Information Architecture

### Mobile

- **Today:** next workout, resume draft, repeat recent session, or start empty.
- **Log:** one unified session composer.
- **Progress:** concise exercise status and recent trend.
- **More:** History, Library, Goals, PRs, 1RM, and administration.

### Larger screens

- Persistent navigation with Today, Log, Progress, Plan, and History.
- Wider exercise-progress workspace with charts and exact set history together.
- Planning views that can compare recent sessions and the coming week.
- Library and administration remain efficient dense-data screens.

## Phase 1: One Unified Workout Logger

Goal: remove the decision between Quick Log and Full Workout, then make the remaining session composer faster than either old path.

### 1.1 Remove the mode fork — implemented

- Log opens directly into the session composer.
- A session begins with one blank movement and can remain a one-movement workout.
- Home/Gym is chosen once for the session.
- The same save path handles one movement or a full workout.
- Keep 1RM and PRs as separate specialist tools.

### 1.2 Autosaved drafts — implemented

- Persist the current form locally under the signed-in account while it is being edited.
- Restore an unfinished session after navigation, refresh, or reopening the app.
- Make Discard explicit.
- Do not create partial completed sessions in Supabase.
- Later decide whether cross-device drafts justify a server-side `draft` session status.

### 1.3 Faster set entry — implemented

- Show the most recent matching sets beside or immediately above the new targets.
- Add `Repeat last set` and `Copy previous workout` actions.
- Make weight and reps the largest touch targets for weighted movements.
- Keep Add set, remove set, and next movement thumb-reachable on mobile.
- Reduce visual weight of optional movement notes and uncommon metrics.

### 1.4 Faster movement selection — implemented

- Put recent and favourite movements ahead of the full search list.
- Keep Home/Gym/Both filtering automatic.
- Allow reordering movements.
- Offer saved plans and recent-session repeats from the same entry point.

### 1.5 Finish and same-day correction — implemented

- Give Finish workout a clear session summary.
- Make the just-completed workout easy to reopen and correct on the same day.
- Preserve duplicate protection without interrupting ordinary multi-movement logging.

Phase 1 is complete when a one-movement workout and a multi-movement workout use the same interface, an interrupted session is recoverable, and the common weighted-set flow needs materially fewer taps.

## Phase 2: Today — implemented

Goal: make startup answer “What am I doing today?” instead of presenting an empty database form.

- Show a saved Next Workout first. — implemented
- Resume an unfinished draft. — implemented
- Repeat a recent Home or Gym session. — implemented
- Start an empty workout. — implemented
- Show today’s completed session with a route to its Edit action. — implemented
- Keep the screen compact; it is a launch point, not another dashboard. — implemented

- Show an explainable history-based recommendation when no saved Next Workout exists. — implemented
- Let Home/Gym be changed on Today and carry that choice into the full Plan editor. — implemented

## Phase 3: Exercise Progress Workspace — decision layer started

Goal: make Progress the main large-screen decision tool.

- Working-weight, best-set, estimated-strength, and weekly-volume trends. — implemented
- Reps and RPE at each load. — implemented
- Home/Gym and period comparison controls. — implemented
- Planned targets versus actual completed sets. — implemented
- Click a point or row to inspect its session.
- A concise mobile summary focused on the next decision. — implemented

Progress signals should combine performance, volume, effort, missed targets, training frequency, and consecutive hard weeks. Wording should explain the evidence and remain cautious: continue, consider progressing, hold, or consider a lighter week.

The first decision layer now uses the latest working sets, five-rep progression threshold, recorded
RPE, period performance/volume comparison, and repeated high-effort decline. It exposes the exact
evidence and does not treat missing RPE as proof that a load was comfortable. Progress also compares
each saved recommendation's set targets with the linked completed session and labels the result met,
exceeded, partial, or not completed. The next Phase 3 step is opening the underlying session from a
chart point, history row, or comparison.

## Phase 4: Weekly Planning and Deloads

Goal: extend the current next-workout planner into a practical view of the coming week.

- Expected Home/Gym training days.
- Learned rotation from recent history.
- Exercises due for progression.
- Exercises showing possible fatigue.
- Other load such as climbing, running, sport, or classes.
- A lighter workout or full deload-week option.
- Editable recommendations with visible source sessions and reasons.

## Phase 5: Advanced Training Methods

Goal: plan, log, and review non-straight-set methods without hiding their actual exercise, set, rep, load, rest, and sequence data.

Use three method families because they behave differently in the logger and analytics:

- **Exercise groups:** supersets, tri-sets, giant sets, circuits, jump sets, Peripheral Heart Action, and complex training. Store the ordered movements, rounds, rest between movements, and rest between rounds.
- **Within-exercise set methods:** drop/strip sets, cluster sets, rest-pause sets, rep targeting, and partial reps. Preserve every segment's load, reps, range of motion, and short rest rather than flattening the method into one ordinary set.
- **Timed or density methods:** escalating density training and Tabata. Store work/rest intervals, block duration, rounds, and completed work.

Settings should provide a Training Methods library where an authorised user can:

- Create, rename, duplicate, deactivate, reactivate, and delete unused custom methods.
- Start with system definitions based on the [OriGym Advanced Training Systems terminology](https://www.origym.co.uk/course/fitness-training-systems/) while allowing personal methods such as supersets and giant sets.
- Choose the method family and which fields apply, with stable IDs so renaming does not rewrite history.
- Set defaults such as movement count, rest, rounds, rep targets, percentage drops, interval timing, and whether exercises alternate or run sequentially.
- Keep system methods protected from destructive deletion, but allow them to be hidden or duplicated into an editable custom version.

Implementation should begin with supersets/tri-sets/giant sets and drop/strip sets, then add the remaining OriGym methods. Progress and planning must continue to count the underlying exercise volume while also showing the method used.

## Phase 6: Data and Administration Refinement

- Converge planned, draft, completed, skipped, and archived work into a clearer session lifecycle where practical.
- Maintain stable exercise IDs and treat display-name changes as aliases/renames.
- Keep movement metric profiles explicit and reusable.
- Add People & Access before opening the app to friends or clients.
- Generate Supabase TypeScript types when the schema settles.
- Revisit native packaging only after the web workflow is stable.

## What We Keep

- Supabase as the source of truth.
- Existing training history and set-level data.
- The master library plus per-person selection.
- Home/Gym/Both exercise availability.
- The current Progress and Plan foundations.
- Transparent progression explanations and editable suggestions.
- The current visual language, refined rather than replaced.

## Current Focus

Phase 3 is active. Progress now leads with an exercise-level next decision, retains the charts and
exact set history, and compares saved targets with linked actual sets. The next implementation should
make chart points, history rows, and plan comparisons open the underlying workout session.
