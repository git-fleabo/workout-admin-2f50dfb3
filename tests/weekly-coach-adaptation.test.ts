import assert from "node:assert/strict";
import test from "node:test";

import type { CoachReadinessSnapshot } from "../src/lib/coach-readiness.ts";
import { buildWeeklyCoachAdaptation } from "../src/lib/weekly-coach-adaptation.ts";
import type { WeeklyCoachCapacity } from "../src/lib/weekly-coach-capacity.ts";

function readiness(status: CoachReadinessSnapshot["status"]): CoachReadinessSnapshot {
  return {
    status,
    title:
      status === "ready"
        ? "Progression can be reviewed"
        : status === "reduce"
          ? "Reduce support dose"
          : "Hold the current dose",
    detail: "Test evidence",
    evidence: ["Test evidence"],
    maxPain: status === "reduce" ? 5 : 0,
    hardDays: status === "reduce" ? 2 : 1,
    effortCoverage: 80,
    supportAdherence: status === "hold" ? 50 : 100,
    supportDue: 4,
    recoveryLevel: status === "reduce" ? "deload" : "normal",
  };
}

function capacity(status: WeeklyCoachCapacity["status"]): WeeklyCoachCapacity {
  return {
    status,
    headline: "Test capacity",
    weeklyMinutes: 300,
    plannedMinutes: status === "over_limit" ? 330 : status === "near_limit" ? 270 : 180,
    remainingMinutes: status === "over_limit" ? 0 : status === "near_limit" ? 30 : 120,
    weeklyTrainingDays: 4,
    plannedDays: status === "over_limit" ? 5 : status === "near_limit" ? 4 : 3,
    remainingDays: status === "balanced" ? 1 : 0,
    maxDemandingDays: 3,
    demandingDays: status === "over_limit" ? 4 : status === "near_limit" ? 3 : 2,
    remainingDemandingDays: status === "balanced" ? 1 : 0,
    sessions: [],
    byKind: [],
  };
}

test("pain or recovery pressure protects the week across frequency, dose and placement", () => {
  const adaptation = buildWeeklyCoachAdaptation({
    readiness: readiness("reduce"),
    capacity: capacity("balanced"),
    currentWeek: "2026-10-05",
  });

  assert.equal(adaptation.mode, "protect");
  assert.equal(adaptation.additionLimit, 0);
  assert.equal(adaptation.allowDoseProgression, false);
  assert.equal(adaptation.preferOptionalReduction, true);
  assert.match(adaptation.frequencyAction, /omit one/i);
  assert.match(adaptation.doseAction, /reduction/i);
  assert.match(adaptation.placementAction, /separate demanding/i);
});

test("unsettled adherence or near capacity holds the week to one missing priority", () => {
  const adaptation = buildWeeklyCoachAdaptation({
    readiness: readiness("hold"),
    capacity: capacity("near_limit"),
    currentWeek: "2026-10-05",
  });

  assert.equal(adaptation.mode, "maintain");
  assert.equal(adaptation.additionLimit, 1);
  assert.equal(adaptation.allowDoseProgression, false);
});

test("stable evidence builds within capacity by one reviewed dose step", () => {
  const adaptation = buildWeeklyCoachAdaptation({
    readiness: readiness("ready"),
    capacity: capacity("balanced"),
    currentWeek: "2026-10-05",
    history: [
      {
        weekStart: "2026-09-28",
        recommendationType: "move_session",
        subjectFocusId: "kind:climbing",
        decision: "accepted",
        proposedDate: "2026-09-30",
        chosenDate: "2026-10-02",
        outcomeRating: "right",
      },
    ],
  });

  assert.equal(adaptation.mode, "build");
  assert.equal(adaptation.additionLimit, 2);
  assert.equal(adaptation.allowDoseProgression, true);
  assert.ok(adaptation.evidence.some((item) => item.includes("felt right")));
});

test("a recent too-hard outcome overrides otherwise ready evidence", () => {
  const adaptation = buildWeeklyCoachAdaptation({
    readiness: readiness("ready"),
    capacity: capacity("balanced"),
    currentWeek: "2026-10-05",
    history: [
      {
        weekStart: "2026-09-28",
        recommendationType: "adjust_support_dose",
        subjectFocusId: "goal:handstand",
        decision: "accepted",
        proposedDate: "2026-09-30",
        chosenDate: null,
        outcomeRating: "too_hard",
      },
    ],
  });

  assert.equal(adaptation.mode, "protect");
  assert.equal(adaptation.additionLimit, 0);
  assert.ok(adaptation.evidence.some((item) => item.includes("too hard")));
});

test("a low-completion rebuild keeps one manageable supporting action", () => {
  const adaptation = buildWeeklyCoachAdaptation({
    readiness: readiness("hold"),
    capacity: capacity("balanced"),
    currentWeek: "2026-10-05",
    rollover: {
      status: "rebuild",
      title: "Rebuild from one useful action",
      detail: "Last week had too little completed work to add more.",
      additionLimit: 1,
      previousWeekStart: "2026-09-28",
      previousWeekEnd: "2026-10-04",
      adherencePercent: 40,
      evidence: ["2/5 planned sessions completed"],
      plannedSessions: 5,
      completedSessions: 2,
    },
  });

  assert.equal(adaptation.mode, "protect");
  assert.equal(adaptation.additionLimit, 1);
  assert.equal(adaptation.preferOptionalReduction, false);
  assert.match(adaptation.frequencyAction, /one supporting session/i);
});

test("contradictory progression and recovery signals resolve conservatively", () => {
  const adaptation = buildWeeklyCoachAdaptation({
    readiness: readiness("reduce"),
    capacity: capacity("balanced"),
    currentWeek: "2026-10-05",
    history: [
      {
        weekStart: "2026-09-28",
        recommendationType: "adjust_support_dose",
        subjectFocusId: "goal:handstand",
        decision: "accepted",
        proposedDate: "2026-09-30",
        chosenDate: null,
        outcomeRating: "too_easy",
      },
    ],
  });

  assert.equal(adaptation.mode, "protect");
  assert.equal(adaptation.hasMixedEvidence, true);
  assert.match(adaptation.guardrail, /more conservative action/i);
  assert.ok(adaptation.evidence.some((item) => item.includes("protective evidence")));
});
