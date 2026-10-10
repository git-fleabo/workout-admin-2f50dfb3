import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBaseStrengthWeeks,
  baseStrengthSessions,
  DEFAULT_VOLUME_INTENSITY_OPTIONS as options,
} from "../src/lib/base-strength-preview.ts";
import { buildBaseStrengthPersonalSessions } from "../src/lib/base-strength-personal.ts";
import { dupBackOffRows, usesDupBackOff } from "../src/lib/base-strength-backoff.ts";
import { strengthChoices, strengthTemplate } from "./helpers/base-strength-fixtures.ts";

export const dupSessions = (baseWaves = 1) =>
  buildBaseStrengthPersonalSessions({
    programme: "dup",
    options: { ...options, dupBaseWaves: baseWaves },
    template: strengthTemplate("dup", (baseWaves + 1) * 3),
    choices: strengthChoices("dup"),
    startedOn: "2026-10-14",
    increment: 2.5,
    locationKind: "gym",
  });

test("DUP follows every printed base exposure, staggered lift order and percentage-point repeats", () => {
  const weeks = buildBaseStrengthWeeks("dup", {
    ...options,
    dupBaseWaves: 4,
    waveIncreasePercent: 4,
  });
  assert.equal(weeks.length, 15);
  const expected = [
    [
      [2, 12, 60],
      [3, 8, 70],
      [4, 5, 75],
    ],
    [
      [3, 10, 65],
      [4, 6, 75],
      [5, 4, 80],
    ],
    [
      [4, 8, 70],
      [5, 4, 80],
      [6, 3, 85],
    ],
  ];
  for (let w = 0; w < 3; w++) {
    const sessions = baseStrengthSessions("dup", weeks[w]);
    assert.deepEqual(
      sessions[0].movements.slice(0, 3).map((m) => [m.sets, m.reps, m.percent]),
      expected[w],
    );
    for (let lift = 0; lift < 3; lift++)
      assert.deepEqual(sessions.map((s) => s.movements[lift].exposure).sort(), [
        "high",
        "low",
        "medium",
      ]);
    assert.deepEqual(
      sessions.map((s) => s.movements.slice(0, 3).map((m) => m.reference)),
      Array(3).fill(["squat", "bench", "deadlift"]),
    );
  }
  assert.equal(weeks[3].exposures?.high.percent, 64);
  assert.equal(weeks[11].exposures?.low.percent, 97);
  for (const bad of [0, 5, 1.5, Infinity])
    assert.throws(() => buildBaseStrengthWeeks("dup", { ...options, dupBaseWaves: bad }));
  for (const bad of [1, 5, NaN])
    assert.throws(() => buildBaseStrengthWeeks("dup", { ...options, waveIncreasePercent: bad }));
});

test("DUP peak keeps top sets separate, reduces back-off sets and uses effort instead of an invented percentage", () => {
  const sessions = dupSessions();
  assert.equal(sessions.length, 18);
  assert.equal(sessions[0].scheduledDate, "2026-10-14");
  assert.equal(sessions[1].scheduledDate, "2026-10-16");
  assert.equal(sessions[2].scheduledDate, "2026-10-18");
  for (let w = 0; w < 3; w++) {
    for (let d = 0; d < 3; d++) {
      const main = sessions[9 + w * 3 + d].plan.movements.slice(0, 3);
      for (const m of main) {
        const high = m.baseStrength?.exposure === "high";
        const medium = m.baseStrength?.exposure === "medium";
        assert.equal(m.setRows.length, (high ? 3 : 5) - w + 1);
        assert.deepEqual(
          m.setRows.map((r) => r.reps),
          Array(m.setRows.length).fill(high ? "6" : medium ? "3" : "1"),
        );
        assert.equal(m.setRows[0].rpe, String(7 + w));
        assert(m.setRows.slice(1).every((r) => r.rpe === ""));
        assert(m.setRows.every((r) => r.weight === ""));
        assert.equal(m.baseStrength?.percent, null);
        assert.equal(m.baseStrength?.plusLastSet, false);
        assert(usesDupBackOff(m));
      }
    }
  }
  assert.deepEqual(
    sessions[9].plan.movements.slice(0, 3).map((m) => m.setRows[0].reps),
    ["3", "6", "1"],
  );
  assert.equal(sessions[0].plan.movements[0].setRows[0].weight, "60");
});

test("DUP accessories are optional personal choices and preserve their selected tracking context", () => {
  const choices = strengthChoices("dup");
  for (const key of Object.keys(choices).filter((k) => k.startsWith("accessory:")))
    delete choices[key];
  const build = () =>
    buildBaseStrengthPersonalSessions({
      programme: "dup",
      options,
      template: strengthTemplate("dup", 6),
      choices,
      startedOn: "2026-10-12",
      increment: 2.5,
      locationKind: "gym",
    });
  assert(build().every((s) => s.plan.movements.length === 3));
  choices["accessory:Pulldown:3"] = {
    exerciseId: "00000000-0000-4000-8000-000000000020",
    exerciseName: "Kettlebell Swing",
    trackingMode: "weight_reps",
    referenceMax: {},
    sets: 2,
    reps: 15,
    load: 16,
  };
  assert(
    build().every(
      (s) =>
        s.plan.movements[3].exercise === "Kettlebell Swing" &&
        s.plan.movements[3].workoutType === "Strength",
    ),
  );
  choices["accessory:Pulldown:3"].sets = null;
  assert.throws(build, /sets and reps/);
});

test("dependent loads round once from the chosen top load and clear when it is unknown", () => {
  const rows = dupSessions()[9].plan.movements[0].setRows;
  const before = structuredClone(rows);
  const chosen = dupBackOffRows(rows, "103", 2.5);
  assert.equal(chosen[0].weight, "103");
  assert(chosen.slice(1).every((r) => r.weight === "92.5"));
  assert.deepEqual(rows, before);
  for (const invalid of ["", "0", "-5", "NaN", "Infinity", "1001", "1e2"])
    assert(
      dupBackOffRows(chosen, invalid, 2.5)
        .slice(1)
        .every((r) => r.weight === ""),
    );
  assert(
    dupBackOffRows(chosen, "1", 5)
      .slice(1)
      .every((r) => r.weight === ""),
  );
});
