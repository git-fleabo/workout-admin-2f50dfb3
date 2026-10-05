import assert from "node:assert/strict";
import test from "node:test";

import type { CoachingPreferences } from "../src/lib/coaching-preferences.ts";
import type { SavedWorkoutPlan } from "../src/lib/supabase-plans.browser.ts";
import type { ProgrammeScheduleSession } from "../src/lib/supabase-programmes.browser.ts";
import {
  buildWeeklyCoachCapacity,
  estimateWorkoutDraftMinutes,
  projectWeeklyCoachCapacity,
} from "../src/lib/weekly-coach-capacity.ts";
import { buildYogaWorkoutDraft, type WorkoutPlanDraft } from "../src/lib/workout-plan.ts";
import type { WeeklyPlan } from "../src/lib/weekly-plan.ts";

const dates = ["05", "06", "07", "08", "09", "10", "11"].map((day) => `2026-10-${day}`);
const plan: WeeklyPlan = {
  startDate: dates[0],
  endDate: dates[6],
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
const preferences: CoachingPreferences = {
  primaryFocusId: "programme",
  secondaryFocusIds: [],
  maintenanceFocusIds: [],
  weeklyTrainingDays: 4,
  weeklyMinutes: 180,
  maxDemandingDays: 2,
  saved: true,
};

function timedDraft(title: string, minutes: number, workoutType: string): WorkoutPlanDraft {
  return {
    version: 1,
    title,
    locationKind: "gym",
    basis: "Test",
    movements: [
      {
        exercise: title,
        workoutType,
        trackingMode: workoutType === "Climbing" ? "climbing" : "duration",
        targets: {
          durationMinutes: String(minutes),
          distance: "",
          distanceUnit: "",
          rounds: "",
          height: "",
          detail: "",
        },
        sourceDate: "",
        reason: "Test",
        setRows: [],
      },
    ],
  };
}

function saved(
  id: string,
  date: string,
  planKind: SavedWorkoutPlan["planKind"],
  draft: WorkoutPlanDraft,
) {
  return {
    ...draft,
    suggestedWorkoutId: id,
    readiness: "normal",
    status: "pending",
    createdAt: date,
    programAssignmentId: null,
    programWorkoutId: null,
    goalId: null,
    suggestedFor: date,
    planKind,
  } as SavedWorkoutPlan;
}

const programme = {
  assignmentId: "assignment-1",
  programWorkoutId: "workout-1",
  programmeName: "Strength block",
  workoutName: "Session A",
  date: dates[0],
  movementNames: ["Squat", "Bench press", "Row", "Deadlift"],
  movements: [],
  status: "current",
} as ProgrammeScheduleSession;

test("capacity combines strength, climbing and yoga into one budget", () => {
  const capacity = buildWeeklyCoachCapacity({
    plan,
    programmeSessions: [programme],
    scheduledPlans: [
      saved("climb", dates[2], "climbing", timedDraft("Climbing", 45, "Climbing")),
      saved("yoga", dates[4], "yoga", buildYogaWorkoutDraft({ durationMinutes: 30 })),
    ],
    preferences,
  });

  assert.equal(capacity.plannedMinutes, 115);
  assert.equal(capacity.plannedDays, 3);
  assert.equal(capacity.demandingDays, 2);
  assert.equal(capacity.status, "near_limit");
  assert.deepEqual(
    capacity.byKind.map((item) => item.kind),
    ["climbing", "strength", "yoga"],
  );
});

test("a proposed skill session updates minutes without creating a demanding day", () => {
  const base = buildWeeklyCoachCapacity({
    plan,
    programmeSessions: [programme],
    scheduledPlans: [],
    preferences,
  });
  const skillDraft = timedDraft("Handstand practice", 15, "Skills/Calisthenics");
  const projected = projectWeeklyCoachCapacity(base, preferences, [
    {
      id: "handstand",
      date: dates[0],
      title: "Handstand",
      planKind: "skill",
      draft: skillDraft,
    },
  ]);

  assert.equal(projected.plannedMinutes, 55);
  assert.equal(projected.plannedDays, 1);
  assert.equal(projected.demandingDays, 1);
  assert.equal(projected.byKind.find((item) => item.kind === "skill")?.minutes, 15);
});

test("dose-based skill and mobility estimates stay deliberately short", () => {
  const draft: WorkoutPlanDraft = {
    version: 1,
    title: "Support",
    locationKind: "home",
    basis: "Test",
    movements: [
      {
        exercise: "Support movement",
        workoutType: "Skills/Calisthenics",
        trackingMode: "hold",
        targets: {
          durationMinutes: "",
          distance: "",
          distanceUnit: "",
          rounds: "",
          height: "",
          detail: "",
        },
        sourceDate: "",
        reason: "Test",
        setRows: Array.from({ length: 3 }, () => ({
          reps: "",
          weight: "",
          durationSeconds: "10",
          rpe: "",
          completed: true,
        })),
      },
    ],
  };

  assert.equal(estimateWorkoutDraftMinutes(draft, "skill"), 11);
  assert.equal(estimateWorkoutDraftMinutes(draft, "mobility"), 11);
});
