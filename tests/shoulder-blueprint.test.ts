import test from "node:test";
import assert from "node:assert/strict";
import { buildShoulderBlueprintRoutines } from "../src/lib/shoulder-blueprint.ts";
import { SHOULDER_BLUEPRINT_SOURCE as source } from "../src/lib/shoulder-blueprint-source.ts";
import { emptyActuals } from "../src/lib/recovery.ts";

const routines = buildShoulderBlueprintRoutines();
const days = routines.slice(0, 3).flatMap((r) => r.templates);

test("the full course retains 30 ordered days, 160 exercise prescriptions and five separate bonus routines", () => {
  assert.equal(routines.length, 4);
  assert.deepEqual(
    routines.map((r) => r.templates.length),
    [10, 10, 10, 5],
  );
  assert.equal(
    days.reduce((n, t) => n + t.exercises.length, 0),
    160,
  );
  assert.equal(
    routines[3].templates.reduce((n, t) => n + t.exercises.length, 0),
    22,
  );
  assert.deepEqual(
    days.map((t) => t.id),
    Array.from({ length: 30 }, (_, i) => `shoulder-blueprint-day-${i + 1}`),
  );
  for (const [index, t] of days.entries()) {
    const [number, category, lessons] = source.days[index];
    assert.ok(t.name.startsWith(`Day ${number} ·`));
    assert.deepEqual(
      t.exercises.map((e) => e.name),
      lessons.map(([movement]) => source.moves[movement]),
    );
    assert.deepEqual(
      t.exercises.map((e) => e.source),
      lessons.map(
        ([, post]) =>
          `https://theptinitiative.mykajabi.com/products/the-shoulder-blueprint/categories/${category}/posts/${post}`,
      ),
    );
    lessons.forEach(([, , dose], i) =>
      assert.ok(t.exercises[i].setup.includes(`Source prescription: ${dose}.`)),
    );
  }
});

test("only Phase 1 is active and no dates, results, morning checks or loads are invented", () => {
  assert.deepEqual(
    routines.map((r) => r.status),
    ["active", "paused", "paused", "paused"],
  );
  for (const r of routines)
    for (const t of r.templates) {
      assert.equal(t.mode, "measured");
      assert.deepEqual(t.weekdays, []);
      assert.equal(t.nextMorning, false);
      assert.ok(t.notes.includes("app estimate"));
      for (const e of t.exercises) {
        assert.equal(e.weight, null);
        assert.equal(e.exerciseId, null);
      }
      assert.ok(
        emptyActuals(t).every((a) => a.reps === null && a.weight === null && a.hold === null),
      );
    }
});

test("time ranges, tempo, per-leg steps and unilateral work retain their source meaning", () => {
  const iso = days[0].exercises[3];
  assert.equal(iso.sets, 5);
  assert.equal(iso.reps, "");
  assert.equal(iso.hold, null);
  assert.ok(iso.setup.includes("10-20 sec"));
  const openBook = days[1].exercises[3];
  assert.equal(openBook.reps, "12");
  assert.equal(openBook.hold, null);
  assert.equal(openBook.side, "each");
  const release = days[4].exercises[0];
  assert.equal(release.hold, 60);
  assert.equal(release.side, "each");
  assert.equal(days[4].exercises[1].hold, null);
  const swimmer = days[10].exercises[0];
  assert.equal(swimmer.reps, "6");
  assert.equal(swimmer.hold, null);
  const carry = days[10].exercises[4];
  assert.equal(carry.sets, 2);
  assert.equal(carry.reps, "15–20");
  assert.equal(carry.side, "none");
  assert.ok(carry.setup.includes("step count per leg"));
  assert.equal(days[14].exercises[3].hold, 5);
  assert.equal(days[24].exercises[2].hold, 3);
  assert.equal(days[8].exercises[4].side, "none");
  assert.equal(days[28].exercises[1].side, "none");
});

test("ambiguous source holds stay unknown and course weight examples are not kg presets", () => {
  const bonus = routines[3];
  assert.equal(bonus.templates[1].exercises[0].hold, null);
  assert.ok(bonus.templates[1].exercises[0].setup.includes("without a unit"));
  assert.equal(bonus.templates[2].exercises[0].hold, null);
  assert.ok(bonus.templates[2].exercises[0].setup.includes("omits the number of seconds"));
  const press = days[20].exercises[3];
  assert.equal(press.weight, null);
  assert.ok(press.setup.includes("8–10 lb"));
  assert.ok(days[14].exercises[2].setup.includes("description mentions 5 rotations"));
  assert.equal(days[28].exercises[1].name, "High Plank Walk Ups");
  assert.notEqual(days[28].exercises[1].id, days[27].exercises[3].id);
});
