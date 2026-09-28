import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  daysSinceSuggestedSession,
  easierProgrammeMovements,
} from "../src/lib/programme-return.ts";
import type { WorkoutPlanMovement } from "../src/lib/workout-plan.ts";

const movement = {
  exercise: "Squat",
  workoutType: "Strength",
  trackingMode: "weight_reps",
  targets: {
    durationMinutes: "",
    distance: "",
    distanceUnit: "",
    rounds: "",
    height: "",
    detail: "",
  },
  sourceDate: "",
  reason: "Programme target.",
  setRows: [
    { reps: "5", weight: "100", durationSeconds: "", rpe: "", completed: true },
    { reps: "5", weight: "100", durationSeconds: "", rpe: "", completed: true },
    { reps: "5", weight: "100", durationSeconds: "", rpe: "", completed: true },
  ],
} as WorkoutPlanMovement;

test("easier return changes only a copied session prescription", () => {
  const [easier] = easierProgrammeMovements([movement]);
  assert.equal(easier.setRows.length, 2);
  assert.equal(easier.setRows[0].weight, "90");
  assert.equal(movement.setRows.length, 3);
  assert.equal(movement.setRows[0].weight, "100");
});

test("easier return reduces a single bodyweight set without inventing a load", () => {
  const [easier] = easierProgrammeMovements([
    { ...movement, setRows: [{ ...movement.setRows[0], reps: "10", weight: "" }] },
  ]);
  assert.equal(easier.setRows[0].reps, "8");
  assert.equal(easier.setRows[0].weight, "");
});

test("easier return puts guidance in logger notes when targets are open-ended", () => {
  const openEnded = {
    ...movement,
    targets: { ...movement.targets, detail: "Follow the source box score." },
    setRows: [{ ...movement.setRows[0], reps: "", weight: "" }],
  };
  const [easier] = easierProgrammeMovements([openEnded]);
  assert.match(easier.targets.detail, /Follow the source box score/);
  assert.match(easier.targets.detail, /choose a lighter load or easier version/);
  assert.equal(openEnded.targets.detail, "Follow the source box score.");
});

test("return prompt is based on elapsed days since the suggested date", () => {
  assert.equal(daysSinceSuggestedSession("2026-09-01", "2026-09-10"), 9);
  assert.equal(daysSinceSuggestedSession("2026-09-10", "2026-09-01"), 0);
});

test("skip-ahead database action is atomic and records skips separately from completions", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20260927201526_choose_next_programme_session.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(migration, /security invoker/);
  assert.match(migration, /for update/);
  assert.match(migration, /status = 'accepted'/);
  assert.match(migration, /status = 'skipped'/);
  assert.match(migration, /current_workout_index = target_index/);
  assert.match(migration, /grant execute.*to authenticated/);
});
