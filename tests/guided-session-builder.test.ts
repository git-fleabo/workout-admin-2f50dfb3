import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildCircuit,
  type CircuitBuilderConfig,
  type CircuitCandidate,
} from "../src/lib/circuit-generator.ts";
import { buildWorkoutSuggestion } from "../src/lib/workout-plan.ts";

function circuitCandidate(id: string, name: string, recentHistoryCount = 0): CircuitCandidate {
  return {
    id,
    name,
    workoutType: "Conditioning",
    focusArea: "Upper body",
    equipment: "Dumbbell",
    equipmentGroups: ["dumbbell"],
    metric: "Reps",
    locationScope: "both",
    availableLocationKinds: ["home", "gym"],
    circuitSuitability: "available",
    circuitPattern: "push",
    circuitDifficulty: "intermediate",
    circuitImpact: "low",
    circuitDoseMode: "reps",
    circuitDoseMin: "6",
    circuitDoseMax: "12",
    circuitDosePerSide: false,
    recentHistoryCount,
    lastPerformedDate: recentHistoryCount ? "2026-07-31" : null,
  };
}

test("conditioning generation favours familiar movements and uses hard doses", () => {
  const config: CircuitBuilderConfig = {
    durationMinutes: 20,
    location: "gym",
    readiness: "fresh",
    focus: "upper",
    intensity: "hard",
    format: "mixed",
    equipment: null,
    excludeHighImpact: false,
    excludeAdvanced: false,
    excludedExerciseIds: [],
  };
  const result = buildCircuit(
    [
      circuitCandidate("familiar", "Dumbbell Push Press", 4),
      circuitCandidate("new-1", "Dumbbell Thruster"),
      circuitCandidate("new-2", "Push-Up"),
      circuitCandidate("new-3", "Floor Press"),
    ],
    config,
    { movementCount: 3 },
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const familiar = result.selections.find((selection) => selection.candidate.id === "familiar");
  assert.ok(familiar);
  assert.equal(familiar.dose, 12);
  assert.match(familiar.reason, /used 4 times in recent training/i);
  assert.match(result.basis, /prioritising 1 movement from recent training/i);
  assert.equal(result.restBetweenRoundsSeconds, 45);
});

test("hard strength requests progress load and add one bounded work set", () => {
  const suggestion = buildWorkoutSuggestion(
    [
      {
        entryId: "entry-1",
        date: "2026-07-31",
        id: "session-1",
        orderIndex: 0,
        sessionTitle: "Strength",
        workoutType: "Strength",
        focusArea: "Upper body",
        exercise: "Bench Press",
        sets: "3",
        reps: "15",
        weight: "70",
        duration: "",
        intensity: "",
        rpe: "9",
        restTime: "",
        completed: true,
        notes: "",
        entryKind: "",
        progressionLevel: "",
        holdSeconds: "",
        distance: "",
        distanceUnit: "",
        rounds: "",
        feel: "",
        height: "",
        positionMeasurementCm: "",
        positionMeasurementSetup: "",
        detail: "",
        climbingBoulders: "",
        climbingTrackingMode: "",
        climbingMaxGrade: "",
        climbingGradient: "",
        assistanceType: "",
        assistanceDetail: "",
        quality: "",
        technique: "good",
        pain: "0",
        loadSemantics: "total_external_load",
        trainingLocation: { kind: "gym", name: "Gym" },
        methodBlocks: [],
        setRows: Array.from({ length: 3 }, () => ({
          reps: "5",
          weight: "70",
          durationSeconds: "",
          rpe: "9",
          completed: true,
        })),
      },
    ],
    "gym",
    "fresh",
  );

  assert.ok(suggestion);
  const bench = suggestion.movements[0];
  assert.equal(bench.setRows.length, 4);
  assert.equal(bench.setRows[0]?.weight, "72.5");
  assert.equal(bench.setRows[0]?.reps, "3");
  assert.match(bench.reason, /requested a hard session/i);
  assert.match(bench.reason, /adds one work set/i);
});

test("Plan removes the recovery card and keeps the mobile adjustment action contained", () => {
  const planRoute = readFileSync(new URL("../src/routes/plan.tsx", import.meta.url), "utf8");
  const weeklyOverview = readFileSync(
    new URL("../src/components/weekly-plan-overview.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(planRoute, /<WeeklyRecoveryCard/);
  assert.match(planRoute, /Build me a session/);
  assert.match(planRoute, /Programme recovery is handled by/);
  assert.match(planRoute, /intensity: "hard"/);
  assert.match(weeklyOverview, /whitespace-normal/);
  assert.match(weeklyOverview, /Adjust extras/);
});
