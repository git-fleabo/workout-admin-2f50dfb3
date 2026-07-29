import assert from "node:assert/strict";
import test from "node:test";

import { summarizeProgrammeAdherence } from "../src/lib/programme-adherence.ts";

const sessions = [
  { assignmentId: "a", programWorkoutId: "monday", date: "2026-08-03" },
  { assignmentId: "a", programWorkoutId: "wednesday", date: "2026-08-05" },
  { assignmentId: "a", programWorkoutId: "friday", date: "2026-08-07" },
];

test("programme adherence counts on-time, late, and never-started sessions", () => {
  const result = summarizeProgrammeAdherence({
    sessions,
    links: [
      {
        assignmentId: "a",
        programWorkoutId: "monday",
        status: "completed",
        completedSessionId: "s1",
      },
      {
        assignmentId: "a",
        programWorkoutId: "wednesday",
        status: "completed",
        completedSessionId: "s2",
      },
    ],
    completedSessionDates: new Map([
      ["s1", "2026-08-03"],
      ["s2", "2026-08-06"],
    ]),
    reviewEnd: "2026-08-07",
  });
  assert.deepEqual(result, {
    due: 3,
    completed: 2,
    onTime: 1,
    late: 1,
    outstanding: 1,
    missed: 0,
    skipped: 0,
    percentage: 67,
  });
});

test("programme adherence distinguishes missed, skipped, and active outstanding work", () => {
  const result = summarizeProgrammeAdherence({
    sessions,
    links: [
      {
        assignmentId: "a",
        programWorkoutId: "wednesday",
        status: "skipped",
        completedSessionId: null,
      },
      {
        assignmentId: "a",
        programWorkoutId: "friday",
        status: "accepted",
        completedSessionId: null,
      },
    ],
    completedSessionDates: new Map(),
    reviewEnd: "2026-08-07",
  });
  assert.deepEqual(result, {
    due: 3,
    completed: 0,
    onTime: 0,
    late: 0,
    outstanding: 1,
    missed: 1,
    skipped: 1,
    percentage: 0,
  });
});

test("programme adherence has no percentage before a session is due", () => {
  assert.deepEqual(
    summarizeProgrammeAdherence({
      sessions: [],
      links: [],
      completedSessionDates: new Map(),
      reviewEnd: "2026-08-02",
    }),
    {
      due: 0,
      completed: 0,
      onTime: 0,
      late: 0,
      outstanding: 0,
      missed: 0,
      skipped: 0,
      percentage: null,
    },
  );
});
