import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const formSource = readFileSync("src/components/workout-logger/full-workout-form.tsx", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260724175412_repair_corrected_workout_completion.sql",
  "utf8",
);
const rollback = readFileSync(
  "supabase/repair_corrected_workout_completion_rollback_20260724.sql",
  "utf8",
);

test("finishing a workout always writes a completed parent session and completed entries", () => {
  const payloadStart = formSource.indexOf("const buildWorkoutPayload");
  const payloadEnd = formSource.indexOf("const mutate = useMutation", payloadStart);
  const payloadSource = formSource.slice(payloadStart, payloadEnd);

  assert.match(payloadSource, /completed: true,/);
  assert.doesNotMatch(payloadSource, /completed: form\.completed,/);
  assert.doesNotMatch(formSource, /onCheckedChange=\{\(v\) => update\("completed", v\)\}/);
  assert.match(formSource, /Finished workouts appear in History and on the Dashboard\./);
});

test("reopening a completed workout restores completed state before correction", () => {
  assert.match(
    formSource,
    /setForm\(\{\s*\.\.\.lastCompletedWorkout\.form,\s*completed: true,\s*\}\);/,
  );
});

test("the live repair is narrowly guarded and has rollback evidence", () => {
  assert.match(migration, /26096f13-436a-423f-88c6-49f13d7b35dc/);
  assert.match(migration, /create policy sessions_update_managed/);
  assert.match(migration, /using \(app_private\.person_is_accessible\(person_id\)\)/);
  assert.match(migration, /with check \(app_private\.person_is_accessible\(person_id\)\)/);
  assert.match(migration, /entry\.completed is not true/);
  assert.match(migration, /entry_set\.completed is not true/);
  assert.match(migration, /activity_type_id = \(/);
  assert.match(migration, /completed = true/);
  assert.match(rollback, /completed = false/);
  assert.match(rollback, /drop policy if exists sessions_update_managed/);
  assert.match(rollback, /2026-07-24 17:50:14\.89327\+00/);
});
