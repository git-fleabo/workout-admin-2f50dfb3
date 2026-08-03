import assert from "node:assert/strict";
import test from "node:test";

import { buildTrainingStory } from "../src/lib/training-story.ts";
import type { TimelineEntry } from "../src/lib/supabase-timeline.browser.ts";

const entry = (overrides: Partial<TimelineEntry>): TimelineEntry => ({
  id: "entry-1",
  sessionId: "session-1",
  kind: "workout",
  date: "2026-08-03",
  title: "Bench Press",
  subtitle: "Workout",
  details: [],
  notes: "",
  minutes: 60,
  value: null,
  isPr: false,
  ...overrides,
});

test("monthly story counts parent sessions instead of movement rows", () => {
  const story = buildTrainingStory(
    [
      entry({ id: "bench", title: "Bench Press" }),
      entry({ id: "squat", title: "High Bar Squat" }),
      entry({ id: "bench-2", sessionId: "session-2", date: "2026-08-06" }),
    ],
    "month",
  );

  assert.equal(story?.lead, "You trained on 2 days and logged 2 sessions this month.");
  assert.match(story?.highlights.join(" ") ?? "", /Bench Press appeared in 2 sessions/);
});

test("annual story names active months and the busiest month", () => {
  const story = buildTrainingStory(
    [
      entry({ id: "jan", sessionId: "jan", date: "2026-01-03" }),
      entry({ id: "aug-1", sessionId: "aug-1" }),
      entry({ id: "aug-2", sessionId: "aug-2", date: "2026-08-06" }),
    ],
    "year",
  );

  assert.match(story?.lead ?? "", /Across 2 active months/);
  assert.match(story?.highlights.join(" ") ?? "", /August was busiest with 2 sessions/);
});
