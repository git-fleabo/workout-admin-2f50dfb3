import assert from "node:assert/strict";
import test from "node:test";

import { buildTrainingContext } from "../src/lib/training-context.ts";
import { buildWeeklyCoachRecommendation } from "../src/lib/weekly-coach-recommendation.ts";
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

test("the coach proposes one editable move and never moves a programme session", () => {
  const plan = weeklyPlan();
  const preferences = {
    primaryFocusId: "programme",
    secondaryFocusIds: [],
    maintenanceFocusIds: [],
    weeklyTrainingDays: 4,
    weeklyMinutes: 300,
    maxDemandingDays: 3,
    saved: true,
  };
  const context = buildTrainingContext({
    plan,
    programmeSessions: [programme("2026-10-05")],
    scheduledPlans: [scheduled("climb", "2026-10-05", "climbing")],
    adjustments: {},
  });
  const recommendation = buildWeeklyCoachRecommendation({ context, plan, preferences });

  assert.ok(recommendation);
  assert.equal(recommendation.suggestedWorkoutId, "climb");
  assert.equal(recommendation.fromDate, "2026-10-05");
  assert.equal(recommendation.proposedDate, "2026-10-06");
  assert.match(recommendation.rationale, /without moving a programme session/i);
  assert.equal(
    buildWeeklyCoachRecommendation({
      context,
      plan,
      preferences,
      decidedKeys: [recommendation.key],
    }),
    null,
  );
  assert.equal(
    buildWeeklyCoachRecommendation({
      context,
      plan,
      preferences: { ...preferences, weeklyTrainingDays: 1, maxDemandingDays: 1 },
    }),
    null,
  );
});

test("the coach learns a preferred destination day from accepted and edited moves", () => {
  const plan = weeklyPlan();
  const preferences = {
    primaryFocusId: "programme",
    secondaryFocusIds: [],
    maintenanceFocusIds: [],
    weeklyTrainingDays: 4,
    weeklyMinutes: 300,
    maxDemandingDays: 3,
    saved: true,
  };
  const context = buildTrainingContext({
    plan,
    programmeSessions: [programme("2026-10-05")],
    scheduledPlans: [scheduled("climb", "2026-10-05", "climbing")],
    adjustments: {},
  });
  const recommendation = buildWeeklyCoachRecommendation({
    context,
    plan,
    preferences,
    history: [
      {
        weekStart: "2026-09-28",
        recommendationType: "move_session",
        subjectFocusId: "kind:climbing",
        decision: "accepted",
        proposedDate: "2026-09-29",
        chosenDate: "2026-10-02",
      },
    ],
  });

  assert.ok(recommendation);
  assert.equal(recommendation.type, "move_session");
  assert.equal(recommendation.proposedDate, "2026-10-09");
  assert.match(recommendation.learningNote ?? "", /previous review favoured Friday/i);
});

test("rejected suggestions lower the priority of similar future moves", () => {
  const plan = weeklyPlan();
  const preferences = {
    primaryFocusId: "programme",
    secondaryFocusIds: [],
    maintenanceFocusIds: [],
    weeklyTrainingDays: 4,
    weeklyMinutes: 300,
    maxDemandingDays: 3,
    saved: true,
  };
  const context = buildTrainingContext({
    plan,
    programmeSessions: [programme("2026-10-05"), programme("2026-10-06")],
    scheduledPlans: [
      scheduled("climb", "2026-10-05", "climbing"),
      scheduled("conditioning", "2026-10-06", "conditioning"),
    ],
    adjustments: {},
  });
  const recommendation = buildWeeklyCoachRecommendation({
    context,
    plan,
    preferences,
    history: [
      {
        weekStart: "2026-09-28",
        recommendationType: "move_session",
        subjectFocusId: "kind:climbing",
        decision: "rejected",
        proposedDate: "2026-09-29",
        chosenDate: null,
      },
    ],
  });

  assert.ok(recommendation);
  assert.equal(recommendation.type, "move_session");
  assert.equal(recommendation.suggestedWorkoutId, "conditioning");
});

test("the coach can reduce one maintenance support session when the week exceeds its day limit", () => {
  const plan = weeklyPlan();
  const maintenance = {
    ...scheduled("maintenance", "2026-10-09", "skill"),
    title: "Handstand maintenance",
    programAssignmentId: "assignment-1",
    goalId: "maintenance-goal",
  };
  const scheduledPlans = [
    scheduled("mobility-1", "2026-10-05", "mobility"),
    scheduled("mobility-2", "2026-10-06", "mobility"),
    scheduled("mobility-3", "2026-10-07", "mobility"),
    scheduled("mobility-4", "2026-10-08", "mobility"),
    maintenance,
  ];
  const preferences = {
    primaryFocusId: "programme",
    secondaryFocusIds: [],
    maintenanceFocusIds: ["goal:maintenance-goal"],
    weeklyTrainingDays: 4,
    weeklyMinutes: 300,
    maxDemandingDays: 3,
    saved: true,
  };
  const context = buildTrainingContext({
    plan,
    programmeSessions: [],
    scheduledPlans,
    adjustments: {},
  });
  const recommendation = buildWeeklyCoachRecommendation({
    context,
    plan,
    preferences,
    scheduledPlans,
  });

  assert.ok(recommendation);
  assert.equal(recommendation.type, "skip_support_session");
  assert.equal(recommendation.suggestedWorkoutId, "maintenance");
  assert.match(recommendation.rationale, /maintenance session frees one complete day/i);

  assert.equal(
    buildWeeklyCoachRecommendation({
      context,
      plan,
      preferences: { ...preferences, maintenanceFocusIds: [] },
      scheduledPlans,
    }),
    null,
  );
});

test("the coach offers a reviewed support dose after schedule pressure is resolved", () => {
  const plan = weeklyPlan();
  const preferences = {
    primaryFocusId: "programme",
    secondaryFocusIds: ["goal:skill"],
    maintenanceFocusIds: [],
    weeklyTrainingDays: 4,
    weeklyMinutes: 300,
    maxDemandingDays: 3,
    saved: true,
  };
  const context = buildTrainingContext({
    plan,
    programmeSessions: [],
    scheduledPlans: [],
    adjustments: {},
  });
  const recommendation = buildWeeklyCoachRecommendation({
    context,
    plan,
    preferences,
    doseOpportunities: [
      {
        suggestedWorkoutId: "support-1",
        subjectFocusId: "goal:skill",
        sessionLabel: "Handstand practice",
        date: "2026-10-06",
        adjustment: "progress",
        currentSets: 3,
        currentValue: 5,
        targetSets: 3,
        targetValue: 6,
        doseUnit: "reps",
        rationale: "Four successful weeks support a small increase.",
      },
    ],
  });

  assert.ok(recommendation);
  assert.equal(recommendation.type, "adjust_support_dose");
  assert.equal(recommendation.targetValue, 6);
  assert.match(recommendation.title, /Progress Handstand practice/);
});

test("a too-hard outcome deprioritises the same support progression next time", () => {
  const plan = weeklyPlan();
  const context = buildTrainingContext({
    plan,
    programmeSessions: [],
    scheduledPlans: [],
    adjustments: {},
  });
  const opportunity = {
    date: "2026-10-06",
    adjustment: "progress" as const,
    currentSets: 3,
    currentValue: 5,
    targetSets: 3,
    targetValue: 6,
    doseUnit: "reps" as const,
    rationale: "Four successful weeks support a small increase.",
  };
  const recommendation = buildWeeklyCoachRecommendation({
    context,
    plan,
    preferences: {
      primaryFocusId: "programme",
      secondaryFocusIds: ["goal:handstand", "goal:pull-up"],
      maintenanceFocusIds: [],
      weeklyTrainingDays: 4,
      weeklyMinutes: 300,
      maxDemandingDays: 3,
      saved: true,
    },
    doseOpportunities: [
      {
        ...opportunity,
        suggestedWorkoutId: "handstand-next",
        subjectFocusId: "goal:handstand",
        sessionLabel: "Handstand practice",
      },
      {
        ...opportunity,
        suggestedWorkoutId: "pull-up-next",
        subjectFocusId: "goal:pull-up",
        sessionLabel: "Pull-up practice",
      },
    ],
    history: [
      {
        weekStart: "2026-09-28",
        recommendationType: "adjust_support_dose",
        subjectFocusId: "goal:handstand",
        decision: "accepted",
        proposedDate: "2026-09-29",
        chosenDate: null,
        outcomeRating: "too_hard",
      },
    ],
  });

  assert.equal(recommendation?.suggestedWorkoutId, "pull-up-next");
});

test("a protective stance can reduce optional frequency before the day limit is exceeded", () => {
  const plan = weeklyPlan();
  const maintenance = {
    ...scheduled("maintenance", "2026-10-09", "mobility"),
    title: "Pike mobility maintenance",
    programAssignmentId: "assignment-1",
    mobilityRunId: "pike-run",
  };
  const preferences = {
    primaryFocusId: "programme",
    secondaryFocusIds: [],
    maintenanceFocusIds: ["mobility:pike-run"],
    weeklyTrainingDays: 4,
    weeklyMinutes: 300,
    maxDemandingDays: 3,
    saved: true,
  };
  const context = buildTrainingContext({
    plan,
    programmeSessions: [],
    scheduledPlans: [maintenance],
    adjustments: {},
  });
  const recommendation = buildWeeklyCoachRecommendation({
    context,
    plan,
    preferences,
    scheduledPlans: [maintenance],
    adaptation: {
      mode: "protect",
      confidence: "high",
      hasMixedEvidence: false,
      guardrail: "One reviewed change at a time.",
      title: "Protect recovery this week",
      detail: "Recovery pressure supports one optional reduction.",
      additionLimit: 0,
      allowDoseProgression: false,
      preferOptionalReduction: true,
      frequencyAction: "Omit one optional session.",
      doseAction: "Reduce one small step.",
      placementAction: "Separate demanding work.",
      evidence: ["Pain evidence: elevated"],
    },
  });

  assert.equal(context.occupiedDays, 1);
  assert.equal(recommendation?.type, "skip_support_session");
  assert.equal(recommendation?.suggestedWorkoutId, "maintenance");
  assert.match(recommendation?.rationale ?? "", /protective week/i);
});

test("a maintain stance does not offer a support-dose progression", () => {
  const plan = weeklyPlan();
  const context = buildTrainingContext({
    plan,
    programmeSessions: [],
    scheduledPlans: [],
    adjustments: {},
  });
  const recommendation = buildWeeklyCoachRecommendation({
    context,
    plan,
    preferences: {
      primaryFocusId: "programme",
      secondaryFocusIds: ["goal:skill"],
      maintenanceFocusIds: [],
      weeklyTrainingDays: 4,
      weeklyMinutes: 300,
      maxDemandingDays: 3,
      saved: true,
    },
    doseOpportunities: [
      {
        suggestedWorkoutId: "support-1",
        subjectFocusId: "goal:skill",
        sessionLabel: "Handstand practice",
        date: "2026-10-06",
        adjustment: "progress",
        currentSets: 3,
        currentValue: 5,
        targetSets: 3,
        targetValue: 6,
        doseUnit: "reps",
        rationale: "Four successful weeks support a small increase.",
      },
    ],
    adaptation: {
      mode: "maintain",
      confidence: "medium",
      hasMixedEvidence: false,
      guardrail: "One reviewed change at a time.",
      title: "Keep the week steady",
      detail: "Evidence is still settling.",
      additionLimit: 1,
      allowDoseProgression: false,
      preferOptionalReduction: false,
      frequencyAction: "Hold frequency.",
      doseAction: "Hold dose.",
      placementAction: "Resolve overlaps.",
      evidence: ["Adherence is unsettled"],
    },
  });

  assert.equal(recommendation, null);
});
