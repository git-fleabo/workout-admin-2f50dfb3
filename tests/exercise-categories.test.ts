import test from "node:test";
import assert from "node:assert/strict";
import { exerciseCategories, exerciseMatchesCategory } from "../src/lib/exercise-categories.ts";
test("multi-category filtering includes the default and extras without duplicate badges", () => {
  const swing = {
    workoutType: "Conditioning",
    additionalWorkoutTypes: ["Strength", " Conditioning ", "strength", ""],
  };
  assert.deepEqual(exerciseCategories(swing), ["Conditioning", "Strength"]);
  assert.equal(exerciseMatchesCategory(swing, "Strength"), true);
  assert.equal(exerciseMatchesCategory(swing, "conditioning"), true);
  assert.equal(exerciseMatchesCategory(swing, "Grip"), false);
  assert.equal(exerciseMatchesCategory({ workoutType: "Strength" }, "Strength"), true);
});
