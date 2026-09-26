import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL(
  "../supabase/migrations/20260926174630_add_jacked_dumbbell_programme.sql",
  import.meta.url,
);

test("JACKED import contains the complete training calendar without rest-day blockers", async () => {
  const sql = await readFile(migrationPath, "utf8");
  const schedule = sql.match(
    /with desired_workouts \(week_number, day_number, name, phase_name, template_key\) as \(([\s\S]*?)\n\),\nnumbered as/,
  )?.[1];

  assert.ok(schedule);
  assert.equal(schedule.match(/\(\d+,\s*\d+,/g)?.length, 66);
  assert.match(schedule, /\(1, 1, 'Chest A'/);
  assert.match(schedule, /\(8, 4, 'JACKED Classic Pull Challenge'/);
  assert.match(schedule, /\(12, 7, 'The "10 By" 400 Challenge'/);
  assert.doesNotMatch(schedule, /Rest & Recovery/i);
});

test("JACKED import uses direct editable prescriptions and optional equipment swaps", async () => {
  const sql = await readFile(migrationPath, "utf8");

  assert.match(sql, /'jacked_dumbbell'/);
  assert.match(sql, /'Path-specific box score'/);
  assert.match(sql, /ignitor-set path, box score, Back to JACKED rule/);
  assert.match(sql, /'DB DRAG CURLS · PULLUP BAR SWAP', true/);
  assert.match(sql, /'WEIGHTED PULLUPS', true/);
});
