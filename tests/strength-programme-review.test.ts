import assert from "node:assert/strict";
import test from "node:test";

import { buildStrengthProgrammeReview } from "../src/lib/strength-programme-review.ts";
import type {
  ProgrammeAssignment,
  ProgrammeTemplate,
} from "../src/lib/supabase-programmes.browser.ts";
import type { WeeklyRecoveryRecommendation } from "../src/lib/weekly-recovery.ts";

const assignment: ProgrammeAssignment = {
  id: "assignment-1",
  programId: "programme-1",
  personId: "person-1",
  status: "active",
  currentWorkoutIndex: 2,
  startedOn: "2026-10-05",
  completedOn: null,
  notes: null,
  createdAt: "2026-10-01T00:00:00Z",
  cycleNumber: 1,
  previousAssignmentId: null,
  exercises: [
    {
      id: "mapping-1",
      slotKey: "squat",
      exerciseId: "exercise-1",
      exerciseName: "High Bar Squat",
      focusArea: "Lower Body",
      trainingMax: 100,
      enabled: true,
      loadAdjustmentPercent: 0,
      manualAdjustmentPercent: 2.5,
      manualAdjustedAt: "2026-10-10T00:00:00Z",
      lastDecision: "progress",
    },
    {
      id: "mapping-2",
      slotKey: "bench",
      exerciseId: "exercise-2",
      exerciseName: "Bench Press",
      focusArea: "Push",
      trainingMax: 80,
      enabled: true,
      loadAdjustmentPercent: -5,
      manualAdjustmentPercent: 0,
      manualAdjustedAt: null,
      lastDecision: "regress",
    },
  ],
  pools: [],
};

const entry = (slotKey: string, name: string) => ({
  id: `${slotKey}-entry`,
  exerciseId: null,
  name,
  slotKey,
  orderIndex: slotKey === "squat" ? 0 : 1,
  sets: "3",
  reps: "5",
  minSets: 3,
  maxSets: 4,
  minReps: 5,
  maxReps: 6,
  intensityPercent: 75,
  intensityMinPercent: 75,
  intensityMaxPercent: 80,
  percentBase: "training_max",
  roundingIncrement: 2.5,
  isOptional: false,
  weight: null,
  duration: null,
  rpe: null,
  rpeCap: 8,
  selectionRole: null,
  rest: null,
  notes: null,
});

const template: ProgrammeTemplate = {
  id: "programme-1",
  name: "Adaptive strength",
  description: null,
  methodType: "adaptive_strength_12_week",
  durationWeeks: 12,
  sessionsPerWeek: 2,
  defaultSetChoice: "minimum",
  percentBase: "training_max",
  roundingIncrement: 2.5,
  workouts: [
    {
      id: "week-1-a",
      name: "Week 1 A",
      sequenceIndex: 0,
      weekNumber: 1,
      dayNumber: 1,
      sessionNumber: 1,
      description: null,
      entries: [entry("squat", "Squat"), entry("bench", "Bench")],
    },
    {
      id: "week-1-b",
      name: "Week 1 B",
      sequenceIndex: 1,
      weekNumber: 1,
      dayNumber: 4,
      sessionNumber: 2,
      description: null,
      entries: [entry("squat", "Squat"), entry("bench", "Bench")],
    },
    {
      id: "week-2-a",
      name: "Week 2 A",
      sequenceIndex: 2,
      weekNumber: 2,
      dayNumber: 1,
      sessionNumber: 1,
      description: null,
      entries: [entry("squat", "Squat"), entry("bench", "Bench")],
    },
    {
      id: "week-2-b",
      name: "Week 2 B",
      sequenceIndex: 3,
      weekNumber: 2,
      dayNumber: 4,
      sessionNumber: 2,
      description: null,
      entries: [entry("squat", "Squat"), entry("bench", "Bench")],
    },
  ],
};

function recovery(level: WeeklyRecoveryRecommendation["level"]): WeeklyRecoveryRecommendation {
  return {
    level,
    title: level,
    detail: `${level} evidence`,
    evidence: ["Recent load evidence", "Effort evidence"],
    hardDays: level === "normal" ? 0 : 3,
    decliningExercises: [],
    recentLoad: 6,
    priorLoad: 4,
    plannedLoad: 4,
    plannedDays: 3,
    effortCoverage: 80,
  };
}

test("strength coach previews the exact next programme week and clears temporary overrides", () => {
  const review = buildStrengthProgrammeReview({
    assignment,
    template,
    recovery: recovery("normal"),
  });

  assert.ok(review);
  assert.equal(review.programmeWeek, 2);
  assert.deepEqual(
    review.sessions.map((session) => session.workoutName),
    ["Week 2 A", "Week 2 B"],
  );
  assert.equal(review.sessions[0]?.scheduledDate, "2026-10-12");
  assert.equal(review.exercises[0]?.proposedManualAdjustmentPercent, 0);
  assert.equal(review.changedExerciseCount, 1);
  assert.deepEqual(
    review.sessions[0]?.movements[0]?.movement.setRows.map((set) => set.weight),
    ["75", "75", "75"],
  );
  assert.deepEqual(
    review.sessions[0]?.movements[1]?.movement.setRows.map((set) => set.weight),
    ["55", "55", "55"],
  );
});

test("lighter week adds only the reduction missing from each automatic exercise review", () => {
  const review = buildStrengthProgrammeReview({
    assignment,
    template,
    recovery: recovery("lighter"),
  });

  assert.ok(review);
  assert.equal(review.exercises[0]?.proposedManualAdjustmentPercent, -2.5);
  assert.equal(review.exercises[0]?.proposedCombinedAdjustmentPercent, -2.5);
  assert.equal(review.exercises[1]?.proposedManualAdjustmentPercent, 0);
  assert.equal(review.exercises[1]?.proposedCombinedAdjustmentPercent, -5);
  assert.equal(review.sessions[0]?.movements[0]?.movement.setRows[0]?.weight, "75");
});

test("deload review caps combined intensity at five points lower without double reducing regressions", () => {
  const review = buildStrengthProgrammeReview({
    assignment,
    template,
    recovery: recovery("deload"),
  });

  assert.ok(review);
  assert.equal(review.exercises[0]?.proposedManualAdjustmentPercent, -5);
  assert.equal(review.exercises[0]?.proposedCombinedAdjustmentPercent, -5);
  assert.equal(review.exercises[1]?.proposedManualAdjustmentPercent, 0);
  assert.equal(review.exercises[1]?.proposedCombinedAdjustmentPercent, -5);
  assert.equal(review.sessions[0]?.movements[0]?.movement.setRows.length, 3);
  assert.equal(review.sessions[0]?.movements[0]?.movement.setRows[0]?.weight, "70");
});

test("review edits recalculate the exact preview before apply", () => {
  const review = buildStrengthProgrammeReview({
    assignment,
    template,
    recovery: recovery("deload"),
    manualAdjustments: { "mapping-1": -2.5, "mapping-2": 2.5 },
  });

  assert.ok(review);
  assert.equal(review.exercises[0]?.proposedCombinedAdjustmentPercent, -2.5);
  assert.equal(review.exercises[1]?.proposedCombinedAdjustmentPercent, -2.5);
  assert.equal(review.sessions[0]?.movements[0]?.movement.setRows[0]?.weight, "75");
  assert.equal(review.sessions[0]?.movements[1]?.movement.setRows[0]?.weight, "57.5");
});
