import assert from "node:assert/strict";
import test from "node:test";

import {
  adjustmentForDecision,
  decideAdaptiveProgression,
  effectiveIntensityPercent,
  nextCycleTrainingMax,
  programmeWeightIncrementKg,
  programmeWorkoutIsDue,
  programmeWorkoutScheduledDate,
  suggestedRestForIntensity,
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

test("programme load and next-cycle increments follow upper/lower focus", () => {
  assert.equal(programmeWeightIncrementKg("Push"), 2.5);
  assert.equal(programmeWeightIncrementKg("Pull"), 2.5);
  assert.equal(programmeWeightIncrementKg("Upper Body"), 2.5);
  assert.equal(programmeWeightIncrementKg("Lower Body"), 5);
  assert.equal(programmeWeightIncrementKg("Posterior Chain"), 5);
  assert.equal(nextCycleTrainingMax("Push", 75), 77.5);
  assert.equal(nextCycleTrainingMax("Lower Body", 65), 70);
  assert.equal(nextCycleTrainingMax("Posterior Chain", 87.5), 92.5);
  assert.equal(nextCycleTrainingMax("Upper Body", 20), 22.5);
  assert.equal(nextCycleTrainingMax("Pull", 30), 32.5);
});

test("programme workouts stay hidden until their scheduled Mon/Wed/Fri date", () => {
  assert.equal(programmeWorkoutIsDue("2026-08-03", 1, 1, "2026-07-29"), false);
  assert.equal(programmeWorkoutIsDue("2026-08-03", 1, 1, "2026-08-03"), true);
  assert.equal(programmeWorkoutIsDue("2026-08-03", 1, 3, "2026-08-04"), false);
  assert.equal(programmeWorkoutIsDue("2026-08-03", 1, 3, "2026-08-05"), true);
  assert.equal(programmeWorkoutIsDue("2026-08-03", 2, 1, "2026-08-09"), false);
  assert.equal(programmeWorkoutIsDue("2026-08-03", 2, 1, "2026-08-10"), true);
  assert.equal(programmeWorkoutIsDue(null, 1, 1, "2026-07-29"), true);
});

test("programme workout dates follow the assignment's Mon/Wed/Fri cadence", () => {
  assert.equal(programmeWorkoutScheduledDate("2026-08-03", 1, 1), "2026-08-03");
  assert.equal(programmeWorkoutScheduledDate("2026-08-03", 1, 3), "2026-08-05");
  assert.equal(programmeWorkoutScheduledDate("2026-08-03", 1, 5), "2026-08-07");
  assert.equal(programmeWorkoutScheduledDate("2026-08-03", 2, 1), "2026-08-10");
  assert.equal(programmeWorkoutScheduledDate(null, 1, 1), null);
});

test("suggested rest increases with working-set intensity", () => {
  assert.equal(suggestedRestForIntensity(60), "120–150s");
  assert.equal(suggestedRestForIntensity(70), "150–180s");
  assert.equal(suggestedRestForIntensity(80), "180–210s");
  assert.equal(suggestedRestForIntensity(90), "210–240s");
  assert.equal(suggestedRestForIntensity(null), "");
});
