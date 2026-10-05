import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCoachReadinessSnapshot,
  buildSupportDoseOpportunities,
} from "../src/lib/coach-readiness.ts";
import type {
  ProgrammeSupportPlanHistoryEntry,
  SkillGoalExercise,
} from "../src/lib/programme-support.ts";
import type { SavedWorkoutPlan } from "../src/lib/supabase-plans.browser.ts";
import type { GoalRow } from "../src/lib/training-types.ts";
import type { WeeklyPlan } from "../src/lib/weekly-plan.ts";
import type { RecentWorkoutLog } from "../src/lib/workout-plan.ts";

function plan(): WeeklyPlan {
  const dates = [
    "2026-10-05",
    "2026-10-06",
    "2026-10-07",
    "2026-10-08",
    "2026-10-09",
    "2026-10-10",
    "2026-10-11",
  ];
  return {
    startDate: dates[0],
    endDate: dates.at(-1) ?? dates[0],
    days: dates.map((date) => ({
      date,
      expected: [],
      completed: [],
      inferredItems: [],
      completedItems: [],
    })),
    locations: {
      home: {
        location: "home",
        frequency: 0,
        confidence: "none",
        sourceDays: 0,
        expectedDates: [],
        suggestion: null,
        progressionExercises: [],
        fatigueExercises: [],
      },
      gym: {
        location: "gym",
        frequency: 0,
        confidence: "none",
        sourceDays: 0,
        expectedDates: [],
        suggestion: null,
        progressionExercises: [],
        fatigueExercises: [],
      },
    },
    loadPatterns: [],
  };
}

function log(date: string, pain: string, rpe = "7"): RecentWorkoutLog {
  return {
    id: `session-${date}`,
    date,
    exercise: "Handstand",
    workoutType: "Skills/Calisthenics",
    entryKind: "exercise",
    completed: true,
    pain,
    rpe,
    weight: "",
    reps: "5",
    sets: "3",
    setRows: [],
  } as RecentWorkoutLog;
}

function supportHistory(dates: string[], statuses: string[]): ProgrammeSupportPlanHistoryEntry[] {
  return dates.map((date, index) => ({
    date,
    status: statuses[index] ?? "completed",
    goalId: "goal-1",
    mobilityRunId: null,
    locationKind: "home",
    plannedSets: 3,
    plannedDose: 5,
    doseUnit: "reps",
  }));
}

function upcomingSupport(): SavedWorkoutPlan {
  return {
    version: 1,
    suggestedWorkoutId: "support-1",
    title: "Handstand practice",
    locationKind: "home",
    basis: "Support",
    movements: [
      {
        exerciseId: "exercise-1",
        exercise: "Handstand",
        workoutType: "Skills/Calisthenics",
        trackingMode: "reps_only",
        targets: {
          durationMinutes: "",
          distance: "",
          distanceUnit: "",
          rounds: "",
          height: "",
          detail: "",
        },
        sourceDate: "",
        reason: "Support",
        setRows: Array.from({ length: 3 }, () => ({
          reps: "5",
          weight: "",
          durationSeconds: "",
          rpe: "",
          completed: true,
        })),
      },
    ],
    readiness: "normal",
    status: "pending",
    createdAt: "2026-10-05",
    programAssignmentId: "assignment-1",
    programWorkoutId: null,
    goalId: "goal-1",
    suggestedFor: "2026-10-06",
    planKind: "skill",
  };
}

const goal = {
  id: "goal-1",
  status: "active",
  exerciseId: "exercise-1",
  trackingMode: "reps_only",
  targetValue: 10,
  targetUnit: "reps",
  goalMetric: "reps",
  goal: "10 handstand reps",
} as GoalRow;

const exercise = {
  id: "exercise-1",
  name: "Handstand",
  workoutType: "Skills/Calisthenics",
  metric: "Reps",
  suggestedSets: "3",
  suggestedReps: "5",
  availableLocationKinds: ["home"],
} as SkillGoalExercise;

test("pain evidence triggers one small reduction to optional support dose", () => {
  const readiness = buildCoachReadinessSnapshot({
    logs: [log("2026-10-05", "5")],
    loadHistory: [],
    plan: plan(),
    adjustments: {},
    supportPlans: [],
    today: "2026-10-05",
  });
  assert.equal(readiness.status, "reduce");
  assert.equal(readiness.maxPain, 5);

  const opportunities = buildSupportDoseOpportunities({
    readiness,
    scheduledPlans: [upcomingSupport()],
    goals: [goal],
    exercises: [exercise],
    skillHistory: {},
  });
  assert.equal(opportunities.length, 1);
  assert.equal(opportunities[0].adjustment, "reduce");
  assert.equal(opportunities[0].currentSets, 3);
  assert.equal(opportunities[0].targetSets, 2);
  assert.equal(opportunities[0].targetValue, 5);
});

test("low support adherence holds dose even when pain is clear", () => {
  const readiness = buildCoachReadinessSnapshot({
    logs: [log("2026-10-04", "0")],
    loadHistory: [],
    plan: plan(),
    adjustments: {},
    supportPlans: supportHistory(["2026-09-28", "2026-10-01"], ["completed", "skipped"]),
    today: "2026-10-05",
  });
  assert.equal(readiness.status, "hold");
  assert.equal(readiness.supportAdherence, 50);
});

test("stable readiness plus four successful weeks offers the proven next dose step", () => {
  const completedDates = ["2026-09-08", "2026-09-15", "2026-09-22", "2026-09-29"];
  const readiness = buildCoachReadinessSnapshot({
    logs: [
      log("2026-09-28", "0"),
      log("2026-09-30", "0"),
      log("2026-10-02", "0"),
      log("2026-10-04", "0"),
    ],
    loadHistory: [],
    plan: plan(),
    adjustments: {},
    supportPlans: supportHistory(
      completedDates,
      completedDates.map(() => "completed"),
    ),
    today: "2026-10-05",
  });
  assert.equal(readiness.status, "ready");

  const opportunities = buildSupportDoseOpportunities({
    readiness,
    scheduledPlans: [upcomingSupport()],
    goals: [goal],
    exercises: [exercise],
    skillHistory: {
      "goal-1": completedDates.map((date) => ({
        date,
        plannedSets: 3,
        plannedDose: 5,
        successful: true,
      })),
    },
  });
  assert.equal(opportunities.length, 1);
  assert.equal(opportunities[0].adjustment, "progress");
  assert.equal(opportunities[0].currentValue, 5);
  assert.equal(opportunities[0].targetValue, 6);
});
