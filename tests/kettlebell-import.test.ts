import { test } from "node:test";
import assert from "node:assert/strict";
import { prepareKettlebellPilotImport } from "../scripts/prepare-kettlebell-import.ts";
import { kbFixture, kbId } from "./helpers/kettlebell-fixtures.ts";

const pilot = () => ({
  personId: kbId(1),
  workouts: (["strength", "muscle", "conditioning"] as const).flatMap((category) =>
    [1, 2, 3, 4, 5].map((number) => kbFixture(category, number)),
  ),
});
test("pilot import requires exactly the first five in each included category", () => {
  const valid = pilot();
  const sql = prepareKettlebellPilotImport(valid);
  assert.match(sql, /begin;/);
  assert.match(sql, /on conflict\(person_id,collection_key,category,source_number\)/);
  assert.match(sql, /commit;/);
  assert.throws(() =>
    prepareKettlebellPilotImport({ ...valid, workouts: valid.workouts.slice(1) }),
  );
  const duplicate = pilot();
  duplicate.workouts[1] = duplicate.workouts[0];
  assert.throws(() => prepareKettlebellPilotImport(duplicate), /exactly workouts/);
  const later = pilot();
  later.workouts[0].sourceNumber = 6;
  assert.throws(() => prepareKettlebellPilotImport(later), /exactly workouts/);
});
test("workout text is quoted as data rather than SQL code", () => {
  const input = pilot();
  input.workouts[0].instructions = "It's a test; '); drop table public.people; --";
  const sql = prepareKettlebellPilotImport(input);
  assert.match(sql, /It''s a test; ''\); drop table public.people; --/);
});
