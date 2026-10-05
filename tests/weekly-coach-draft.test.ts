import assert from "node:assert/strict";
import test from "node:test";

import type { CoachingPreferences } from "../src/lib/coaching-preferences.ts";
import type { SavedWorkoutPlan } from "../src/lib/supabase-plans.browser.ts";
import type { ProgrammeScheduleSession } from "../src/lib/supabase-programmes.browser.ts";
import {
  buildWeeklyCoachDraft,
  validateWeeklyCoachDraftSelection,
  type WeeklyCoachDraftCandidate,
} from "../src/lib/weekly-coach-draft.ts";
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
  secondaryFocusIds: ["goal:handstand", "mobility:shoulder"],
  maintenanceFocusIds: [],
  weeklyTrainingDays: 3,
  weeklyMinutes: 300,
  maxDemandingDays: 3,
  saved: true,
};

function candidate(focusId: string, kind: "skill" | "mobility"): WeeklyCoachDraftCandidate {
  const sourceId = focusId.split(":")[1];
  return {
    focusId,
    sourceId,
    kind,
    title: kind === "skill" ? "Handstand" : "Shoulder mobility",
    defaultPlacement: kind === "skill" ? "with_strength" : "separate",
    draft: {
      version: 1,
      title: kind === "skill" ? "Handstand practice" : "Shoulder mobility practice",
      locationKind: "home",
      basis: "Test draft",
      movements: [],
      ...(kind === "mobility" ? { mobilityRunId: sourceId } : {}),
    },
    planKind: kind,
    goalId: kind === "skill" ? sourceId : null,
    mobilityRunId: kind === "mobility" ? sourceId : null,
    programAssignmentId: "assignment-1",
    estimatedMinutes: 15,
  };
}

function programme(date: string) {
  return {
    assignmentId: "assignment-1",
    programWorkoutId: `workout-${date}`,
    programmeName: "Strength block",
    workoutName: "Session A",
    date,
    status: "current",
    movements: [],
    movementNames: ["Squat"],
  } as ProgrammeScheduleSession;
}

function scheduled(
  id: string,
  date: string,
  planKind: SavedWorkoutPlan["planKind"],
  goalId: string | null = null,
) {
  return {
    version: 1,
    suggestedWorkoutId: id,
    title: id,
    locationKind: "home",
    basis: "Test",
    movements: [],
    readiness: "normal",
    status: "pending",
    createdAt: date,
    programAssignmentId: null,
    programWorkoutId: null,
    goalId,
    suggestedFor: date,
    planKind,
  } as SavedWorkoutPlan;
}

test("drafting pairs skill work with strength and puts mobility on an open day", () => {
  const draft = buildWeeklyCoachDraft({
    plan,
    programmeSessions: [programme(dates[0])],
    scheduledPlans: [],
    preferences,
    candidates: [candidate("goal:handstand", "skill"), candidate("mobility:shoulder", "mobility")],
    today: dates[0],
  });

  assert.equal(draft.additions.length, 2);
  assert.equal(draft.additions[0].focusId, "goal:handstand");
  assert.equal(draft.additions[0].date, dates[0]);
  assert.equal(draft.additions[0].pairedWithStrength, true);
  assert.equal(draft.additions[1].focusId, "mobility:shoulder");
  assert.notEqual(draft.additions[1].date, dates[0]);
  assert.equal(
    new Set([...draft.existingDates, ...draft.additions.map((item) => item.date)]).size,
    2,
  );
});

test("a priority already saved in the week is not drafted again", () => {
  const draft = buildWeeklyCoachDraft({
    plan,
    programmeSessions: [programme(dates[0])],
    scheduledPlans: [scheduled("skill", dates[0], "skill", "handstand")],
    preferences,
    candidates: [candidate("goal:handstand", "skill"), candidate("mobility:shoulder", "mobility")],
    today: dates[0],
  });

  assert.deepEqual(
    draft.additions.map((item) => item.focusId),
    ["mobility:shoulder"],
  );
});

test("mobility shares a non-strength day when the training-day limit is already full", () => {
  const draft = buildWeeklyCoachDraft({
    plan,
    programmeSessions: [programme(dates[0])],
    scheduledPlans: [scheduled("climbing", dates[2], "climbing")],
    preferences: {
      ...preferences,
      secondaryFocusIds: ["mobility:shoulder"],
      weeklyTrainingDays: 2,
    },
    candidates: [candidate("mobility:shoulder", "mobility")],
    today: dates[0],
  });

  assert.equal(draft.additions[0].date, dates[2]);
  assert.match(draft.additions[0].reason, /Shares an existing training day/);
});

test("drafting requires saved coaching priorities", () => {
  const draft = buildWeeklyCoachDraft({
    plan,
    programmeSessions: [programme(dates[0])],
    scheduledPlans: [],
    preferences: { ...preferences, saved: false },
    candidates: [candidate("goal:handstand", "skill")],
    today: dates[0],
  });

  assert.equal(draft.additions.length, 0);
  assert.match(draft.summary, /Save your coaching priorities/);
});

test("edited dates cannot exceed the saved training-day limit", () => {
  const draft = buildWeeklyCoachDraft({
    plan,
    programmeSessions: [programme(dates[0])],
    scheduledPlans: [scheduled("climbing", dates[2], "climbing")],
    preferences: {
      ...preferences,
      secondaryFocusIds: ["mobility:shoulder"],
      weeklyTrainingDays: 2,
    },
    candidates: [candidate("mobility:shoulder", "mobility")],
    today: dates[0],
  });
  const movedToOpenDay = [{ ...draft.additions[0], date: dates[4] }];

  assert.match(
    validateWeeklyCoachDraftSelection(draft, movedToOpenDay) ?? "",
    /above your limit of 2/,
  );
});

test("a cautious rollover limits the draft to one addition", () => {
  const draft = buildWeeklyCoachDraft({
    plan,
    programmeSessions: [programme(dates[0])],
    scheduledPlans: [],
    preferences,
    candidates: [candidate("goal:handstand", "skill"), candidate("mobility:shoulder", "mobility")],
    today: dates[0],
    rollover: {
      previousWeekStart: "2026-09-28",
      previousWeekEnd: "2026-10-04",
      status: "lighter",
      title: "Keep this rollover lighter",
      detail: "Previous capacity was exceeded.",
      evidence: [],
      plannedSessions: 5,
      completedSessions: 5,
      adherencePercent: 100,
      additionLimit: 1,
    },
  });

  assert.equal(draft.additions.length, 1);
  assert.equal(draft.additions[0].focusId, "goal:handstand");
});

test("the draft does not exceed the saved minute budget", () => {
  const draft = buildWeeklyCoachDraft({
    plan,
    programmeSessions: [programme(dates[0])],
    scheduledPlans: [],
    preferences: { ...preferences, weeklyMinutes: 40 },
    candidates: [candidate("goal:handstand", "skill")],
    today: dates[0],
  });

  assert.equal(draft.capacity.plannedMinutes, 30);
  assert.equal(draft.additions.length, 0);
});

test("recovery pressure stops the draft from adding optional sessions", () => {
  const draft = buildWeeklyCoachDraft({
    plan,
    programmeSessions: [programme(dates[0])],
    scheduledPlans: [],
    preferences,
    candidates: [candidate("goal:handstand", "skill"), candidate("mobility:shoulder", "mobility")],
    today: dates[0],
    readiness: {
      status: "reduce",
      title: "Reduce support dose",
      detail: "Pain or recovery pressure supports less optional work.",
      evidence: ["Pain evidence: highest recorded score 5/10"],
      maxPain: 5,
      hardDays: 2,
      effortCoverage: 80,
      supportAdherence: 100,
      supportDue: 4,
      recoveryLevel: "deload",
    },
  });

  assert.equal(draft.adaptation.mode, "protect");
  assert.equal(draft.adaptation.additionLimit, 0);
  assert.equal(draft.additions.length, 0);
});

test("the draft revision changes when the saved week or recovery evidence changes", () => {
  const base = buildWeeklyCoachDraft({
    plan,
    programmeSessions: [programme(dates[0])],
    scheduledPlans: [],
    preferences,
    candidates: [candidate("goal:handstand", "skill")],
    today: dates[0],
  });
  const changedWeek = buildWeeklyCoachDraft({
    plan,
    programmeSessions: [programme(dates[0])],
    scheduledPlans: [scheduled("climbing", dates[2], "climbing")],
    preferences,
    candidates: [candidate("goal:handstand", "skill")],
    today: dates[0],
  });
  const changedRecovery = buildWeeklyCoachDraft({
    plan,
    programmeSessions: [programme(dates[0])],
    scheduledPlans: [],
    preferences,
    candidates: [candidate("goal:handstand", "skill")],
    today: dates[0],
    readiness: {
      status: "hold",
      title: "Hold the current dose",
      detail: "Evidence is unsettled.",
      evidence: [],
      maxPain: 1,
      hardDays: 1,
      effortCoverage: 50,
      supportAdherence: 70,
      supportDue: 4,
      recoveryLevel: "normal",
    },
  });

  assert.notEqual(base.sourceFingerprint, changedWeek.sourceFingerprint);
  assert.notEqual(base.sourceFingerprint, changedRecovery.sourceFingerprint);
});

test("selection validation enforces the adaptive addition limit", () => {
  const openDraft = buildWeeklyCoachDraft({
    plan,
    programmeSessions: [programme(dates[0])],
    scheduledPlans: [],
    preferences,
    candidates: [candidate("goal:handstand", "skill"), candidate("mobility:shoulder", "mobility")],
    today: dates[0],
  });
  const cautiousDraft = buildWeeklyCoachDraft({
    plan,
    programmeSessions: [programme(dates[0])],
    scheduledPlans: [],
    preferences,
    candidates: [candidate("goal:handstand", "skill"), candidate("mobility:shoulder", "mobility")],
    today: dates[0],
    readiness: {
      status: "hold",
      title: "Hold the current dose",
      detail: "Evidence is unsettled.",
      evidence: [],
      maxPain: 1,
      hardDays: 1,
      effortCoverage: 50,
      supportAdherence: 70,
      supportDue: 4,
      recoveryLevel: "normal",
    },
  });

  assert.equal(cautiousDraft.adaptation.additionLimit, 1);
  assert.match(
    validateWeeklyCoachDraftSelection(cautiousDraft, openDraft.additions) ?? "",
    /no more than 1 addition/i,
  );
});
