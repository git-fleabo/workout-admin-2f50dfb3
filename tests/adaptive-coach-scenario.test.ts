import assert from "node:assert/strict";
import test from "node:test";
import { buildWeeklyPlan } from "../src/lib/weekly-plan.ts";
import { buildCoachReadinessSnapshot } from "../src/lib/coach-readiness.ts";
import { buildCoachOutcomeState } from "../src/lib/coach-outcome.ts";
import { buildWeeklyCoachRollover } from "../src/lib/weekly-coach-rollover.ts";
import { buildWeeklyCoachDraft } from "../src/lib/weekly-coach-draft.ts";
import type { SavedWorkoutPlan } from "../src/lib/supabase-plans.browser.ts";
import type { RecentWorkoutLog } from "../src/lib/workout-plan.ts";
import type { ProgrammeSupportPlanHistoryEntry } from "../src/lib/programme-support.ts";
import type { CoachingRecommendationDecision } from "../src/lib/supabase-coaching-recommendations.browser.ts";
import type { ProgrammeScheduleSession } from "../src/lib/supabase-programmes.browser.ts";

// Dates advance deliberately; this is a scenario, not a claim of two elapsed
// weeks of real training. The same evidence feeds readiness, outcome and draft.
test("two-week coach loop carries completion forward and protects against contradictory pain evidence", () => {
  const preferences = {
    primaryFocusId: "programme",
    secondaryFocusIds: ["goal:handstand"],
    maintenanceFocusIds: [],
    weeklyTrainingDays: 6,
    weeklyMinutes: 360,
    maxDemandingDays: 5,
    saved: true,
  };
  const candidates = [
    {
      focusId: "goal:handstand",
      sourceId: "handstand",
      kind: "skill" as const,
      title: "Handstand",
      defaultPlacement: "with_strength" as const,
      draft: {
        version: 1 as const,
        title: "Handstand",
        locationKind: "home" as const,
        basis: "Optional",
        movements: [],
      },
      planKind: "skill" as const,
      goalId: "handstand",
      mobilityRunId: null,
      programAssignmentId: "run",
      estimatedMinutes: 15,
    },
  ];
  const programme = (dates: string[]) =>
    dates.map((date, i) => ({
      assignmentId: "run",
      programWorkoutId: `w${i}`,
      date,
      programmeName: "Strength",
      workoutName: `Session ${i + 1}`,
      movementNames: ["Press"],
      movements: [],
      status: "current",
    })) as ProgrammeScheduleSession[];
  const domains = (week: 1 | 2): SavedWorkoutPlan[] =>
    [
      { kind: "climbing" as const, day: week === 1 ? "15" : "22", minutes: 45 },
      { kind: "yoga" as const, day: week === 1 ? "18" : "25", minutes: 30 },
      { kind: "mobility" as const, day: week === 1 ? "12" : "19", minutes: 15 },
    ].map(({ kind, day, minutes }) => ({
      version: 1,
      title: kind,
      locationKind: "home",
      basis: "Optional",
      movements: [
        {
          exercise: kind,
          workoutType: kind,
          trackingMode: "duration",
          sourceDate: "",
          reason: "Test",
          targets: {
            durationMinutes: String(minutes),
            distance: "",
            distanceUnit: "",
            rounds: "",
            height: "",
            detail: "",
          },
          setRows: [],
        },
      ],
      suggestedWorkoutId: `${week}-${kind}`,
      suggestedFor: `2026-10-${day}`,
      planKind: kind,
      status: "pending",
      readiness: "normal",
      createdAt: "2026-10-10",
      goalId: null,
      programWorkoutId: null,
      programAssignmentId: null,
    }));
  const weekOne = buildWeeklyPlan({ home: [], gym: [] }, "2026-10-12");
  const initialReadiness = buildCoachReadinessSnapshot({
    logs: [],
    loadHistory: [],
    plan: weekOne,
    adjustments: {},
    supportPlans: [],
    today: weekOne.startDate,
  });
  const initial = buildWeeklyCoachDraft({
    plan: weekOne,
    programmeSessions: programme(["2026-10-12", "2026-10-14", "2026-10-16"]),
    scheduledPlans: domains(1),
    preferences,
    candidates,
    today: weekOne.startDate,
    readiness: initialReadiness,
  });
  assert.equal(initial.adaptation.mode, "maintain");
  assert.equal(initial.additions.length, 1);
  assert.equal(initial.additions[0].pairedWithStrength, true);
  assert.deepEqual(
    initial.capacity.byKind.map((item) => item.kind),
    ["climbing", "mobility", "skill", "strength", "yoga"],
  );

  const dates = ["2026-10-12", "2026-10-14", "2026-10-16", "2026-10-18"];
  const logs = dates.map((date) => ({
    id: `s-${date}`,
    date,
    completed: true,
    exercise: "Handstand",
    workoutType: "Skills/Calisthenics",
    entryKind: "Skill",
    pain: "0",
    rpe: "7",
    weight: "",
    reps: "5",
    sets: "3",
    setRows: [],
  })) as RecentWorkoutLog[];
  const supportPlans = dates.map((date) => ({
    date,
    status: "completed",
    goalId: "handstand",
    mobilityRunId: null,
    locationKind: "home",
    plannedSets: 3,
    plannedDose: 5,
    doseUnit: "reps",
  })) as ProgrammeSupportPlanHistoryEntry[];
  const decisions = [
    {
      id: "accepted",
      weekStart: weekOne.startDate,
      recommendationKey: "moved",
      recommendationType: "move_session",
      subjectFocusId: "goal:handstand",
      decision: "accepted",
      originalDate: dates[0],
      proposedDate: dates[1],
      chosenDate: dates[1],
      sessionLabel: "Handstand",
      workoutStatus: "completed",
      completedSessionId: `s-${dates[1]}`,
      outcomeRating: null,
      adjustment: null,
    },
  ] as CoachingRecommendationDecision[];
  const outcomes = buildCoachOutcomeState({ decisions, logs, today: "2026-10-19" });
  assert.equal(outcomes.pendingReview, null);
  assert.equal(outcomes.history[0].outcomeRating, "right");
  const rollover = buildWeeklyCoachRollover({
    preferences,
    review: {
      weekStart: weekOne.startDate,
      weekEnd: weekOne.endDate,
      isCompleteWeek: true,
      summary: { sessions: 10, activeDays: 5, minutes: 330, hardDays: 4 },
      adherence: { total: 4, completed: 4 },
      programmeAdherence: { due: 3, completed: 3 },
    },
  });
  assert.equal(rollover?.status, "steady");
  const weekTwo = buildWeeklyPlan({ home: [], gym: [] }, "2026-10-19");
  const readiness = (evidence: RecentWorkoutLog[]) =>
    buildCoachReadinessSnapshot({
      logs: evidence,
      loadHistory: [],
      plan: weekTwo,
      adjustments: {},
      supportPlans,
      today: weekTwo.startDate,
    });
  const next = (evidence: RecentWorkoutLog[]) =>
    buildWeeklyCoachDraft({
      plan: weekTwo,
      programmeSessions: programme(["2026-10-19", "2026-10-21", "2026-10-23"]),
      scheduledPlans: domains(2),
      preferences,
      candidates,
      today: weekTwo.startDate,
      readiness: readiness(evidence),
      rollover,
      history: outcomes.history,
    });
  const stable = next(logs);
  assert.equal(stable.adaptation.mode, "build");
  assert.equal(stable.adaptation.allowDoseProgression, true);
  const withPain = next(logs.map((log) => (log.date === dates[3] ? { ...log, pain: "4" } : log)));
  assert.equal(withPain.adaptation.mode, "protect");
  assert.equal(withPain.adaptation.allowDoseProgression, false);
  assert.equal(withPain.additions.length, 0);
  assert.equal(withPain.adaptation.hasMixedEvidence, true);
  assert.notEqual(stable.sourceFingerprint, withPain.sourceFingerprint);
});
