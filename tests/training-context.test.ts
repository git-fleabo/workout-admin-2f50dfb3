import assert from "node:assert/strict";
import test from "node:test";

import { buildTrainingContext } from "../src/lib/training-context.ts";
import type { SavedWorkoutPlan } from "../src/lib/supabase-plans.browser.ts";
import type { ProgrammeScheduleSession } from "../src/lib/supabase-programmes.browser.ts";
import type { WeeklyPlan } from "../src/lib/weekly-plan.ts";

function weeklyPlan(): WeeklyPlan {
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

function programme(date: string): ProgrammeScheduleSession {
  return {
    assignmentId: "assignment-1",
    programWorkoutId: `workout-${date}`,
    programmeName: "Strength block",
    workoutName: "Session A",
    date,
    scheduledDate: date,
    isCatchUp: false,
    weekNumber: 1,
    sessionNumber: 1,
    workoutNumber: 1,
    movementNames: ["Squat"],
    movements: [],
    selectionNotes: [],
    status: "current",
  };
}

function scheduled(
  id: string,
  date: string,
  planKind: SavedWorkoutPlan["planKind"],
): SavedWorkoutPlan {
  return {
    version: 1,
    suggestedWorkoutId: id,
    title: `${planKind} session`,
    locationKind: "gym",
    basis: "Test",
    movements: [],
    readiness: "normal",
    status: "pending",
    createdAt: date,
    programAssignmentId: null,
    programWorkoutId: null,
    goalId: null,
    suggestedFor: date,
    planKind,
  };
}

test("training context combines domains and explains clear weekly pressure points", () => {
  const context = buildTrainingContext({
    plan: weeklyPlan(),
    programmeSessions: [programme("2026-10-05")],
    scheduledPlans: [
      scheduled("skill", "2026-10-05", "skill"),
      scheduled("climb", "2026-10-06", "climbing"),
      scheduled("condition", "2026-10-07", "conditioning"),
      scheduled("mobility", "2026-10-08", "mobility"),
    ],
    adjustments: {},
  });

  assert.equal(context.counts.strength, 1);
  assert.equal(context.counts.skill, 1);
  assert.equal(context.counts.climbing, 1);
  assert.equal(context.counts.conditioning, 1);
  assert.equal(context.counts.mobility, 1);
  assert.equal(context.confidence, "high");
  assert.match(context.headline, /pressure point/);
  assert.ok(context.signals.some((signal) => signal.title.includes("3 demanding days")));
  assert.ok(context.signals.some((signal) => signal.title.includes("Skill practice")));
  assert.ok(context.signals.some((signal) => signal.title.includes("Recovery work")));
});

test("saved sessions replace matching learned expectations without hiding other domains", () => {
  const plan = weeklyPlan();
  plan.days[0].inferredItems = ["gym", "climb"];
  const context = buildTrainingContext({
    plan,
    programmeSessions: [programme("2026-10-05")],
    scheduledPlans: [],
    adjustments: {},
  });

  assert.deepEqual(context.expectations, [
    { date: "2026-10-05", kind: "climbing", label: "Climbing pattern" },
  ]);
});

test("two demanding domains on one day are surfaced without changing the plan", () => {
  const context = buildTrainingContext({
    plan: weeklyPlan(),
    programmeSessions: [programme("2026-10-05")],
    scheduledPlans: [scheduled("climb", "2026-10-05", "climbing")],
    adjustments: {},
  });

  assert.equal(context.sessions.length, 2);
  assert.ok(context.signals.some((signal) => signal.title.includes("overlaps on Monday")));
});

test("saved coaching limits and priorities are checked against the week", () => {
  const context = buildTrainingContext({
    plan: weeklyPlan(),
    programmeSessions: [programme("2026-10-05"), programme("2026-10-07")],
    scheduledPlans: [
      scheduled("climb", "2026-10-06", "climbing"),
      scheduled("condition", "2026-10-08", "conditioning"),
    ],
    adjustments: {},
    coaching: {
      preferences: {
        primaryFocusId: "goal-primary",
        secondaryFocusIds: ["goal-support"],
        maintenanceFocusIds: [],
        weeklyTrainingDays: 3,
        weeklyMinutes: 240,
        maxDemandingDays: 3,
        saved: true,
      },
      focusLabels: {
        "goal-primary": "Handstand",
        "goal-support": "Pike mobility",
      },
    },
  });

  assert.equal(context.occupiedDays, 4);
  assert.equal(context.demandingDays, 4);
  assert.ok(context.signals.some((signal) => signal.title.includes("exceed your 3-day limit")));
  assert.ok(context.signals.some((signal) => signal.title.includes("exceed your limit of 3")));
  assert.ok(
    context.signals.some((signal) => signal.title.includes("Handstand has no saved session")),
  );
  assert.ok(context.signals.some((signal) => signal.title.includes("supporting priority")));
});
