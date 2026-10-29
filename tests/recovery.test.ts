import test from "node:test";
import assert from "node:assert/strict";
import {
  blankRoutine,
  recoveryProgress,
  blankExercise,
  emptyActuals,
  templateDue,
  nextScheduledDate,
  comparableExercise,
  validateActuals,
  recoveryRoutineSchema,
  legacyTemplate,
  type RecoverySession,
} from "../src/lib/recovery.ts";
import type { MobilityRun, MobilityDrill } from "../src/lib/mobility-practice.ts";
const routine = () => {
  const r = blankRoutine();
  r.name = "Left shoulder";
  r.templates[0].exercises[0].name = "Rotation";
  return r;
};
test("two templates allow ordinary weighted exercises, manual schedules and small loads", () => {
  const r = routine();
  r.templates.push({
    ...r.templates[0],
    id: "strength",
    mode: "measured",
    weekdays: [1, 5],
    exercises: [
      {
        ...blankExercise(),
        name: "Dumbbell rotation",
        weight: 1.25,
        load: "per_hand",
        side: "each",
      },
    ],
  });
  assert.equal(recoveryRoutineSchema.parse(r).templates.length, 2);
  assert.deepEqual(emptyActuals(r.templates[0]), []);
  const actuals = emptyActuals(r.templates[1]);
  assert.deepEqual(
    actuals.map((a) => a.side),
    ["left", "right"],
  );
  assert.ok(actuals.every((a) => a.reps === null && a.weight === null && a.hold === null));
});
test("weekday schedule uses local calendar dates across DST and creates no overdue backlog", () => {
  const t = { ...routine().templates[0], weekdays: [1, 5] };
  assert.equal(templateDue(t, "active", "r", [], "2026-10-26"), true);
  assert.equal(templateDue(t, "active", "r", [], "2026-10-27"), false);
  assert.equal(nextScheduledDate(t, "2026-10-23"), "2026-10-26");
  assert.equal(nextScheduledDate(t, "2026-12-31"), "2027-01-01");
  assert.equal(templateDue(t, "paused", "r", [], "2026-10-26"), false);
  assert.equal(templateDue(t, "archived", "r", [], "2026-10-26"), false);
  assert.equal(templateDue(t, "maintenance", "r", [], "2026-10-26"), true);
  const skipped = {
    routine_id: "r",
    template_id: t.id,
    session_date: "2026-10-26",
    status: "skipped",
  } as RecoverySession;
  assert.equal(templateDue(t, "active", "r", [skipped], "2026-10-26"), false);
  assert.equal(templateDue(t, "active", "r", [skipped], "2026-10-30"), true);
  assert.equal(nextScheduledDate({ ...t, weekdays: [] }, "2026-10-26"), null);
});
test("actuals distinguish unknown, zero and targets and reject wrong sides or duplicate sets", () => {
  const t = { ...routine().templates[0], mode: "measured" as const };
  const session = { snapshot: t } as RecoverySession;
  const rows = emptyActuals(t);
  assert.deepEqual(validateActuals(session, rows), []);
  assert.equal(validateActuals(session, [{ ...rows[0], weight: 0 }])[0].weight, 0);
  assert.throws(() => validateActuals(session, [{ ...rows[0], weight: -1 }]));
  assert.throws(() => validateActuals(session, [{ ...rows[0], side: "right" }]));
  assert.throws(() => validateActuals(session, [rows[0], rows[0]]));
});
test("comparisons require exercise identity, side, load meaning and saved setup", () => {
  const e = { ...blankExercise(), name: "Rotation" };
  assert.equal(comparableExercise(e, { ...e, weight: 2.5 }), true);
  for (const change of [
    { side: "left" },
    { load: "per_hand" },
    { setup: "Less range" },
    { exerciseId: "different" },
  ])
    assert.equal(comparableExercise(e, { ...e, ...change } as typeof e), false);
});
test("legacy adapter preserves targets and lesson provenance without rewriting records", () => {
  const run = { id: "legacy", skill: "shoulder", notes: "Original note" } as MobilityRun;
  const drills = [
    {
      id: "d",
      runId: run.id,
      isActive: true,
      name: "Stick External Rotation",
      exerciseId: "library-id",
      sortOrder: 2,
      targetSets: 2,
      targetReps: "5 per side",
      targetWeightKg: null,
      targetHoldSeconds: 20,
      targetDetail: "Comfortable range",
      lessonUrl: "https://example.org/lesson",
    },
  ] as MobilityDrill[];
  const baseline = JSON.stringify(drills);
  const t = legacyTemplate(run, drills);
  assert.equal(t.exercises[0].reps, "5 per side");
  assert.equal(t.exercises[0].source, drills[0].lessonUrl);
  assert.equal(t.exercises[0].weight, null);
  assert.equal(t.notes, run.notes);
  assert.equal(JSON.stringify(drills), baseline);
});

test("progress groups changed range and technique separately and retains unknown measurements", () => {
  const t = { ...routine().templates[0], mode: "measured" as const };
  const actual = { ...emptyActuals(t)[0], reps: 12, weight: 1.25 };
  const base = {
    id: "one",
    routine_id: "r",
    legacy_run_id: null,
    session_date: "2026-10-26",
    status: "completed",
    snapshot: t,
    actuals: [actual],
  } as RecoverySession;
  const groups = recoveryProgress([
    base,
    {
      ...base,
      id: "two",
      session_date: "2026-10-28",
      actuals: [{ ...actual, weight: 2.5, range: "Less range" }],
    },
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].range, "");
  assert.equal(groups[1].range, "Less range");
  assert.equal(groups[0].rows[0].actual.hold, null);
});
