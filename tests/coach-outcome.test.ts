import assert from "node:assert/strict";
import test from "node:test";

import { buildCoachOutcomeState } from "../src/lib/coach-outcome.ts";
import type { CoachingRecommendationDecision } from "../src/lib/supabase-coaching-recommendations.browser.ts";

function decision(
  overrides: Partial<CoachingRecommendationDecision> = {},
): CoachingRecommendationDecision {
  return {
    id: "decision-1",
    weekStart: "2026-09-28",
    recommendationKey: "dose:progress:support-1:2026-09-29",
    recommendationType: "adjust_support_dose",
    subjectFocusId: "goal:skill",
    decision: "accepted",
    originalDate: "2026-09-29",
    proposedDate: "2026-09-29",
    chosenDate: null,
    decidedAt: "2026-09-28T08:00:00Z",
    sessionLabel: "Handstand practice",
    workoutStatus: "completed",
    completedSessionId: "session-1",
    outcomeRating: null,
    outcomeRecordedAt: null,
    adjustment: "progress",
    ...overrides,
  };
}

test("clear pain and effort evidence closes the coaching loop without another prompt", () => {
  const state = buildCoachOutcomeState({
    decisions: [decision()],
    logs: [{ id: "session-1", completed: true, pain: "0", rpe: "7" }],
    today: "2026-10-05",
  });

  assert.equal(state.history[0]?.outcomeRating, "right");
  assert.equal(state.inferredOutcomes, 1);
  assert.equal(state.pendingReview, null);
});

test("unclear completed evidence asks for one minimal outcome review", () => {
  const state = buildCoachOutcomeState({
    decisions: [decision()],
    logs: [{ id: "session-1", completed: true, pain: "", rpe: "" }],
    today: "2026-10-05",
  });

  assert.equal(state.history[0]?.outcomeRating, null);
  assert.equal(state.pendingReview?.decisionId, "decision-1");
  assert.match(state.pendingReview?.question ?? "", /support dose/i);
});

test("a skipped support reduction is reviewed only after its week ends", () => {
  const skipped = decision({
    recommendationType: "skip_support_session",
    workoutStatus: "skipped",
    completedSessionId: null,
    adjustment: null,
  });
  assert.equal(
    buildCoachOutcomeState({ decisions: [skipped], logs: [], today: "2026-10-04" }).pendingReview,
    null,
  );
  assert.match(
    buildCoachOutcomeState({ decisions: [skipped], logs: [], today: "2026-10-05" }).pendingReview
      ?.question ?? "",
    /reducing support/i,
  );
});

test("a dismissed suggestion never learns from a later completion", () => {
  const state = buildCoachOutcomeState({
    decisions: [decision({ decision: "rejected" })],
    logs: [{ id: "session-1", completed: true, pain: "5", rpe: "10" }],
    today: "2026-10-05",
  });

  assert.equal(state.history[0]?.outcomeRating, null);
  assert.equal(state.inferredOutcomes, 0);
  assert.equal(state.pendingReview, null);
});
