import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applySharedHoldTime,
  createHoldLog,
  gripLoadIssue,
  gripLoadSemantics,
  holdRowsReady,
  holdSummary,
} from "../src/lib/compact-holds.ts";
import { kbFixture } from "./helpers/kettlebell-fixtures.ts";

const rows = [0, 1, 2].map((index) => ({
  reps: "",
  weight: "",
  durationSeconds: "20",
  rpe: index === 0 ? "7" : "",
  completed: index !== 2,
}));

test("a shared hold time preserves individual attempt outcomes and effort", () => {
  const original = structuredClone(rows);
  const changed = applySharedHoldTime(rows, "25");
  assert.deepEqual(
    changed.map((row) => [row.durationSeconds, row.completed, row.rpe]),
    [
      ["25", true, "7"],
      ["25", true, ""],
      ["25", false, ""],
    ],
  );
  assert.deepEqual(rows, original);
  assert.equal(holdSummary(changed), "3 × 25 sec · 50 sec total · 2 completed");
  const mixed = rows.map((row, index) => ({ ...row, durationSeconds: String(20 - index * 5) }));
  assert.deepEqual(applySharedHoldTime(mixed, "30"), mixed);
});

test("bodyweight holds need time, while grip loads retain explicit meaning", () => {
  assert.equal(holdRowsReady(rows), true);
  assert.equal(holdRowsReady(rows.map((row) => ({ ...row, durationSeconds: "" }))), false);
  assert.equal(gripLoadIssue(rows, ""), null);
  const weighted = rows.map((row) => ({ ...row, weight: "10" }));
  assert.match(gripLoadIssue(weighted, "")!, /Choose the load type/);
  assert.match(gripLoadIssue(weighted, "Bodyweight")!, /blank or zero/);
  assert.equal(gripLoadIssue(weighted, "Added weight"), null);
  assert.equal(gripLoadSemantics("Added weight"), "added_bodyweight_load");
  assert.equal(gripLoadSemantics("Assistance/counterweight"), "assistance");
});

test("hold prescriptions keep their snapshot and timed circuits retain their editor", () => {
  const movement = {
    ...kbFixture().prescription.movements[0],
    trackingMode: "hold" as const,
    workoutType: "Skills/Calisthenics",
    setRows: structuredClone(rows),
  };
  const log = createHoldLog(movement)!;
  assert.equal(log.confirmed, false);
  log.plannedRows[0].durationSeconds = "999";
  assert.equal(movement.setRows[0].durationSeconds, "20");
  assert.equal(createHoldLog(movement, true), undefined);
});
