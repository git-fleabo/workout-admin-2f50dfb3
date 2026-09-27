import assert from "node:assert/strict";
import test from "node:test";

import { buildProgrammeWeekOverview } from "../src/lib/programme-overview.ts";
import type { ProgrammeTemplateWorkout } from "../src/lib/supabase-programmes.browser.ts";

const workouts = [
  { id: "a", name: "Session 1", sequenceIndex: 0, weekNumber: 1 },
  { id: "b", name: "Session 2", sequenceIndex: 1, weekNumber: 1 },
  { id: "c", name: "Session 3", sequenceIndex: 2, weekNumber: 2 },
  { id: "d", name: "Session 4", sequenceIndex: 3, weekNumber: 2 },
] as ProgrammeTemplateWorkout[];

test("programme overview shows completed, current, and upcoming weeks", () => {
  const weeks = buildProgrammeWeekOverview(workouts, 1, 2);
  assert.deepEqual(
    weeks.map(({ week, completed, total, status }) => ({ week, completed, total, status })),
    [
      { week: 1, completed: 1, total: 2, status: "current" },
      { week: 2, completed: 0, total: 2, status: "upcoming" },
    ],
  );
  assert.equal(buildProgrammeWeekOverview(workouts, 2, 2)[0].status, "done");
  assert.equal(buildProgrammeWeekOverview(workouts, 4, 2)[1].status, "done");
});

test("programme overview handles a new run and missing week labels", () => {
  const unlabeled = workouts.map((workout) => ({ ...workout, weekNumber: null }));
  const weeks = buildProgrammeWeekOverview(unlabeled, 0, 2);
  assert.deepEqual(
    weeks.map(({ week, status }) => ({ week, status })),
    [
      { week: 1, status: "current" },
      { week: 2, status: "upcoming" },
    ],
  );
});

test("skipped programme sessions never appear as completed", () => {
  const weeks = buildProgrammeWeekOverview(workouts, 3, 2, new Set(["b", "c"]));
  assert.deepEqual(
    weeks.map(({ completed, skipped, status }) => ({ completed, skipped, status })),
    [
      { completed: 1, skipped: 1, status: "done" },
      { completed: 0, skipped: 1, status: "current" },
    ],
  );
});
