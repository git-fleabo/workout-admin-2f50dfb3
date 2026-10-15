import assert from "node:assert/strict";
import test from "node:test";
import { buildGoalTrend } from "../src/lib/goal-trend.ts";
import { reviewGoal, reviewHistory, reviewPoint } from "./helpers/goal-review-fixtures.ts";

const build = (options: Partial<Parameters<typeof buildGoalTrend>[0]> = {}) =>
  buildGoalTrend({
    goal: reviewGoal(),
    weekStart: "2026-10-12",
    reviewEnd: "2026-10-14",
    ...options,
  });

test("four calendar weeks end at the selected review, marking only an unfinished week partial", () => {
  const result = build();
  assert.deepEqual(
    result.weeks.map((week) => [week.start, week.end, week.partialWeek]),
    [
      ["2026-09-21", "2026-09-27", false],
      ["2026-09-28", "2026-10-04", false],
      ["2026-10-05", "2026-10-11", false],
      ["2026-10-12", "2026-10-14", true],
    ],
  );
  assert.equal(build({ reviewEnd: "2026-10-18" }).weeks[3].partialWeek, false);
});

test("weekly performance reflects fresh results rather than carrying an old best through gaps", () => {
  const result = build({
    exerciseHistory: reviewHistory([
      reviewPoint("2026-09-20", 120),
      reviewPoint("2026-09-22", 90),
      reviewPoint("2026-10-06", 75),
      reviewPoint("2026-10-13", 80),
      reviewPoint("2026-10-15", 110),
    ]),
  });
  assert.deepEqual(
    result.weeks.map((week) => week.value),
    [90, null, 75, 80],
  );
  assert.deepEqual(result.weeks[1].evidence, []);
  assert.equal(result.weeks[3].best?.sessionId, "session-2026-10-13");
});

test("the weekly best has the correct source even when another measurement is more recent", () => {
  const result = build({
    exerciseHistory: reviewHistory([reviewPoint("2026-10-12", 85), reviewPoint("2026-10-13", 80)]),
  });
  assert.equal(result.weeks[3].value, 85);
  assert.equal(result.weeks[3].best?.date, "2026-10-12");
  assert.equal(result.weeks[3].evidence[0].date, "2026-10-13");
});

test("historical navigation anchors all weeks and excludes newer records from every source", () => {
  const result = build({
    weekStart: "2026-10-05",
    reviewEnd: "2026-10-11",
    exerciseHistory: reviewHistory([reviewPoint("2026-10-06", 70), reviewPoint("2026-10-13", 80)]),
  });
  assert.equal(result.weeks[0].start, "2026-09-14");
  assert.equal(result.weeks[3].end, "2026-10-11");
  assert.equal(result.weeks[3].value, 70);
  assert.equal(
    result.weeks.some((week) => week.evidence.some((item) => item.date > "2026-10-11")),
    false,
  );
});

test("weekly values cross month boundaries without truncating or splitting monthly targets", () => {
  const goal = reviewGoal({
    period: "month",
    goalType: "consistency",
    goalMetric: "sessions",
    targetValue: 12,
  });
  const result = build({
    goal,
    activitySessions: [
      { id: "sep", date: "2026-09-30", minutes: 30 },
      { id: "oct", date: "2026-10-02", minutes: 30 },
    ],
  });
  assert.equal(result.weeks[1].value, 2);
  assert.equal(result.goal.targetValue, 12);
  assert.equal(result.goal.period, "month");
});

test("performance weeks also cross goal-period boundaries without losing valid measurements", () => {
  const result = build({
    goal: reviewGoal({ period: "month" }),
    exerciseHistory: reviewHistory([reviewPoint("2026-09-30", 90), reviewPoint("2026-10-02", 80)]),
  });
  assert.equal(result.weeks[1].value, 90);
  assert.equal(result.weeks[1].evidence.length, 2);
});

test("active days count unique dates while preserving source sessions", () => {
  const result = build({
    goal: reviewGoal({ goalType: "consistency", goalMetric: "active_days" }),
    activitySessions: [
      { id: "one", date: "2026-10-13", minutes: 30 },
      { id: "two", date: "2026-10-13", minutes: 30 },
    ],
  });
  assert.equal(result.weeks[3].value, 1);
  assert.equal(result.weeks[3].sourceCount, 2);
  assert.equal(result.weeks[3].evidence.length, 2);
  assert.equal(result.weeks[0].value, 0);
});

test("known empty activity weeks are zero while unmeasured performance weeks remain null", () => {
  assert.equal(build({ exerciseHistory: reviewHistory([]) }).weeks[3].value, null);
  assert.equal(
    build({
      goal: reviewGoal({ goalType: "consistency", goalMetric: "sessions" }),
      activitySessions: [],
    }).weeks[3].value,
    0,
  );
});

test("missing metric values are disclosed alongside valid weekly evidence", () => {
  const result = build({
    exerciseHistory: reviewHistory([
      reviewPoint("2026-10-12", null),
      reviewPoint("2026-10-13", 80),
    ]),
  });
  assert.equal(result.weeks[3].value, 80);
  assert.equal(result.weeks[3].sourceCount, 2);
  assert.equal(result.weeks[3].missingMeasurements, 1);
});

test("untimed sessions never masquerade as a measured zero-minute week", () => {
  const result = build({
    goal: reviewGoal({ goalType: "consistency", goalMetric: "minutes", targetUnit: "minutes" }),
    activitySessions: [
      { id: "none", date: "2026-10-06", minutes: 0 },
      { id: "some", date: "2026-10-12", minutes: 30 },
      { id: "missing", date: "2026-10-13", minutes: 0 },
    ],
  });
  assert.equal(result.weeks[2].value, null);
  assert.equal(result.weeks[2].missingTime, true);
  assert.equal(result.weeks[3].value, 30);
  assert.equal(result.weeks[3].missingTime, true);
  assert.equal(result.weeks[0].value, 0);
  assert.equal(result.weeks[0].missingTime, false);
});

test("manual legacy targets stay text while their check-ins are counted by week", () => {
  const result = build({
    goal: reviewGoal({
      goalType: "legacy",
      target: "Climb V5",
      checkins: [
        { id: "old", date: "2026-10-06", note: "Practice", createdAt: "", isToday: false },
        { id: "now", date: "2026-10-13", note: "Practice", createdAt: "", isToday: false },
        { id: "later", date: "2026-10-15", note: "Future", createdAt: "", isToday: false },
      ],
    }),
  });
  assert.equal(result.manual, true);
  assert.deepEqual(
    result.weeks.map((week) => week.value),
    [0, 0, 1, 1],
  );
  assert.equal(result.goal.target, "Climb V5");
});

test("missing exercise links and manual milestones cannot produce a measured performance trend", () => {
  assert.equal(build({ goal: reviewGoal({ exerciseId: "" }) }).supported, false);
  assert.equal(
    build({ goal: reviewGoal({ goalType: "milestone", goalMetric: "completed" }) }).supported,
    false,
  );
});

test("calendar arithmetic handles a year boundary without timezone or daylight-saving drift", () => {
  const result = build({ weekStart: "2027-01-04", reviewEnd: "2027-01-05" });
  assert.deepEqual(
    result.weeks.map((week) => week.start),
    ["2026-12-14", "2026-12-21", "2026-12-28", "2027-01-04"],
  );
});
