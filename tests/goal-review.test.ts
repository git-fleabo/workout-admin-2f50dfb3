import assert from "node:assert/strict";
import test from "node:test";
import { buildGoalReview } from "../src/lib/goal-review.ts";
import { dateFallsInGoalPeriod } from "../src/lib/goal-progress.ts";
import { reviewGoal, reviewHistory, reviewPoint } from "./helpers/goal-review-fixtures.ts";

const build = (options: Partial<Parameters<typeof buildGoalReview>[0]> = {}) =>
  buildGoalReview({
    goal: reviewGoal(),
    weekStart: "2026-10-12",
    reviewEnd: "2026-10-14",
    ...options,
  });

test("a historical review excludes later results from values, changes and evidence", () => {
  const result = build({
    exerciseHistory: reviewHistory([
      reviewPoint("2026-10-06", 70),
      reviewPoint("2026-10-13", 80),
      reviewPoint("2026-10-15", 110),
    ]),
  });
  assert.equal(result.progress.value, 80);
  assert.equal(result.change, 10);
  assert.equal(result.progress.percentage, 50);
  assert.equal(result.progress.reached, false);
  assert.equal(result.latest?.sessionId, "session-2026-10-13");
  assert.equal(result.evidence.length, 2);
});

test("latest measurement is separate from the existing best-result goal rule", () => {
  const result = build({
    exerciseHistory: reviewHistory([reviewPoint("2026-10-06", 90), reviewPoint("2026-10-13", 80)]),
  });
  assert.equal(result.progress.value, 90);
  assert.equal(result.latest?.value, 80);
  assert.equal(result.best?.sessionId, "session-2026-10-06");
  assert.equal(result.change, 0);
  assert.equal(result.thisWeekEvidence.length, 1);
});

test("first result uses an explicit saved baseline, never an invented starting point", () => {
  const history = reviewHistory([reviewPoint("2026-10-13", 80)]);
  const result = build({ exerciseHistory: history });
  assert.equal(result.change, 20);
  assert.equal(result.changeFromStarting, true);
  const missing = build({ goal: reviewGoal({ startingValue: null }), exerciseHistory: history });
  assert.equal(missing.change, null);
  assert.equal(missing.starting, null);
});

test("no measurement does not become zero performance or a completed goal", () => {
  const result = build({ exerciseHistory: reviewHistory([]) });
  assert.equal(result.progress.value, null);
  assert.equal(result.progress.percentage, null);
  assert.equal(result.progress.reached, false);
});

test("an entry without the selected metric prompts for measurement rather than claiming improvement", () => {
  const result = build({
    exerciseHistory: reviewHistory([
      reviewPoint("2026-10-06", 80),
      reviewPoint("2026-10-13", null),
    ]),
  });
  assert.equal(result.missingMetricThisWeek, true);
  assert.equal(result.latest?.date, "2026-10-06");
  assert.equal(result.thisWeekEvidence.length, 0);
});

test("weekly consistency goals count the selected week and exclude later sessions", () => {
  const goal = reviewGoal({
    goalType: "consistency",
    goalMetric: "sessions",
    period: "week",
    targetValue: 3,
    startingValue: null,
  });
  const activitySessions = ["2026-10-06", "2026-10-12", "2026-10-14", "2026-10-15"].map((date) => ({
    id: date,
    date,
    minutes: 30,
  }));
  assert.equal(build({ goal, activitySessions }).progress.value, 2);
  assert.equal(
    build({ goal, activitySessions, weekStart: "2026-10-05", reviewEnd: "2026-10-11" }).progress
      .value,
    1,
  );
});

test("active-day goals deduplicate dates while their evidence retains each source session", () => {
  const result = build({
    goal: reviewGoal({
      goalType: "consistency",
      goalMetric: "active_days",
      period: "month",
      targetValue: 10,
      startingValue: null,
    }),
    activitySessions: [
      { id: "one", date: "2026-10-13", minutes: 30 },
      { id: "two", date: "2026-10-13", minutes: 30 },
    ],
  });
  assert.equal(result.progress.value, 1);
  assert.equal(result.evidence.length, 2);
});

test("monthly counters accumulate only in the goal month and isolate the review week's additions", () => {
  const result = build({
    goal: reviewGoal({
      goalType: "consistency",
      goalMetric: "sessions",
      period: "month",
      targetValue: 10,
      startingValue: null,
    }),
    activitySessions: [
      { id: "sep", date: "2026-09-30", minutes: 30 },
      { id: "old", date: "2026-10-06", minutes: 30 },
      { id: "new", date: "2026-10-13", minutes: 30 },
    ],
  });
  assert.equal(result.progress.value, 2);
  assert.equal(result.change, 1);
  assert.equal(result.evidence.length, 2);
});

test("missing durations remain a partial total rather than a claim of full measured progress", () => {
  const result = build({
    goal: reviewGoal({
      goalType: "consistency",
      goalMetric: "minutes",
      period: "week",
      targetUnit: "minutes",
      targetValue: 90,
    }),
    activitySessions: [
      { id: "timed", date: "2026-10-13", minutes: 30 },
      { id: "untimed", date: "2026-10-14", minutes: 0 },
    ],
  });
  assert.equal(result.progress.value, 30);
  assert.equal(result.missingMinutes, true);
});

test("manual check-ins use review dates regardless of input order", () => {
  const result = build({
    goal: reviewGoal({
      goalType: "consistency",
      goalMetric: "checkins",
      period: "week",
      checkins: [
        { id: "old", date: "2026-10-12", note: "Practice", createdAt: "", isToday: false },
        { id: "later", date: "2026-10-15", note: "Future", createdAt: "", isToday: false },
        { id: "latest", date: "2026-10-14", note: "Practice", createdAt: "", isToday: false },
      ],
    }),
  });
  assert.equal(result.progress.value, 2);
  assert.equal(result.progress.measuredAt, "2026-10-14");
  assert.equal(result.latest?.id, "latest");
});

test("legacy text targets and milestones do not turn check-ins into performance claims", () => {
  const legacy = build({
    goal: reviewGoal({ goalType: "legacy", target: "Climb V5", targetValue: null, checkins: [] }),
  });
  assert.equal(legacy.progress.target, null);
  assert.equal(legacy.progress.percentage, null);
  assert.equal(legacy.progress.reached, false);
  const milestone = build({
    goal: reviewGoal({ goalType: "milestone", goalMetric: "completed", targetValue: null }),
  });
  assert.equal(milestone.progress.value, null);
  assert.equal(milestone.progress.reached, false);
});

test("month, quarter and year periods use the reviewed date, including boundaries", () => {
  for (const [candidate, period, anchor, expected] of [
    ["2026-09-30", "month", "2026-10-14", false],
    ["2026-09-30", "quarter", "2026-10-14", false],
    ["2026-09-30", "quarter", "2026-09-30", true],
    ["2025-12-31", "year", "2026-01-02", false],
    ["2026-10-15", "static", "2026-10-14", false],
  ] as const)
    assert.equal(dateFallsInGoalPeriod(candidate, period, anchor), expected);
});
