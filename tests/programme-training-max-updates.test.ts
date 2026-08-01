import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260801193100_add_programme_training_max_updates_and_lower_body_frequency.sql",
    import.meta.url,
  ),
  "utf8",
);

test("training max updates are assignment-scoped, bounded, atomic, and authenticated", () => {
  assert.match(migration, /create or replace function public\.apply_programme_exercise_updates/i);
  assert.match(migration, /security invoker/i);
  assert.match(migration, /assignment\.status in \('active', 'paused'\)/i);
  assert.match(migration, /training_max_value < 0\.5 or training_max_value > 1000/i);
  assert.match(migration, /adjustment_value is null or adjustment_value not in/i);
  assert.match(migration, /exercise\.program_assignment_id = p_assignment_id/i);
  assert.match(migration, /get diagnostics affected_rows = row_count/i);
  assert.match(
    migration,
    /revoke all on function public\.apply_programme_exercise_updates\(uuid, jsonb\) from public/i,
  );
  assert.match(
    migration,
    /revoke all on function public\.apply_programme_exercise_updates\(uuid, jsonb\) from anon/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.apply_programme_exercise_updates\(uuid, jsonb\) to authenticated/i,
  );
});

test("the adaptive template alternates a second squat and deadlift exposure on Fridays", () => {
  assert.match(migration, /friday_workouts\.week_number % 2 = 1/);
  assert.match(migration, /High Bar Squat · second exposure/);
  assert.match(migration, /Deadlift · second exposure/);
  assert.match(migration, /min_sets,[\s\S]*max_sets,[\s\S]*select[\s\S]*3,[\s\S]*3,/i);
  assert.match(migration, /where workout\.session_number = 3/i);
  assert.doesNotMatch(migration, /delete\s+from/i);
  assert.doesNotMatch(migration, /update\s+public\.sessions/i);
  assert.doesNotMatch(migration, /update\s+public\.program_assignments/i);
});
