import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { normaliseCoachingPreferences } from "../src/lib/coaching-preferences.ts";

test("coaching preferences keep roles distinct and respect capacity bounds", () => {
  const preferences = normaliseCoachingPreferences(
    {
      primaryFocusId: "goal:primary",
      secondaryFocusIds: ["goal:primary", "goal:a", "goal:a", "goal:b", "goal:c"],
      maintenanceFocusIds: ["goal:a", "goal:d", "missing"],
      weeklyTrainingDays: 3,
      weeklyMinutes: 5,
      maxDemandingDays: 7,
      saved: true,
    },
    new Set(["programme", "goal:primary", "goal:a", "goal:b", "goal:c", "goal:d"]),
  );

  assert.deepEqual(preferences.secondaryFocusIds, ["goal:a", "goal:b"]);
  assert.deepEqual(preferences.maintenanceFocusIds, ["goal:d"]);
  assert.equal(preferences.weeklyMinutes, 30);
  assert.equal(preferences.maxDemandingDays, 3);
});

test("coaching preferences migration is person-scoped and constrains contradictory roles", async () => {
  const sql = await readFile(
    new URL("../supabase/migrations/20261005120000_add_coaching_preferences.sql", import.meta.url),
    "utf8",
  );
  assert.match(
    sql,
    /person_id uuid primary key references public\.people\(id\) on delete cascade/i,
  );
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /app_private\.person_is_accessible\(person_id\)/i);
  assert.match(sql, /cardinality\(secondary_focus_ids\) <= 2/i);
  assert.match(sql, /secondary_focus_ids && maintenance_focus_ids/i);
  assert.doesNotMatch(sql, /grant .* to anon/i);
});
