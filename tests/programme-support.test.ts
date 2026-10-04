import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProgrammeSupportSchedule,
  buildSkillGoalDraft,
  isSupportedSkillGoal,
  programmeSupportHorizon,
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
});

test("free-text and non-calisthenics goals are excluded from automatic programming", () => {
  assert.equal(isSupportedSkillGoal({ ...goal, exerciseId: "" }, exercise), false);
  assert.equal(isSupportedSkillGoal(goal, { ...exercise, workoutType: "Strength" }), false);
});
