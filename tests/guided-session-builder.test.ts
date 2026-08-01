import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildCircuit,
  type CircuitBuilderConfig,
  type CircuitCandidate,
} from "../src/lib/circuit-generator.ts";
import { buildClimbingCircuit } from "../src/lib/climbing-circuit-generator.ts";
import {
  buildGuidedStrengthSession,
  buildWorkoutSuggestion,
  readWorkoutPlanDraft,
} from "../src/lib/workout-plan.ts";

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

  const veryHard = buildCircuit(
    [
      circuitCandidate("familiar", "Dumbbell Push Press", 4),
      circuitCandidate("new-1", "Dumbbell Thruster"),
      circuitCandidate("new-2", "Push-Up"),
      circuitCandidate("new-3", "Floor Press"),
    ],
    { ...config, intensity: "very_hard" },
    { movementCount: 3 },
  );
  assert.equal(veryHard.ok, true);
  if (!veryHard.ok) return;
  assert.equal(veryHard.restBetweenRoundsSeconds, 30);
  assert.ok(veryHard.rounds >= result.rounds);
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

test("very hard guided strength uses five sets and reserves conditioning time", () => {
  const log = {
    entryId: "entry-1",
    date: "2026-07-31",
    id: "session-1",
    orderIndex: 0,
    sessionTitle: "Strength",
    workoutType: "Strength",
    focusArea: "Lower body",
    exercise: "High Bar Squat",
    sets: "3",
    reps: "15",
    weight: "100",
    duration: "",
    intensity: "",
    rpe: "8",
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
      weight: "100",
      durationSeconds: "",
      rpe: "8",
      completed: true,
    })),
  } as Parameters<typeof buildWorkoutSuggestion>[0][number];
  const result = buildGuidedStrengthSession(
    [
      {
        id: "squat",
        log,
        focusArea: "Lower body",
        equipmentGroups: ["barbell"],
        recentHistoryCount: 4,
      },
      {
        id: "deadlift",
        log: { ...log, entryId: "entry-2", exercise: "Deadlift" },
        focusArea: "Lower body",
        equipmentGroups: ["barbell"],
        recentHistoryCount: 3,
      },
    ],
    {
      durationMinutes: 60,
      location: "gym",
      focus: "lower",
      difficulty: "very_hard",
      equipment: ["barbell"],
      excludedExerciseIds: [],
    },
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.finisherMinutes, 12);
  assert.equal(result.suggestion.movements[0]?.setRows.length, 5);
  assert.equal(result.suggestion.movements[0]?.restTime, "2.5 min");
  assert.match(result.suggestion.basis, /leave about 12 minutes for conditioning/i);
});

test("climbing goals select automatic formats and preserve one duration-led activity", () => {
  const aerobic = buildClimbingCircuit({
    durationMinutes: 30,
    goal: "aerobic_endurance",
    wallType: "commercial",
    difficulty: "standard",
  });
  const emom = buildClimbingCircuit({
    durationMinutes: 30,
    goal: "repeated_effort",
    wallType: "training_board",
    difficulty: "hard",
  });
  const power = buildClimbingCircuit({
    durationMinutes: 45,
    goal: "power_endurance",
    wallType: "commercial",
    difficulty: "hard",
  });

  assert.equal(aerobic.format, "continuous");
  assert.equal(emom.format, "emom");
  assert.equal(emom.plannedProblems, 18);
  assert.equal(power.format, "four_by_four");
  assert.equal(power.plannedProblems, 16);
  for (const result of [aerobic, emom, power]) {
    assert.equal(
      result.phases.reduce((total, phase) => total + phase.durationMinutes, 0),
      result.durationMinutes,
    );
    assert.equal(result.movement.trackingMode, "climbing");
    assert.equal(result.movement.targets.durationMinutes, String(result.durationMinutes));
    assert.equal(result.movement.setRows.length, 0);
    assert.ok(result.movement.targets.detail.includes(result.formatLabel));
  }
});

test("climbing difficulty changes EMOM density without changing the total session time", () => {
  const build = (difficulty: "standard" | "hard" | "very_hard") =>
    buildClimbingCircuit({
      durationMinutes: 30,
      goal: "repeated_effort",
      wallType: "commercial",
      difficulty,
    });
  const standard = build("standard");
  const hard = build("hard");
  const veryHard = build("very_hard");

  assert.equal(standard.plannedProblems, 15);
  assert.equal(hard.plannedProblems, 18);
  assert.equal(veryHard.plannedProblems, 20);
  assert.equal(standard.durationMinutes, veryHard.durationMinutes);
});

test("short or spray-wall power endurance uses linked work-rest intervals", () => {
  const result = buildClimbingCircuit({
    durationMinutes: 25,
    goal: "power_endurance",
    wallType: "spray",
    difficulty: "very_hard",
  });

  assert.equal(result.format, "linked_intervals");
  assert.match(result.basis, /you choose the problems/i);
  assert.equal(
    result.phases.reduce((total, phase) => total + phase.durationMinutes, 0),
    25,
  );
});

test("every climbing builder combination keeps positive phases inside the requested duration", () => {
  for (const durationMinutes of [20, 25, 30, 45, 60]) {
    for (const goal of ["aerobic_endurance", "repeated_effort", "power_endurance"] as const) {
      for (const wallType of ["commercial", "spray", "training_board"] as const) {
        for (const difficulty of ["standard", "hard", "very_hard"] as const) {
          const result = buildClimbingCircuit({ durationMinutes, goal, wallType, difficulty });
          assert.equal(
            result.phases.reduce((total, phase) => total + phase.durationMinutes, 0),
            durationMinutes,
          );
          assert.ok(result.phases.every((phase) => phase.durationMinutes > 0));
        }
      }
    }
  }
});

test("local plan drafts allow setless climbing without weakening other movement validation", () => {
  const result = buildClimbingCircuit({
    durationMinutes: 30,
    goal: "repeated_effort",
    wallType: "commercial",
    difficulty: "hard",
  });
  const climbingDraft = {
    version: 1 as const,
    title: result.title,
    locationKind: "gym" as const,
    basis: result.basis,
    movements: [result.movement],
    methodBlocks: [],
  };

  assert.ok(readWorkoutPlanDraft(JSON.stringify(climbingDraft)));
  assert.equal(
    readWorkoutPlanDraft(
      JSON.stringify({
        ...climbingDraft,
        movements: [
          {
            ...result.movement,
            workoutType: "Strength",
            trackingMode: "weight_reps",
          },
        ],
      }),
    ),
    null,
  );
});

test("Plan removes the recovery card and keeps the mobile adjustment action contained", () => {
  const planRoute = readFileSync(new URL("../src/routes/plan.tsx", import.meta.url), "utf8");
  const weeklyOverview = readFileSync(
    new URL("../src/components/weekly-plan-overview.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(planRoute, /<WeeklyRecoveryCard/);
  assert.match(planRoute, /Build me a session/);
  assert.match(planRoute, /Programme recovery is\s+handled by/);
  assert.match(planRoute, /intensity: "hard"/);
  assert.doesNotMatch(planRoute, /<WorkoutLifecyclePanel/);
  assert.match(planRoute, /always adds an editable conditioning finisher/);
  assert.match(planRoute, /must keep a conditioning finisher/);
  assert.match(planRoute, /Very hard/);
  assert.match(planRoute, /Build climbing session/);
  assert.match(planRoute, /Automatic format selection/);
  assert.match(weeklyOverview, /whitespace-normal/);
  assert.match(weeklyOverview, /Adjust extras/);
});
