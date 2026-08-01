import assert from "node:assert/strict";
import test from "node:test";

import { buildProgrammeMovementPrescription } from "../src/lib/programme-prescription.ts";

const baseEntry = {
  name: "Main lift",
  minSets: 3,
  maxSets: 4,
  minReps: 5,
  maxReps: 6,
  intensityPercent: 75,
  intensityMinPercent: 75,
  intensityMaxPercent: 80,
  roundingIncrement: 2.5,
  rpeCap: 8,
  rest: null,
  notes: "Keep two reps in reserve.",
  isOptional: false,
};

const baseExercise = {
  exerciseName: "High Bar Squat",
  trainingMax: 100,
  loadAdjustmentPercent: 0,
  lastDecision: null,
};

test("programme preview builds the same exact set prescription used by Today", () => {
  const movement = buildProgrammeMovementPrescription({
    entry: baseEntry,
    exercise: baseExercise,
    methodType: "adaptive_strength_12_week",
    defaultSetChoice: "minimum",
    defaultRoundingIncrement: 2.5,
  });

  assert.ok(movement);
  assert.equal(movement.exercise, "High Bar Squat");
  assert.equal(movement.restTime, "150–180s");
  assert.deepEqual(
    movement.setRows.map((set) => ({ weight: set.weight, reps: set.reps })),
    [
      { weight: "75", reps: "5" },
      { weight: "75", reps: "5" },
      { weight: "75", reps: "5" },
    ],
  );
  assert.match(movement.reason, /75% of 100 kg training max/);
  assert.match(movement.reason, /RPE cap 8/);
  assert.match(movement.reason, /Keep two reps in reserve/);
});

test("programme preview applies the latest adaptive review and explicit rest", () => {
  const movement = buildProgrammeMovementPrescription({
    entry: { ...baseEntry, rest: "4 min" },
    exercise: {
      ...baseExercise,
      loadAdjustmentPercent: -5,
      lastDecision: "regress",
    },
    methodType: "adaptive_strength_12_week",
    defaultSetChoice: "maximum",
    defaultRoundingIncrement: 2.5,
  });

  assert.ok(movement);
  assert.equal(movement.restTime, "4 min");
  assert.equal(movement.setRows.length, 4);
  assert.equal(movement.setRows[0]?.weight, "70");
  assert.match(movement.reason, /Last review: regress/);
});

test("programme preview fails closed when an exact load cannot be calculated", () => {
  assert.equal(
    buildProgrammeMovementPrescription({
      entry: baseEntry,
      exercise: { ...baseExercise, trainingMax: null },
      methodType: "adaptive_strength_12_week",
      defaultSetChoice: "minimum",
      defaultRoundingIncrement: 2.5,
    }),
    null,
  );
});
