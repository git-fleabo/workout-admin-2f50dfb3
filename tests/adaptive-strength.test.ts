import assert from "node:assert/strict";
import test from "node:test";

import {
  adjustmentForDecision,
  decideAdaptiveProgression,
  effectiveIntensityPercent,
  nextCycleTrainingMax,
} from "../src/lib/adaptive-strength.ts";

test("adaptive review progresses only with complete low-pain quality evidence", () => {
  assert.equal(
    decideAdaptiveProgression({
      completed: true,
      rpe: 7.5,
      rpeCap: 8,
      technique: "good",
      pain: 1,
    }),
    "progress",
  );
  assert.equal(
    decideAdaptiveProgression({
      completed: true,
      rpe: 8.5,
      rpeCap: 8,
      technique: "good",
      pain: 0,
    }),
    "repeat",
  );
  assert.equal(
    decideAdaptiveProgression({
      completed: true,
      rpe: 7,
      rpeCap: 8,
      technique: "poor",
      pain: 1,
    }),
    "regress",
  );
  assert.equal(
    decideAdaptiveProgression({
      completed: true,
      rpe: 7,
      rpeCap: 8,
      technique: "good",
      pain: 4,
    }),
    "regress",
  );
});

test("missing review evidence holds the next prescription", () => {
  assert.equal(
    decideAdaptiveProgression({
      completed: true,
      rpe: null,
      rpeCap: 8,
      technique: null,
      pain: null,
    }),
    "repeat",
  );
  assert.equal(adjustmentForDecision("progress"), 0);
  assert.equal(adjustmentForDecision("repeat"), -2.5);
  assert.equal(adjustmentForDecision("regress"), -5);
});

test("effective percentage starts at the safe end and never exceeds its range", () => {
  assert.equal(effectiveIntensityPercent({ minimum: 75, maximum: 80, adjustment: 0 }), 75);
  assert.equal(effectiveIntensityPercent({ minimum: 75, maximum: 80, adjustment: -5 }), 70);
  assert.equal(effectiveIntensityPercent({ minimum: 75, maximum: 80, adjustment: 10 }), 80);
});

test("next cycle uses the agreed lift-specific training max steps", () => {
  assert.equal(nextCycleTrainingMax("bench_press", 75), 77.5);
  assert.equal(nextCycleTrainingMax("high_bar_squat", 65), 67.5);
  assert.equal(nextCycleTrainingMax("deadlift", 87.5), 90);
  assert.equal(nextCycleTrainingMax("seated_dumbbell_press", 20), 21);
  assert.equal(nextCycleTrainingMax("weighted_pull_up", 30), 30);
});
