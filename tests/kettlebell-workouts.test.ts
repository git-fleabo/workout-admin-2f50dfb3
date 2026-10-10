import { test } from "node:test";
import assert from "node:assert/strict";
import {
  eligibleKettlebellWorkouts,
  kettlebellWorkoutDraft,
  kettlebellWorkoutSchema,
  pickKettlebellWorkout,
  readKettlebellPickerState,
} from "../src/lib/kettlebell-workouts.ts";
import { kbFixture, kbId } from "./helpers/kettlebell-fixtures.ts";

const equipment = {
  locationId: kbId(30),
  bellCount: 1 as const,
  hasKettlebells: true,
  equipmentIds: [],
  enabledExerciseIds: [kbId(10)],
};
test("categories restrict the pool; random includes all three and mobility is rejected", () => {
  const workouts = [kbFixture(), kbFixture("muscle"), kbFixture("conditioning")];
  for (const category of ["strength", "muscle", "conditioning"] as const) {
    assert.deepEqual(
      eligibleKettlebellWorkouts(workouts, category, equipment).map((w) => w.category),
      [category],
    );
  }
  assert.equal(eligibleKettlebellWorkouts(workouts, "random", equipment).length, 3);
  assert.equal(
    kettlebellWorkoutSchema.safeParse({ ...kbFixture(), category: "mobility" }).success,
    false,
  );
});
test("equipment, bell quantity, disabled exercises and verification cannot be relaxed", () => {
  const w = kbFixture();
  assert.equal(
    eligibleKettlebellWorkouts([w], "random", { ...equipment, hasKettlebells: false }).length,
    0,
  );
  assert.equal(
    eligibleKettlebellWorkouts([w], "random", { ...equipment, enabledExerciseIds: [] }).length,
    0,
  );
  for (const altered of [
    { ...w, bellCount: 2 as const },
    { ...w, requiredEquipmentIds: [kbId(20)] },
    { ...w, verified: false },
    { ...w, isAvailable: false },
  ]) {
    assert.equal(eligibleKettlebellWorkouts([altered], "random", equipment).length, 0);
  }
});
test("swaps never repeat until explicitly restarted, including recent-completion fallbacks", () => {
  const a = kbFixture(),
    b = kbFixture("strength", 2);
  assert.equal(pickKettlebellWorkout([a, b], [], [a.id], () => 0)?.id, b.id);
  assert.equal(pickKettlebellWorkout([a, b], [b.id], [a.id], () => 0)?.id, a.id);
  assert.equal(pickKettlebellWorkout([a, b], [a.id, b.id]), null);
  assert.equal(pickKettlebellWorkout([], []), null);
  assert.equal(pickKettlebellWorkout([a], [])?.id, a.id);
});
test("snapshots preserve ladders and instructions without programme fields or source mutation", () => {
  const w = kbFixture();
  const before = structuredClone(w);
  const draft = kettlebellWorkoutDraft(w, { id: kbId(30), kind: "gym" });
  assert.deepEqual(
    draft.movements[0].setRows.map((s) => s.reps),
    ["5", "4", "3"],
  );
  assert.match(draft.movements[0].reason, /Test instructions/);
  assert.match(draft.movements[0].reason, /Five reps each side/);
  assert.equal("programAssignmentId" in draft, false);
  assert.equal("programWorkoutId" in draft, false);
  draft.movements[0].setRows[0].reps = "99";
  assert.deepEqual(w, before);
});
test("invalid prescriptions cannot become selectable", () => {
  const w = kbFixture();
  assert.equal(
    kettlebellWorkoutSchema.safeParse({
      ...w,
      prescription: { ...w.prescription, programAssignmentId: kbId(1) },
    }).success,
    false,
  );
  const changed = structuredClone(w);
  changed.prescription.movements[0].setRows[0].reps = "";
  assert.equal(kettlebellWorkoutSchema.safeParse(changed).success, false);
  assert.equal(kettlebellWorkoutSchema.safeParse({ ...w, instructions: "" }).success, false);
});
test("picker state is safely restored and rejects malformed category or request identity", () => {
  const state = {
    category: "random",
    locationId: kbId(30),
    bellCount: 1,
    offeredIds: [kbId(101)],
    previewId: kbId(101),
    previewVersion: 1,
    requestId: kbId(99),
  };
  assert.deepEqual(readKettlebellPickerState(JSON.stringify(state)), state);
  assert.equal(readKettlebellPickerState("{"), null);
  assert.equal(readKettlebellPickerState(JSON.stringify({ ...state, category: "mobility" })), null);
  assert.equal(readKettlebellPickerState(JSON.stringify({ ...state, requestId: "bad" })), null);
});
