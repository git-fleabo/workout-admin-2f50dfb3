import { expect, it, vi } from "vitest";
import { kbFixture, kbId } from "../helpers/kettlebell-fixtures";
import { kettlebellWorkoutDraft } from "@/lib/kettlebell-workouts";
import { buildKettlebellSummaryPayload, kettlebellResultLabel } from "@/lib/kettlebell-summary";
import type { WorkoutSessionInput } from "@/lib/supabase-log.browser";

const mocks = vi.hoisted(() => ({ select: vi.fn(), history: [] as unknown[] }));
vi.mock("@/lib/supabase-people.browser", () => ({
  getCurrentPerson: async () => ({ id: "person" }),
}));
vi.mock("@/lib/supabase-public", () => ({
  supabasePublicSelect: mocks.select,
  supabasePublicInsert: vi.fn(),
  supabasePublicUpdate: vi.fn(),
  supabasePublicDelete: vi.fn(),
  supabasePublicRpc: vi.fn(),
}));
vi.mock("@/lib/supabase-pagination.browser", () => ({
  supabaseSelectAll: async (table: string) => (table === "sessions" ? mocks.history : []),
  supabaseSelectByIds: vi.fn(async () => []),
}));
import { prepareQueuedWorkoutSave } from "@/lib/supabase-log.browser";
import { getTimelineDataClient } from "@/lib/supabase-timeline.browser";

function draft(kind = "amrap") {
  const workout = kbFixture("conditioning");
  workout.prescription.methodBlocks = [
    {
      trainingMethodId: kbId(90),
      methodName: "Density",
      family: "timed_density",
      config: { mode: kind },
      memberMovementIndexes: [0],
      rounds: "",
      blockDurationMinutes: "20",
      restBetweenMovementsSeconds: "",
      restBetweenRoundsSeconds: "",
      workIntervalSeconds: "",
      restIntervalSeconds: "",
    },
  ];
  return kettlebellWorkoutDraft(workout, { id: "gym", kind: "gym" });
}
function summary() {
  const input = {
    date: "2026-10-13",
    title: "KB workout",
    trainingLocationId: "gym",
    duration: "18",
    intensity: "",
    rpe: "",
    completed: true,
    notes: "Stopped early",
    suggestedWorkoutId: "kb-plan",
    entries: [
      {
        exercise: "Source lift",
        reps: "999",
        rounds: "50",
        sets: "20",
        weight: "100",
        duration: "20",
        holdSeconds: "60",
        height: "12",
        pain: "9",
        feel: "5",
        setRows: [{ reps: "999", weight: "100" }],
      },
    ],
  } as WorkoutSessionInput;
  return buildKettlebellSummaryPayload(input, {
    mode: "summary",
    plan: draft(),
    weightUsed: "2 × 16 kg",
    result: "4 + part of next",
  });
}

it("routes ladders and pyramids to progress and gives EMOM no result field", () => {
  expect(kettlebellResultLabel(draft())).toBe("Rounds completed");
  const ladder = draft();
  ladder.methodBlocks![0].config.sequence_kind = "descending_ladder_amrap";
  expect(kettlebellResultLabel(ladder)).toBe("Ladder / pyramid progress");
  expect(kettlebellResultLabel(draft("emom"))).toBeNull();
  expect(kettlebellResultLabel(draft("timed_sequence"))).toBeNull();
});

it("saves a summary with zero set rows and actual summary metrics, retaining its plan link", async () => {
  mocks.select.mockResolvedValue([{ id: "conditioning", name: "Conditioning" }]);
  const input = summary();
  const body = await prepareQueuedWorkoutSave(input, "person");
  expect(body.p_suggested_workout_id).toBe("kb-plan");
  expect(body.p_session).toMatchObject({
    duration_minutes: 18,
    notes: expect.stringContaining("2 × 16 kg"),
  });
  expect(body.p_entries).toHaveLength(1);
  const entry = body.p_entries[0];
  expect(entry.exercise_id).toBeNull();
  expect(entry.sets).toEqual([]);
  expect(body.p_method_blocks).toEqual([]);
  expect(entry.metrics).toContainEqual({
    metric_key: "logging_mode",
    metric_text: "kettlebell_summary",
  });
  expect(entry.metrics).toContainEqual({ metric_key: "weight_used", metric_text: "2 × 16 kg" });
  expect(entry.metrics.find((metric) => metric.metric_key === "rounds")).toBeUndefined();
  expect(entry.metrics.find((metric) => metric.metric_key === "duration_minutes")).toBeUndefined();
  expect(mocks.select.mock.calls.every(([table]) => table !== "exercises")).toBe(true);
  expect(entry.notes).toContain("Prescribed workout (reference only)");
  expect(input.entries[0]).toMatchObject({
    reps: "",
    weight: "",
    rounds: "",
    sets: "",
    pain: "",
    feel: "",
  });
});

it("labels summary logs in history with duration, weight and result without a fabricated set count", async () => {
  mocks.history = [
    {
      id: "session",
      session_date: "2026-10-13",
      title: "KB workout",
      completed: true,
      duration_minutes: 18,
      notes: "Summary\nStopped early",
      activity_types: { name: "Conditioning" },
      session_entries: [
        {
          id: "entry",
          name: "KB workout",
          completed: true,
          entry_kind: "Workout",
          notes: "Prescribed workout (reference only)",
          activity_types: { name: "Conditioning" },
          entry_sets: [],
          entry_metrics: [
            { metric_key: "logging_mode", metric_text: "kettlebell_summary" },
            { metric_key: "weight_used", metric_text: "2 × 16 kg" },
            { metric_key: "workout_result", metric_text: "Rounds completed: 4 + part of next" },
          ],
        },
      ],
    },
  ];
  const data = await getTimelineDataClient();
  expect(data.entries).toHaveLength(1);
  expect(data.entries[0].details).toEqual(
    expect.arrayContaining([
      "Summary log",
      "Weight used: 2 × 16 kg",
      "Rounds completed: 4 + part of next",
      "18 min",
    ]),
  );
  expect(data.entries[0].details.join(" ")).not.toMatch(/\d+ sets?/);
  expect(data.entries[0].notes.indexOf("Stopped early")).toBeLessThan(
    data.entries[0].notes.indexOf("Prescribed workout"),
  );
});
