import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProgrammeSupportSchedule,
  buildSkillGoalDraft,
  isSupportedSkillGoal,
  programmeSupportHorizon,
  recommendSkillPracticeDose,
  type SkillGoalExercise,
} from "../src/lib/programme-support.ts";
import type { GoalRow } from "../src/lib/training-types.ts";

const exercise: SkillGoalExercise = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Handstand",
  workoutType: "Skills/Calisthenics",
  metric: "hold",
  suggestedSets: "3-4",
  suggestedReps: "10-30 sec",
  availableLocationKinds: ["home", "gym"],
};

const goal: GoalRow = {
  id: "22222222-2222-4222-8222-222222222222",
  row: 1,
  goal: "Hold a freestanding handstand",
  goalType: "performance",
  status: "active",
  exerciseId: exercise.id,
  trackingMode: "hold",
  goalMetric: "hold_seconds",
  targetValue: 30,
  targetUnit: "seconds",
  startingValue: 5,
  deadline: "",
  metric: "",
  target: "",
  period: "year",
  notes: "",
  checkins: [],
};

test("support scheduling pairs skills with strength and keeps mobility on separate days", () => {
  const schedule = buildProgrammeSupportSchedule({
    startDate: "2026-10-05",
    endDate: "2026-10-18",
    programmeDates: [
      "2026-10-05",
      "2026-10-07",
      "2026-10-09",
      "2026-10-12",
      "2026-10-14",
      "2026-10-16",
    ],
    tracks: [
      {
        id: `goal:${goal.id}`,
        kind: "goal",
        title: goal.goal,
        sessionsPerWeek: 2,
        placement: "with_strength",
        locationKind: "home",
      },
      {
        id: "mobility:shoulder",
        kind: "mobility",
        title: "Shoulder mobility",
        sessionsPerWeek: 2,
        placement: "separate",
        locationKind: "home",
      },
    ],
  });
  assert.equal(schedule.length, 8);
  assert.ok(
    schedule.filter((item) => item.kind === "goal").every((item) => item.pairedWithStrength),
  );
  assert.ok(
    schedule.filter((item) => item.kind === "mobility").every((item) => !item.pairedWithStrength),
  );
});

test("the first planning pass is limited to four weeks", () => {
  assert.equal(programmeSupportHorizon("2026-10-05", "2027-01-01"), "2026-11-01");
  assert.equal(programmeSupportHorizon("2026-10-05", "2026-10-20"), "2026-10-20");
});

test("a calisthenics hold goal becomes an editable Library-based practice", () => {
  assert.equal(isSupportedSkillGoal(goal, exercise), true);
  const draft = buildSkillGoalDraft({ goal, exercise, locationKind: "home" });
  assert.equal(draft.title, "Hold a freestanding handstand practice");
  assert.equal(draft.movements[0].trackingMode, "hold");
  assert.equal(draft.movements[0].setRows.length, 3);
  assert.equal(draft.movements[0].setRows[0].durationSeconds, "10");
  assert.match(draft.movements[0].targets.detail, /30 seconds/);
  assert.equal(draft.movements[0].exerciseId, exercise.id);
});

test("skill practice progresses only after four successful weeks at one dose", () => {
  const first = recommendSkillPracticeDose({ goal, exercise });
  assert.equal(first.decision, "start");
  assert.equal(first.value, 10);

  const threeWeeks = ["2026-09-07", "2026-09-14", "2026-09-21"].map((date) => ({
    date,
    plannedSets: 3,
    plannedDose: 10,
    successful: true,
  }));
  const repeat = recommendSkillPracticeDose({ goal, exercise, history: threeWeeks });
  assert.equal(repeat.decision, "repeat");
  assert.equal(repeat.value, 10);

  const progress = recommendSkillPracticeDose({
    goal,
    exercise,
    history: [
      ...threeWeeks,
      { date: "2026-09-28", plannedSets: 3, plannedDose: 10, successful: true },
    ],
  });
  assert.equal(progress.decision, "progress");
  assert.equal(progress.value, 12);

  const draft = buildSkillGoalDraft({
    goal,
    exercise,
    locationKind: "home",
    dose: progress,
  });
  assert.equal(draft.movements[0].setRows[0].durationSeconds, "12");
  assert.match(draft.basis, /Four successful weeks/);
});

test("an incomplete four-week block repeats its dose", () => {
  const history = ["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"].map((date, index) => ({
    date,
    plannedSets: 3,
    plannedDose: 10,
    successful: index < 3,
  }));
  const recommendation = recommendSkillPracticeDose({ goal, exercise, history });
  assert.equal(recommendation.decision, "repeat");
  assert.equal(recommendation.value, 10);
  assert.equal(recommendation.completedWeeks, 4);
  assert.equal(recommendation.successfulWeeks, 3);
});

test("rep practice uses one-rep steps and never proposes past the goal", () => {
  const repExercise = {
    ...exercise,
    name: "Pull-up",
    metric: "reps",
    suggestedReps: "5-8",
  };
  const repGoal = {
    ...goal,
    goal: "Complete 6 pull-ups",
    trackingMode: "reps_only",
    goalMetric: "reps" as const,
    targetValue: 6,
    targetUnit: "reps",
  };
  const history = ["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"].map((date) => ({
    date,
    plannedSets: 3,
    plannedDose: 5,
    successful: true,
  }));
  const recommendation = recommendSkillPracticeDose({
    goal: repGoal,
    exercise: repExercise,
    history,
  });
  assert.equal(recommendation.unit, "reps");
  assert.equal(recommendation.value, 6);
});

test("free-text and non-calisthenics goals are excluded from automatic programming", () => {
  assert.equal(isSupportedSkillGoal({ ...goal, exerciseId: "" }, exercise), false);
  assert.equal(isSupportedSkillGoal(goal, { ...exercise, workoutType: "Strength" }), false);
});
