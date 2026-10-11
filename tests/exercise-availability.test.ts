import test from "node:test";
import assert from "node:assert/strict";
import {
  exerciseLocationAvailability,
  exerciseIsAvailableAtKind,
  exerciseUnavailableReason,
} from "../src/lib/exercise-availability.ts";

const home = { id: "home", name: "Home", kind: "home" as const, equipmentItemIds: ["rings"] };
const equipment = [
  { id: "rings", name: "Gymnastic rings" },
  { id: "bench", name: "Bench" },
];

test("ring equipment does not override an explicit restriction, but Both admits Home", () => {
  const ringDip = { locationScope: "gym" as const, equipmentItemIds: ["rings"] };
  assert.equal(exerciseLocationAvailability(ringDip, home).available, false);
  const reason = exerciseUnavailableReason(ringDip, home, equipment);
  assert.match(reason, /Gym only/);
  assert.doesNotMatch(reason, /Missing equipment/);
  assert.equal(
    exerciseLocationAvailability({ ...ringDip, locationScope: "both" }, home).available,
    true,
  );
});

test("Other locations bypass Home/Gym restrictions, but must have all required equipment", () => {
  const other = { ...home, id: "other", kind: "other" as const };
  const exercise = { locationScope: "gym" as const, equipmentItemIds: ["rings", "bench"] };
  assert.deepEqual(exerciseLocationAvailability(exercise, other), {
    scopeBlocked: false,
    missingEquipmentIds: ["bench"],
    available: false,
  });
  assert.equal(
    exerciseUnavailableReason(exercise, other, equipment),
    "Missing equipment at Home: Bench.",
  );
  assert.equal(
    exerciseLocationAvailability(exercise, { ...other, equipmentItemIds: ["rings", "bench"] })
      .available,
    true,
  );
});

test("Both does not bypass missing equipment or an unavailable location", () => {
  const exercise = { locationScope: "both" as const, equipmentItemIds: ["rings"] };
  assert.equal(
    exerciseLocationAvailability(exercise, { ...home, equipmentItemIds: [] }).available,
    false,
  );
  assert.equal(
    exerciseLocationAvailability({ ...exercise, availableLocationIds: ["gym"] }, home).available,
    false,
  );
  assert.equal(
    exerciseIsAvailableAtKind({ locationScope: "both", availableLocationKinds: ["gym"] }, "home"),
    false,
  );
});

test("warnings distinguish restrictions, missing equipment, removed movements and missing locations", () => {
  const reason = exerciseUnavailableReason(
    { locationScope: "gym", equipmentItemIds: ["bench"] },
    home,
    equipment,
  );
  assert.match(reason, /Gym only/);
  assert.match(reason, /Missing equipment at Home: Bench/);
  assert.match(exerciseUnavailableReason(undefined, home), /no longer enabled/);
  assert.match(exerciseUnavailableReason({}, undefined), /Choose an active training location/);
});
