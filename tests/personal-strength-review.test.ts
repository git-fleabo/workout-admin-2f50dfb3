import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStrengthProgrammeReview,
  buildStrengthProgrammeFollowUpProposal,
  type ProgrammeStrengthWeekReview,
} from "../src/lib/strength-programme-review.ts";
import {
  personalStrengthOutcomes,
  personalStrengthReviewIsStale,
  reviewedPersonalLoad,
  type PersonalStrengthCompletedEntry,
} from "../src/lib/personal-strength-review.ts";
import {
  personalStrengthAssignment as assignment,
  personalStrengthTemplate as template,
  personalStrengthRecovery as recovery,
  personalStrengthId as id,
} from "./helpers/personal-strength-fixtures.ts";
const review = () => buildStrengthProgrammeReview({ assignment, template, recovery })!;
function applied(): ProgrammeStrengthWeekReview {
  const draft = review();
  return {
    id: "approved",
    programmeWeek: 1,
    startWorkoutIndex: 0,
    endWorkoutIndex: 2,
    workoutIds: draft.sessions.map((session) => session.workoutId),
    recoveryLevel: "deload",
    recommendationKind: "reduce",
    appliedAt: "2026-10-12",
    exercises: draft.exercises.map((exercise) => ({
      ...exercise,
      manualAdjustmentPercent: exercise.proposedManualAdjustmentPercent,
      combinedAdjustmentPercent: exercise.proposedCombinedAdjustmentPercent,
      setAdjustment: exercise.proposedSetAdjustment,
    })),
    personalSessions: draft.sessions.map((session) => ({
      ...assignment.personalProgramme!.sessions.find(
        (item) => item.workoutId === session.workoutId,
      )!,
      basePlan: assignment.personalProgramme!.sessions.find(
        (item) => item.workoutId === session.workoutId,
      )!.plan,
      plan: {
        version: 1,
        locationKind: "gym",
        movements: session.movements.map(
          (item) =>
            item.movement as (typeof assignment.personalProgramme.sessions)[number]["plan"]["movements"][number],
        ),
      },
    })),
    outcomes: [],
  };
}
const completedEntries = (): PersonalStrengthCompletedEntry[] =>
  applied().personalSessions![0].plan.movements.map((movement, index) => ({
    exercise_id: movement.exerciseId,
    order_index: index,
    completed: true,
    entry_sets: movement.setRows.map((row, i) => ({
      set_number: i + 1,
      reps: row.reps ? Number(row.reps) : null,
      weight: row.weight ? Number(row.weight) : null,
      duration_seconds: row.durationSeconds ? Number(row.durationSeconds) : null,
      rpe: 7,
      completed: true,
    })),
    entry_metrics: [
      { metric_key: "pain", metric_value: 0, metric_text: null },
      { metric_key: "technique", metric_value: null, metric_text: "good" },
    ],
  }));
test("personal reviews use exact custom targets across source models without changing the baseline", () => {
  const before = JSON.stringify(assignment);
  const draft = review();
  assert.equal(draft.isPersonal, true);
  assert.equal(draft.sessions.length, 3);
  assert.deepEqual(
    draft.sessions[0].movements[0].movement.setRows.map((row) => [row.weight, row.reps]),
    [
      ["19.57", "8"],
      ["19.57", "9"],
    ],
  );
  assert.equal(draft.sessions[0].movements[0].movement.restTime, "3 min");
  assert.deepEqual(
    draft.sessions[0].movements[0].movement.progression,
    assignment.personalProgramme!.sessions[0].plan.movements[0].progression,
  );
  assert.equal(draft.sessions[0].movements[1].movement.setRows[0].durationSeconds, "10");
  assert.equal(draft.exercises[1].proposedManualAdjustmentPercent, 0);
  assert.equal(JSON.stringify(assignment), before);
  assert.equal(reviewedPersonalLoad("20.6", -2.5), "20.09");
  assert.equal(reviewedPersonalLoad("1.15", -10), "1.04");
});
test("started sessions are excluded and a one-set movement never loses its final set", () => {
  const locked = { ...assignment, reviewLockedWorkoutIds: [id(20)] };
  const draft = buildStrengthProgrammeReview({ assignment: locked, template, recovery })!;
  assert.deepEqual(
    draft.sessions.map((session) => session.workoutId),
    [id(21), id(22)],
  );
  assert.equal(draft.expectedCurrentWorkoutIndex, 0);
  const single = structuredClone(assignment);
  single.personalProgramme!.sessions[0].plan.movements[0].setRows.splice(1);
  assert.equal(
    buildStrengthProgrammeReview({ assignment: single, template, recovery })!.sessions[0]
      .movements[0].movement.setRows.length,
    1,
  );
});
test("restoration needs all reviewed exposures and restores week two's own custom loads", () => {
  const done = applied();
  const entries = completedEntries();
  done.outcomes = done.personalSessions!.flatMap((snapshot) =>
    personalStrengthOutcomes(snapshot, entries),
  );
  const next = { ...assignment, currentWorkoutIndex: 3 };
  const normal = { ...recovery, level: "normal" as const };
  const proposal = buildStrengthProgrammeFollowUpProposal({
    assignment: next,
    template,
    recovery: normal,
    appliedReview: done,
  })!;
  assert.equal(proposal.recommendationKind, "restore");
  const restored = buildStrengthProgrammeReview({
    assignment: next,
    template,
    recovery: normal,
    proposal,
  })!;
  assert.equal(restored.sessions[0].movements[0].movement.setRows[0].weight, "25.25");
  assert.equal(restored.sessions[0].movements[0].movement.setRows.length, 3);
  done.outcomes = done.outcomes.filter((outcome) => outcome.workoutId !== id(22));
  const incomplete = buildStrengthProgrammeFollowUpProposal({
    assignment: next,
    template,
    recovery: normal,
    appliedReview: done,
  })!;
  assert.equal(incomplete.recommendationKind, "hold");
  assert.equal(
    buildStrengthProgrammeReview({
      assignment: next,
      template,
      recovery: normal,
      proposal: incomplete,
    })!.sessions[0].movements[0].movement.setRows[0].weight,
    "23.99",
  );
});
test("missing effort, changed actual loads and ambiguous entries never count as successful evidence", () => {
  const snapshot = applied().personalSessions![0];
  let entries = completedEntries();
  entries[0].entry_sets![1].rpe = null;
  assert.equal(personalStrengthOutcomes(snapshot, entries)[0].decision, "repeat");
  entries = completedEntries();
  entries[0].entry_sets![0].weight = 17;
  assert.equal(personalStrengthOutcomes(snapshot, entries)[0].decision, "repeat");
  entries = completedEntries();
  entries.push(entries[0]);
  assert.equal(personalStrengthOutcomes(snapshot, entries)[0].decision, "repeat");
  entries = completedEntries();
  entries[0].entry_metrics![0].metric_value = 4;
  assert.equal(personalStrengthOutcomes(snapshot, entries)[0].decision, "regress");
});
test("swaps do not inherit an old lift's reduction and edits make the review stale", () => {
  const done = applied();
  const next = structuredClone(assignment);
  next.currentWorkoutIndex = 3;
  for (const session of next.personalProgramme!.sessions.slice(3))
    session.plan.movements[0].exerciseId = id(12);
  const normal = { ...recovery, level: "normal" as const };
  const proposal = buildStrengthProgrammeFollowUpProposal({
    assignment: next,
    template,
    recovery: normal,
    appliedReview: done,
  })!;
  const fresh = buildStrengthProgrammeReview({
    assignment: next,
    template,
    recovery: normal,
    proposal,
  })!;
  assert.equal(fresh.exercises[0].proposedManualAdjustmentPercent, 0);
  const edited = structuredClone(assignment);
  edited.personalProgramme!.sessions[1].revision++;
  assert.equal(personalStrengthReviewIsStale(edited, done), true);
});

test("source-rule placeholders cannot provide positive restoration evidence", () => {
  const snapshot = applied().personalSessions![0];
  snapshot.plan.movements[0].setRows[0].reps = "";
  assert.equal(personalStrengthOutcomes(snapshot, completedEntries())[0].decision, "repeat");
});
