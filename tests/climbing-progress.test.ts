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
