import assert from "node:assert/strict";
import test from "node:test";
import { buildWeeklyPlan } from "../src/lib/weekly-plan.ts";
import { buildWeeklyCoachCapacity } from "../src/lib/weekly-coach-capacity.ts";
import { buildTrainingContext } from "../src/lib/training-context.ts";
import type { RecentWorkoutLog } from "../src/lib/workout-plan.ts";
import type { SavedWorkoutPlan } from "../src/lib/supabase-plans.browser.ts";
const date = "2026-10-10";
const log = (id: string) =>
  ({
    id,
    date,
    completed: true,
    exercise: "Test",
    rpe: "",
    setRows: [],
    trainingLocation: { kind: "home" },
  }) as RecentWorkoutLog;
const preferences = {
  primaryFocusId: "programme",
  secondaryFocusIds: [],
  maintenanceFocusIds: [],
  weeklyTrainingDays: 4,
  weeklyMinutes: 300,
  maxDemandingDays: 3,
  saved: true,
};
const saved = (
  id: string,
  kind: SavedWorkoutPlan["planKind"],
  minutes: number,
): SavedWorkoutPlan => ({
  version: 1,
  title: kind,
  locationKind: "home",
  basis: "Test",
  movements: [],
  planKind: kind,
  status: "completed",
  readiness: "normal",
  createdAt: date,
  suggestedFor: date,
  scheduledFor: "2026-10-14",
  completedSessionId: id,
  completedMinutes: minutes,
  suggestedWorkoutId: `plan-${id}`,
  programAssignmentId: null,
  programWorkoutId: null,
  goalId: null,
});
test("early skill and climbing completions count once on the actual day", () => {
  const plan = buildWeeklyPlan({ home: [log("skill"), log("climb")], gym: [] }, "2026-10-05", [
    { id: "climb", date, kind: "climb", label: "Climb", minutes: 30, rpe: 5 },
  ]);
  const scheduledPlans = [saved("skill", "skill", 12), saved("climb", "climbing", 30)];
  const capacity = buildWeeklyCoachCapacity({
    plan,
    programmeSessions: [],
    scheduledPlans,
    preferences,
  });
  assert.equal(capacity.sessions.length, 2);
  assert.equal(capacity.plannedMinutes, 42);
  assert.equal(capacity.demandingDays, 1);
  assert.equal(
    capacity.byKind.find((item) => item.kind === "strength"),
    undefined,
  );
  const context = buildTrainingContext({
    plan,
    programmeSessions: [],
    scheduledPlans,
    adjustments: {},
  });
  assert.equal(context.counts.skill, 1);
  assert.equal(context.counts.climbing, 1);
  assert.equal(context.counts.strength, 0);
  assert.ok(context.sessions.every((session) => session.date === date && session.completed));
});
test("a separate strength log remains visible beside completed skill practice", () => {
  const plan = buildWeeklyPlan({ home: [log("skill"), log("strength")], gym: [] }, "2026-10-05");
  const scheduledPlans = [saved("skill", "skill", 12)];
  const capacity = buildWeeklyCoachCapacity({
    plan,
    programmeSessions: [],
    scheduledPlans,
    preferences,
  });
  assert.deepEqual(
    capacity.byKind.map((item) => item.kind),
    ["skill", "strength"],
  );
  assert.equal(
    buildTrainingContext({ plan, programmeSessions: [], scheduledPlans, adjustments: {} }).counts
      .strength,
    1,
  );
});
test("the following week does not count an early completion as future work", () => {
  const plan = buildWeeklyPlan({ home: [], gym: [] }, "2026-10-12");
  assert.equal(
    buildWeeklyCoachCapacity({
      plan,
      programmeSessions: [],
      scheduledPlans: [saved("climb", "climbing", 30)],
      preferences,
    }).sessions.length,
    0,
  );
});
