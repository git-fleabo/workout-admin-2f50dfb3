import test from "node:test";
import assert from "node:assert/strict";
import { MOVESMETHOD_SOURCE as source } from "../src/lib/movesmethod-source.ts";
import { buildMovesmethodRoutines, MOVESMETHOD_URL } from "../src/lib/movesmethod.ts";
import { emptyActuals } from "../src/lib/recovery.ts";

const routines = buildMovesmethodRoutines();
const days = routines.slice(0, 4).flatMap((r) => r.templates);
test("the complete source capture retains all 24 lesson identities and 166 written prescriptions", () => {
  let hash = 2166136261;
  for (const c of JSON.stringify(source)) {
    hash ^= c.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  // Independently calculated from the factual browser capture before writing these modules.
  assert.equal((hash >>> 0).toString(16), "45d0d061");
  assert.deepEqual(
    routines.map((r) => r.templates.length),
    [6, 6, 6, 6, 7],
  );
  assert.equal(days.filter((t) => t.mode === "measured").length, 18);
  assert.equal(
    days.filter((t) => t.mode === "measured").reduce((n, t) => n + t.exercises.length, 0),
    166,
  );
  for (const [i, [week, day, lesson, flow, doses]] of source.days.entries()) {
    const t = days[i];
    assert.equal(t.id, `movesmethod-week-${week}-day-${day}`);
    assert.ok(t.name.startsWith(`Day ${day} ·`));
    assert.ok(t.exercises.every((e) => e.source === `${MOVESMETHOD_URL}?md=${lesson}`));
    if (!flow) {
      assert.deepEqual(
        t.exercises.map((e) => e.sets),
        doses.map((d) => d[1]),
      );
      assert.deepEqual(
        t.exercises.map((e) => e.name),
        doses.map((d) => source.moves[d[0]]),
      );
    }
  }
  // Source exceptions survive: no inferred uniform weekly multiplier.
  assert.equal(days[1].exercises[0].sets, 2);
  assert.equal(days[3].exercises[0].sets, 1);
  assert.equal(days[12].exercises[8].sets, 3);
  assert.equal(days[15].exercises[8].sets, 2);
});

test("all routines remain paused, unscheduled and independent of history or automatic progression", () => {
  for (const r of routines) {
    assert.equal(r.status, "paused");
    assert.equal(r.purpose, "Mobility");
    for (const t of r.templates) {
      assert.deepEqual(t.weekdays, []);
      assert.equal(t.nextMorning, false);
      assert.match(t.notes, /app estimate/);
      assert.ok(t.exercises.every((e) => e.weight === null && e.exerciseId === null));
      assert.ok(
        emptyActuals(t).every((a) => a.reps === null && a.weight === null && a.hold === null),
      );
    }
  }
  for (const t of days.filter((t) => t.mode === "quick")) {
    assert.deepEqual(emptyActuals(t), []);
    assert.equal(t.exercises[0].reps, "");
    assert.equal(t.exercises[0].hold, null);
    assert.match(t.notes, /no written repetition/i);
  }
  assert.equal(
    routines[4].templates.reduce((n, t) => n + t.exercises.length, 0),
    34,
  );
  assert.ok(routines[4].templates.every((t) => t.mode === "quick" && emptyActuals(t).length === 0));
});

test("per-side counts, accumulated hangs, final-rep pauses and multi-movement protocols keep their meanings", () => {
  assert.equal(days[0].exercises[0].hold, 60);
  assert.equal(days[5].exercises[0].hold, 90);
  assert.equal(days[1].exercises[4].hold, 60);
  assert.equal(days[1].exercises[4].side, "each");
  for (const rotation of [days[0].exercises[3], days[3].exercises[2]]) {
    assert.equal(rotation.reps, "5");
    assert.equal(rotation.side, "each");
  }
  assert.equal(days[0].exercises[2].hold, null); // Five-second eccentric is tempo.
  assert.equal(days[0].exercises[4].hold, null); // Ten seconds only on the last rep.
  assert.match(days[0].exercises[4].setup, /last repetition only/);
  assert.doesNotMatch(days[5].exercises[4].setup, /last repetition only/);
  assert.equal(days[0].exercises[8].side, "none"); // Directions are not left/right.
  assert.match(days[0].exercises[8].setup, /each direction/);
  assert.equal(days[1].exercises[0].reps, "20 per movement");
  assert.match(days[1].exercises[0].setup, /entire demonstrated shoulder sequence/);
  assert.equal(days[0].exercises[1].reps, "10–12");
});

test("incomplete source units remain explicit and never create extra side counts", () => {
  const curls = days[3].exercises[5];
  assert.equal(curls.reps, "10");
  assert.equal(curls.side, "none");
  assert.match(curls.setup, /incomplete slash/);
  assert.equal(days[1].exercises[5].side, "none");
  assert.match(days[1].exercises[5].setup, /does not specify/);
});
