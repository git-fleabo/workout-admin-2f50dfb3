import assert from "node:assert/strict";
import test from "node:test";

import type { CoachingPreferences } from "../src/lib/coaching-preferences.ts";
import {
  buildWeeklyCoachRollover,
  type WeeklyCoachRolloverInput,
} from "../src/lib/weekly-coach-rollover.ts";

const preferences: CoachingPreferences = {
  primaryFocusId: "programme",
  secondaryFocusIds: ["goal:handstand", "mobility:shoulder"],
  maintenanceFocusIds: [],
  weeklyTrainingDays: 4,
  weeklyMinutes: 300,
  maxDemandingDays: 3,
  saved: true,
};

const review: WeeklyCoachRolloverInput = {
  weekStart: "2026-09-28",
  weekEnd: "2026-10-04",
  isCompleteWeek: true,
  summary: {
    sessions: 4,
    activeDays: 4,
    minutes: 260,
    hardDays: 3,
  },
  adherence: { total: 1, completed: 1 },
  programmeAdherence: { due: 3, completed: 3 },
};

test("a completed week within capacity carries up to two priorities forward", () => {
  const rollover = buildWeeklyCoachRollover({ review, preferences });

  assert.ok(rollover);
  assert.equal(rollover.status, "steady");
  assert.equal(rollover.adherencePercent, 100);
  assert.equal(rollover.additionLimit, 2);
});

test("an over-capacity week produces a lighter one-addition rollover", () => {
  const rollover = buildWeeklyCoachRollover({
    review: {
      ...review,
      summary: { sessions: 5, activeDays: 5, minutes: 360, hardDays: 4 },
    },
    preferences,
  });

  assert.ok(rollover);
  assert.equal(rollover.status, "lighter");
  assert.equal(rollover.additionLimit, 1);
});

test("low completion rebuilds from one supporting action", () => {
  const rollover = buildWeeklyCoachRollover({
    review: {
      ...review,
      adherence: { total: 2, completed: 0 },
      programmeAdherence: { due: 3, completed: 2 },
    },
    preferences,
  });

  assert.ok(rollover);
  assert.equal(rollover.status, "rebuild");
  assert.equal(rollover.adherencePercent, 40);
  assert.equal(rollover.additionLimit, 1);
});

test("an incomplete week or unsaved setup is not rolled over", () => {
  assert.equal(
    buildWeeklyCoachRollover({ review: { ...review, isCompleteWeek: false }, preferences }),
    null,
  );
  assert.equal(
    buildWeeklyCoachRollover({ review, preferences: { ...preferences, saved: false } }),
    null,
  );
});
