import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { climbingMetricIssue, supportsClimbingGradient } from "../src/lib/climbing-metrics.ts";
import {
  classifySessionGroups,
  comparableVolume,
  estimatedOneRepMax,
  inferLoadClassification,
  normalizeExerciseName,
  progressRepValues,
  resolveReviewedAlias,
} from "../src/lib/data-quality.ts";
import { comparePlannedActual } from "../src/lib/planned-actual.ts";

test("normalization resolves reviewed spelling variants without fuzzy matching", () => {
  assert.equal(normalizeExerciseName("Weighted Pull-Ups"), "weightedpullups");
  assert.notEqual(normalizeExerciseName("Pull-Up"), normalizeExerciseName("Weighted Pull-Up"));
  const aliases = [
    { aliasName: "Weighted Pull Ups", exerciseId: "weighted", status: "reviewed" },
    { aliasName: "Pull Ups", exerciseId: "bodyweight", status: "reviewed" },
    { aliasName: "Seated DB Shoulder Press", exerciseId: "press", status: "manual_review" },
  ];
  assert.equal(resolveReviewedAlias("Weighted Pull-Ups", aliases)?.exerciseId, "weighted");
  assert.equal(resolveReviewedAlias("Pull-Up", aliases), undefined);
  assert.equal(resolveReviewedAlias("Seated DB Shoulder Press", aliases), undefined);
});

test("estimated one-repetition max excludes aggregates, partials, and high reps", () => {
  assert.equal(
    estimatedOneRepMax({ weight: 100, reps: 5, dataShape: "individual" }),
    100 * (1 + 5 / 30),
  );
  assert.equal(estimatedOneRepMax({ weight: 100, reps: 26, dataShape: "aggregate" }), null);
  assert.equal(estimatedOneRepMax({ weight: 100, reps: 13, dataShape: "individual" }), null);
  assert.equal(
    estimatedOneRepMax({
      weight: 100,
      reps: 5,
      dataShape: "individual",
      rangeOfMotion: "partial",
    }),
    null,
  );
});

test("volume requires exact load semantics and never multiplies aggregate totals again", () => {
  assert.equal(comparableVolume({ reps: 26, weight: 60, volumeStatus: "exact" }), 1560);
  assert.equal(comparableVolume({ reps: 26, weight: 60, volumeStatus: "ambiguous" }), null);
});

test("progress rules do not invent per-set repetitions for aggregates", () => {
  assert.deepEqual(
    progressRepValues([
      { reps: 26, dataShape: "aggregate" },
      { reps: 5, dataShape: "individual" },
    ]),
    [5],
  );
});

test("load inference keeps dumbbells ambiguous and weighted pull-ups explicit", () => {
  assert.deepEqual(
    inferLoadClassification({
      movement: "Seated DB Shoulder Press",
      equipment: "Dumbbell",
      weight: 20,
    }),
    { loadSemantics: "unknown", volumeStatus: "ambiguous" },
  );
  assert.deepEqual(
    inferLoadClassification({
      movement: "Weighted Pull-Up",
      equipment: "Pull-Up Bar",
      weight: 15,
    }),
    { loadSemantics: "added_bodyweight_load", volumeStatus: "exact" },
  );
});

test("grouping keeps standalone activities out and separates high from ambiguous", () => {
  const shared = {
    personId: "person",
    date: "2026-06-01",
    source: "google_sheets_import",
    sourceSheet: "Workout Log",
    createdAt: "2026-06-01T10:00:00Z",
    locationId: null,
    durationMinutes: null,
    activityName: "Strength",
  };
  const groups = classifySessionGroups([
    { ...shared, id: "one", sourceRow: 10, entryName: "Squat" },
    { ...shared, id: "two", sourceRow: 11, entryName: "Bench" },
    {
      ...shared,
      id: "climb",
      sourceRow: 12,
      entryName: "Bouldering",
      activityName: "Climbing",
    },
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.confidence, "high");
  assert.deepEqual(
    groups[0]?.sessions.map((session) => session.id),
    ["one", "two"],
  );
});

test("planned-versus-actual comparisons do not treat aggregate history as genuine sets", () => {
  const comparison = comparePlannedActual({
    id: "comparison",
    planTitle: "Plan",
    sessionId: "session",
    date: "2026-06-01",
    locationKind: null,
    planned: [{ setNumber: 1, reps: 5, weight: 100, rpe: null, completed: true }],
    actual: [
      {
        setNumber: 1,
        reps: 26,
        weight: 100,
        rpe: null,
        completed: true,
        dataShape: "aggregate",
      },
    ],
  });
  assert.equal(comparison.status, "partial");
  assert.equal(comparison.actualVolume, 0);
});

test("climbing metrics retain type-aware validation and board gradient rules", () => {
  assert.equal(
    climbingMetricIssue({
      minutes: "75",
      trackingMode: "Problems / routes",
      problemsOrRoutes: "12",
    }),
    null,
  );
  assert.match(
    climbingMetricIssue({
      minutes: "75",
      trackingMode: "Problems / routes",
      problemsOrRoutes: "",
    }) ?? "",
    /number of problems or routes/,
  );
  assert.equal(supportsClimbingGradient("Kilter"), true);
  assert.equal(supportsClimbingGradient("Bouldering"), false);
});

test("workout migration preserves mixed parent activity and defines an atomic invoker RPC", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/20260723181134_data_quality_foundations.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /create or replace function public\.save_workout\(/i);
  assert.match(sql, /language plpgsql\s+security invoker/i);
  assert.match(sql, /nullif\(p_session->>'activity_type_id', ''\)::uuid/i);
  assert.match(sql, /Every movement requires a valid activity type\./);
  assert.match(sql, /revoke all on function public\.save_workout[\s\S]+from public, anon;/i);
  assert.doesNotMatch(sql, /\bcommit\b/i);
});
