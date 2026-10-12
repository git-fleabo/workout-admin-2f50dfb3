import test from "node:test";
import assert from "node:assert/strict";
import {
  listBaseLevels,
  previewBaseLevels,
  type BaseLevelContext,
} from "../src/lib/base-strength-levels.ts";
import { buildBaseStrengthPersonalSessions } from "../src/lib/base-strength-personal.ts";
import {
  DEFAULT_VOLUME_INTENSITY_OPTIONS,
  roundedPreviewLoad,
  type BaseStrengthProgrammeId,
} from "../src/lib/base-strength-preview.ts";
import { strengthChoices, strengthTemplate } from "./helpers/base-strength-fixtures.ts";

function context(programme: BaseStrengthProgrammeId = "volume_intensity"): BaseLevelContext {
  const template = strengthTemplate(programme, programme === "dup" ? 6 : 18);
  const sessions = buildBaseStrengthPersonalSessions({
    programme,
    template,
    options: DEFAULT_VOLUME_INTENSITY_OPTIONS,
    choices: strengthChoices(programme),
    startedOn: "2026-10-12",
    increment: 2.5,
    locationKind: "gym",
  });
  sessions.forEach((session) => {
    session.revision = 1;
  });
  return {
    template,
    lockedWorkoutIds: [],
    assignment: {
      id: "assignment",
      status: "active",
      currentWorkoutIndex: 0,
      personalProgramme: { name: programme, sessions },
    } as BaseLevelContext["assignment"],
  };
}

test("phase maxes recalculate each future percentage while preserving the full source structure", () => {
  const c = context();
  const baseline = structuredClone(c);
  const level = listBaseLevels(c).find((level) => level.role === "main" && level.phase === "base")!;
  const preview = previewBaseLevels(c, { [level.key]: "120" });
  assert.ok(preview.updates.length > 1);
  assert.ok(new Set(preview.changes.map((change) => change.percent)).size > 1);
  for (const updated of preview.updates) {
    const original = c.assignment.personalProgramme!.sessions.find(
      (session) => session.workoutId === updated.workoutId,
    )!;
    assert.equal(updated.name, original.name);
    assert.equal(updated.scheduledDate, original.scheduledDate);
    assert.equal(updated.revision, original.revision);
    updated.plan.movements.forEach((movement, index) => {
      const before = original.plan.movements[index];
      if (movement.baseStrength?.referenceMax === before.baseStrength?.referenceMax) {
        assert.deepEqual(movement, before);
        return;
      }
      assert.equal(movement.baseStrength!.referenceMax, 120);
      assert.deepEqual(
        { ...movement.baseStrength, referenceMax: before.baseStrength!.referenceMax },
        before.baseStrength,
      );
      const expected = String(
        roundedPreviewLoad(120, before.baseStrength!.percent, before.baseStrength!.incrementKg),
      );
      assert.deepEqual(
        movement.setRows.map((set) => ({ ...set, weight: before.setRows[0].weight })),
        before.setRows,
      );
      assert.ok(movement.setRows.every((set) => set.weight === expected));
    });
  }
  assert.deepEqual(c, baseline);
});

test("past and locked sessions, unrelated phases and personal progression stay untouched", () => {
  const c = context();
  c.assignment.currentWorkoutIndex = 2;
  c.lockedWorkoutIds = [c.template.workouts[3].id];
  const sessions = c.assignment.personalProgramme!.sessions;
  sessions[4].plan.movements[0].progression.type = "fixed";
  const level = listBaseLevels(c).find((level) => level.role === "main" && level.phase === "base")!;
  const preview = previewBaseLevels(c, { [level.key]: "125" });
  assert.ok(
    !preview.updates.some((s) =>
      [
        sessions[0].workoutId,
        sessions[1].workoutId,
        sessions[3].workoutId,
        sessions[4].workoutId,
      ].includes(s.workoutId),
    ),
  );
  assert.ok(preview.changes.every((change) => change.phase === "base"));
  c.assignment.status = "completed";
  assert.deepEqual(listBaseLevels(c), []);
});

test("supporting loads fill all selected-phase sets without changing their reps or other exercises", () => {
  const c = context();
  const sessions = c.assignment.personalProgramme!.sessions;
  sessions[0].plan.movements[2].setRows.forEach((set) => {
    set.weight = "";
  });
  const level = listBaseLevels(c).find((level) => level.kind === "load" && level.phase === "base")!;
  assert.equal(level.mixed, true);
  const preview = previewBaseLevels(c, { [level.key]: "16" });
  assert.ok(preview.updates.length > 1);
  preview.updates.forEach((updated) => {
    const original = sessions.find((s) => s.workoutId === updated.workoutId)!;
    updated.plan.movements.forEach((movement, index) => {
      const before = original.plan.movements[index];
      if (movement.baseStrength?.role === "accessory") {
        assert.deepEqual(movement, {
          ...before,
          setRows: before.setRows.map((set) => ({ ...set, weight: "16" })),
        });
      } else assert.deepEqual(movement, before);
    });
  });
});

test("changing Bullmastiff maxes keeps unknown plus-set loads open and invalidates old approvals", () => {
  const c = context("bullmastiff");
  const sessions = c.assignment.personalProgramme!.sessions;
  const rule = sessions[4].plan.movements[0].baseStrength!;
  rule.approvedFingerprint = "a".repeat(32);
  sessions[4].plan.movements[0].setRows.forEach((set) => {
    set.weight = "75";
  });
  const level = listBaseLevels(c).find((level) => level.role === "main" && level.phase === "base")!;
  const preview = previewBaseLevels(c, { [level.key]: "110" });
  const updated = preview.updates.find((s) => s.workoutId === sessions[4].workoutId)!.plan
    .movements[0];
  assert.equal(updated.baseStrength!.referenceMax, 110);
  assert.equal(updated.baseStrength!.approvedFingerprint, undefined);
  assert.ok(updated.setRows.every((set) => set.weight === ""));
  const pending = preview.updates.find((s) => s.workoutId === sessions[8].workoutId)!.plan
    .movements[0];
  assert.ok(pending.setRows.every((set) => set.weight === ""));
});

test("RPE loads and DUP top-set-dependent back-offs are not derived from a phase max", () => {
  const c = context("dup");
  assert.ok(!listBaseLevels(c).some((level) => level.phase === "peak" && level.kind === "max"));
  const level = listBaseLevels(c).find((level) => level.role === "main")!;
  const preview = previewBaseLevels(c, { [level.key]: "120" });
  assert.ok(!preview.changes.some((change) => change.phase === "peak"));
});

test("invalid and stale fields cannot produce save payloads; mixed values remain explicit", () => {
  const c = context();
  const level = listBaseLevels(c).find((level) => level.kind === "max")!;
  assert.deepEqual(previewBaseLevels(c, {}).updates, []);
  assert.deepEqual(previewBaseLevels(c, { [level.key]: level.value }).updates, []);
  for (const value of ["", "0", "-1", "Infinity", "1001", "0.1"]) {
    assert.throws(() => previewBaseLevels(c, { [level.key]: value }));
  }
  assert.throws(() => previewBaseLevels(c, { removed: "100" }), /no longer editable/);
  c.assignment.personalProgramme!.sessions[3].plan.movements[0].baseStrength!.referenceMax = 90;
  const mixed = listBaseLevels(c).find((candidate) => candidate.key === level.key)!;
  assert.equal(mixed.mixed, true);
  assert.equal(mixed.value, "");
  const preview = previewBaseLevels(c, { [level.key]: "100" });
  assert.equal(preview.updates.length, 1);
});
