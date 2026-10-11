import assert from "node:assert/strict";
import test from "node:test";

import { climbingProgressFromEntries } from "../src/lib/climbing-progress.ts";

test("climbing progress reads graded entries from stored metrics", () => {
  const rows = [
    {
      sessions: { session_date: "2026-09-01" },
      entry_metrics: [
        { metric_key: "grade", metric_text: " 6A ", metric_value: null },
        { metric_key: "grade_system", metric_text: "Font", metric_value: null },
        { metric_key: "send_type", metric_text: "attempt", metric_value: null },
        { metric_key: "is_project", metric_text: null, metric_value: 1 },
      ],
    },
    {
      sessions: { session_date: "2026-09-02" },
      entry_metrics: [
        { metric_key: "tracking_mode", metric_text: "Time only", metric_value: null },
      ],
    },
  ];

  assert.deepEqual(climbingProgressFromEntries(rows), [
    {
      date: "2026-09-01",
      grade: "6A",
      gradeSystem: "Font",
      sendType: "attempt",
      isProject: true,
    },
  ]);
});

import { climbingGradeOrdinal, climbingGradeProgress } from "../src/lib/climbing-metrics.ts";
test("climbing grades follow system-specific order with numeric chart values", () => {
  for (const [system, grades] of [
    ["V-scale", ["VB", "V0-", "V0", "V0+", "V2", "V10"]],
    ["Font", ["5+", "6A", "6A+", "6B", "6B+", "6C", "6C+", "7A"]],
    ["French", ["5c", "6a", "6a+", "6b", "6b+", "6c", "6c+", "7a"]],
    ["YDS", ["5.8", "5.9", "5.10a", "5.10b", "5.10d", "5.11a"]],
  ] as const) {
    const ordinals = grades.map((grade) => climbingGradeOrdinal(grade, system)?.ordinal);
    assert.ok(ordinals.every((ordinal) => typeof ordinal === "number" && ordinal > 0));
    for (let i = 1; i < ordinals.length; i++) assert.ok(ordinals[i]! > ordinals[i - 1]!);
  }
  assert.equal(climbingGradeOrdinal("6b+", "Font")?.label, "6B+");
  assert.equal(climbingGradeOrdinal("6B+", "French")?.label, "6b+");
});
test("mixed climbing systems retain their own monthly high and original labels", () => {
  const points = climbingGradeProgress([
    { date: "2026-10-05", grade: "V9", gradeSystem: "V-scale" },
    { date: "2026-10-06", grade: "V10", gradeSystem: "V-scale" },
    { date: "2026-10-06", grade: "6B", gradeSystem: "Font" },
    { date: "2026-10-07", grade: "6b+", gradeSystem: "Font" },
    { date: "2026-10-07", grade: "5.10d", gradeSystem: "YDS" },
    { date: "2026-10-07", grade: "6c", gradeSystem: "French" },
  ]);
  assert.equal(points.length, 4);
  assert.equal(points.find((point) => point.gradeSystem === "V-scale")?.highestGrade, "V10");
  assert.equal(points.find((point) => point.gradeSystem === "Font")?.highestGrade, "6b+");
  assert.ok(points.every((point) => typeof point.gradeOrdinal === "number"));
});
test("ambiguous and unsupported grade notation is not converted into an invented value", () => {
  for (const [grade, system] of [
    ["V3-V4", "V-scale"],
    ["5.10", "YDS"],
    ["red", "Font"],
    ["7b/c", "French"],
    ["V4", null],
    ["V4", "Font"],
  ])
    assert.equal(climbingGradeOrdinal(grade, system), null);
});
