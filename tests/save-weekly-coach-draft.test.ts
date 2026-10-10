import assert from "node:assert/strict";
import test from "node:test";
import { buildWeeklyPlan } from "../src/lib/weekly-plan.ts";
import {
  buildWeeklyCoachDraft,
  type WeeklyCoachDraftCandidate,
} from "../src/lib/weekly-coach-draft.ts";
import { saveReviewedWeeklyCoachDraft } from "../src/lib/save-weekly-coach-draft.ts";
const plan = buildWeeklyPlan({ home: [], gym: [] }, "2026-10-12");
const preferences = {
  primaryFocusId: "goal:a",
  secondaryFocusIds: ["goal:b"],
  maintenanceFocusIds: [],
  weeklyTrainingDays: 4,
  weeklyMinutes: 300,
  maxDemandingDays: 3,
  saved: true,
};
const candidates: WeeklyCoachDraftCandidate[] = ["a", "b"].map((id) => ({
  focusId: `goal:${id}`,
  sourceId: id,
  title: id,
  kind: "skill",
  planKind: "skill",
  draft: { version: 1, title: id, basis: "Test", locationKind: "home", movements: [] },
  estimatedMinutes: 10,
  defaultPlacement: "either",
  goalId: id,
  mobilityRunId: null,
  programAssignmentId: null,
}));
const draft = buildWeeklyCoachDraft({
  plan,
  programmeSessions: [],
  scheduledPlans: [],
  preferences,
  candidates,
  today: plan.startDate,
});
test("failed compensation reports that saved sessions still need attention", async () => {
  let calls = 0;
  await assert.rejects(
    saveReviewedWeeklyCoachDraft({
      reviewed: draft,
      fresh: draft,
      selected: draft.additions,
      save: async () => {
        if (calls++) throw new Error("Save failed");
        return { suggestedWorkoutId: "first" };
      },
      archive: async () => {
        throw new Error("Network unavailable");
      },
    }),
    /Some sessions remain saved/,
  );
});
test("a second completion of the same domain makes an open draft stale", async () => {
  const changed = {
    ...plan,
    days: plan.days.map((day, i) =>
      i
        ? day
        : { ...day, completedEvidence: [{ sessionId: "new-session", item: "home" as const }] },
    ),
  };
  const fresh = buildWeeklyCoachDraft({
    plan: changed,
    programmeSessions: [],
    scheduledPlans: [],
    preferences,
    candidates,
    today: plan.startDate,
  });
  let saved = false;
  await assert.rejects(
    saveReviewedWeeklyCoachDraft({
      reviewed: draft,
      fresh,
      selected: draft.additions,
      save: async () => {
        saved = true;
        return { suggestedWorkoutId: "bad" };
      },
      archive: async () => undefined,
    }),
    /changed while this draft/,
  );
  assert.equal(saved, false);
});
