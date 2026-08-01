import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL(
  "../supabase/migrations/20260801193000_raise_adaptive_strength_programme_loading.sql",
  import.meta.url,
);

test("adaptive strength template uses two six-week waves with an 80% base floor", async () => {
  const sql = await readFile(migrationPath, "utf8");

  assert.match(sql, /default_set_choice = 'maximum'/);
  assert.match(
    sql,
    /\(1,\s+80::numeric[\s\S]*\(2,\s+82\.5[\s\S]*\(3,\s+90[\s\S]*\(4,\s+80[\s\S]*\(5,\s+82\.5[\s\S]*\(6,\s+90/,
  );
  assert.match(
    sql,
    /\(7,\s+80[\s\S]*\(8,\s+85[\s\S]*\(9,\s+90[\s\S]*\(10,\s+80[\s\S]*\(11,\s+85[\s\S]*\(12,\s+90/,
  );
  assert.doesNotMatch(sql, /\(\d+,\s+(?:[0-7]?\d(?:\.5)?)::?numeric?,\s+[35],/);
  assert.match(sql, /min_sets = 3/);
  assert.match(sql, /when wave\.reps = 3 then 4/);
  assert.match(sql, /when wave\.base_percent = 80 then 5/);
});

test("higher loading migration changes the template without rewriting assignment history", async () => {
  const sql = await readFile(migrationPath, "utf8");

  assert.doesNotMatch(sql, /update\s+public\.program_assignments/i);
  assert.doesNotMatch(sql, /update\s+public\.sessions/i);
  assert.doesNotMatch(sql, /delete\s+from/i);
  assert.match(sql, /Friday · Bench and athleticism/);
  assert.match(sql, /Bench Press · second exposure/);
});
