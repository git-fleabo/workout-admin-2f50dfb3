import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applySharedStrengthWeight,
  createStrengthLog,
  strengthRowsReady,
} from "../src/lib/compact-strength.ts";
import { kbFixture } from "./helpers/kettlebell-fixtures.ts";

test("one load input preserves individual targets and effort while protecting mixed loads", () => {
  const movement = kbFixture().prescription.movements[0];
  const rows = movement.setRows.map((row, index) => ({
    ...row,
    weight: "60",
    rpe: index === 1 ? "8" : "",
    completed: index !== 2,
  }));
  const original = structuredClone(rows);
  const changed = applySharedStrengthWeight(rows, "65");
  assert.deepEqual(
    changed.map((row) => [row.reps, row.rpe, row.completed]),
    rows.map((row) => [row.reps, row.rpe, row.completed]),
  );
  assert.deepEqual(
    changed.map((row) => row.weight),
    ["65", "65", "65"],
  );
  assert.deepEqual(rows, original);
  const mixed = rows.map((row, index) => ({ ...row, weight: index === 0 ? "65" : "60" }));
  assert.deepEqual(applySharedStrengthWeight(mixed, "70"), mixed);
});

test("compact confirmation needs actual reps and load for completed rows, while skipped rows stay skipped", () => {
  const row = { ...kbFixture().prescription.movements[0].setRows[0], completed: true };
  assert.equal(
    strengthRowsReady(
      [
        { ...row, weight: "60" },
        { ...row, weight: "60", reps: "" },
      ],
      true,
    ),
    false,
  );
  assert.equal(
    strengthRowsReady(
      [
        { ...row, weight: "60" },
        { ...row, weight: "", reps: "", completed: false },
      ],
      true,
    ),
    true,
  );
  assert.equal(strengthRowsReady([{ ...row, weight: "", completed: true }], true), false);
});

test("DUP back-offs, timed work and kettlebell set logging keep their existing editors", () => {
  const movement = kbFixture().prescription.movements[0];
  assert.equal(createStrengthLog(movement, true), undefined);
  assert.equal(
    createStrengthLog({
      ...movement,
      setRows: [{ ...movement.setRows[0], durationSeconds: "30" }],
    }),
    undefined,
  );
  const dup = {
    ...movement,
    baseStrength: { programme: "dup", backOffPercent: 90 },
  } as typeof movement;
  assert.equal(createStrengthLog(dup), undefined);
  const log = createStrengthLog(movement)!;
  log.plannedRows[0].weight = "999";
  assert.equal(movement.setRows[0].weight, "");
});
