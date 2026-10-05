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

test("coaching decisions apply one reviewed move atomically and preserve programme sessions", async () => {
  const sql = await readFile(
    new URL(
      "../supabase/migrations/20261005123000_add_coaching_recommendation_decisions.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(sql, /create function public\.decide_coaching_recommendation/i);
  assert.match(sql, /security invoker/i);
  assert.match(sql, /workout\.program_workout_id is null/i);
  assert.match(sql, /v_current_date is distinct from p_original_date/i);
  assert.match(sql, /update public\.suggested_workouts[\s\S]*set suggested_for = p_chosen_date/i);
  assert.match(sql, /insert into public\.coaching_recommendation_decisions/i);
  assert.match(sql, /app_private\.person_is_accessible\(person_id\)/i);
  assert.match(
    sql,
    /revoke all on function public\.decide_coaching_recommendation[\s\S]*from anon/i,
  );
});

test("adaptive coaching history learns by focus and only skips maintenance support", async () => {
  const sql = await readFile(
    new URL(
      "../supabase/migrations/20261005130000_add_adaptive_coaching_history.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(sql, /add column subject_focus_id text/i);
  assert.match(sql, /'skip_support_session'/i);
  assert.match(sql, /create function public\.decide_coaching_recommendation_v2/i);
  assert.match(sql, /security invoker/i);
  assert.match(sql, /v_program_assignment_id is null/i);
  assert.match(sql, /v_subject_focus_id = any\(preference\.maintenance_focus_ids\)/i);
  assert.match(sql, /set status = 'skipped'/i);
  assert.doesNotMatch(sql, /security definer/i);
  assert.match(
    sql,
    /revoke all on function public\.decide_coaching_recommendation_v2[\s\S]*from anon/i,
  );
});

test("readiness coaching changes only one simple bounded support dose", async () => {
  const sql = await readFile(
    new URL("../supabase/migrations/20261005133000_add_readiness_coaching.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /add column action_details jsonb not null/i);
  assert.match(sql, /'adjust_support_dose'/i);
  assert.match(sql, /create function public\.decide_coaching_recommendation_v3/i);
  assert.match(sql, /security invoker/i);
  assert.match(sql, /v_program_assignment_id is null/i);
  assert.match(sql, /v_program_workout_id is not null/i);
  assert.match(sql, /v_plan_kind is distinct from 'skill'/i);
  assert.match(sql, /v_entry_count <> 1/i);
  assert.match(sql, /Progression is limited to one small dose step/i);
  assert.match(sql, /Reduction is limited to one small dose step/i);
  assert.doesNotMatch(sql, /update public\.program_assignments/i);
  assert.doesNotMatch(sql, /security definer/i);
});

test("coaching outcomes require accepted completed work and remain person scoped", async () => {
  const sql = await readFile(
    new URL("../supabase/migrations/20261005140000_add_coaching_outcomes.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /create table public\.coaching_recommendation_outcomes/i);
  assert.match(sql, /outcome_rating in \('too_easy', 'right', 'too_hard'\)/i);
  assert.match(sql, /app_private\.person_is_accessible\(decision\.person_id\)/i);
  assert.match(sql, /create function public\.record_coaching_recommendation_outcome/i);
  assert.match(sql, /decision\.decision = 'accepted'/i);
  assert.match(sql, /v_workout_status <> 'completed'/i);
  assert.match(sql, /current_date <= v_week_start \+ 6/i);
  assert.match(sql, /security invoker/i);
  assert.match(
    sql,
    /revoke all on function public\.record_coaching_recommendation_outcome[\s\S]*from anon/i,
  );
  assert.doesNotMatch(sql, /update public\.program_assignments/i);
  assert.doesNotMatch(sql, /security definer/i);
});
