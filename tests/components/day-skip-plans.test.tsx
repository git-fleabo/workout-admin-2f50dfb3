import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ select: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/supabase-public", () => ({
  supabasePublicSelect: mocks.select,
  supabasePublicUpdate: mocks.update,
  supabasePublicInsert: vi.fn(),
  supabasePublicRpc: vi.fn(),
  supabasePublicDelete: vi.fn(),
}));
vi.mock("@/lib/supabase-people.browser", () => ({
  getCurrentPerson: async () => ({ id: "person" }),
}));
import {
  getNextSuggestedWorkoutsClient,
  getScheduledWorkoutPlansClient,
  skipSuggestedWorkoutTodayClient,
} from "@/lib/supabase-plans.browser";
afterEach(() => {
  vi.resetAllMocks();
  vi.useRealTimers();
});

const plan = {
  id: "plan",
  title: "Hold practice",
  status: "pending",
  created_at: "2026-10-14",
  suggested_for: "2026-10-20",
  plan_kind: "other",
  training_locations: { kind: "home" },
  suggested_workout_entries: [
    {
      id: "entry",
      name: "Front Lever",
      tracking_mode: "hold",
      order_index: 0,
      suggested_workout_sets: [
        {
          id: "set",
          set_number: 1,
          duration_seconds: 20,
          reps: null,
          weight: null,
          rpe: null,
          completed: false,
        },
      ],
    },
  ],
  suggested_workout_method_blocks: [],
};

it("hides a dismissed plan only on that date while retaining its schedule and status", async () => {
  mocks.select.mockResolvedValue([
    { ...plan, dismissed_for_date: "2026-10-14" },
    { ...plan, id: "older-duplicate" },
  ]);
  expect(await getNextSuggestedWorkoutsClient("2026-10-14")).toEqual([]);
  const tomorrow = await getNextSuggestedWorkoutsClient("2026-10-15");
  expect(tomorrow[0]).toMatchObject({
    suggestedWorkoutId: "plan",
    status: "pending",
    suggestedFor: "2026-10-20",
  });
  expect(mocks.select).toHaveBeenCalledWith(
    "suggested_workouts",
    expect.objectContaining({
      person_id: "eq.person",
      status: "in.(pending,accepted)",
      select: expect.stringContaining("dismissed_for_date"),
    }),
  );
});

it("writes only a day dismissal to an accessible outstanding plan and reports a failed update", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-14T12:00:00Z"));
  mocks.update.mockResolvedValueOnce([{ id: "plan" }]).mockResolvedValueOnce([]);
  await skipSuggestedWorkoutTodayClient("plan");
  expect(mocks.update).toHaveBeenCalledWith(
    "suggested_workouts",
    { id: "eq.plan", person_id: "eq.person", status: "in.(pending,accepted)" },
    { dismissed_for_date: "2026-10-14" },
  );
  await expect(skipSuggestedWorkoutTodayClient("plan")).rejects.toThrow(
    "could not be skipped for today",
  );
});

it("keeps a day-dismissed plan visible in its weekly schedule", async () => {
  mocks.select.mockImplementation(async (_table, query) =>
    query.status === "in.(pending,accepted)" ? [plan] : [],
  );
  expect((await getScheduledWorkoutPlansClient("2026-10-19", "2026-10-25"))[0]).toMatchObject({
    suggestedWorkoutId: "plan",
    suggestedFor: "2026-10-20",
  });
  expect(
    mocks.select.mock.calls.every(
      ([, query]) => !JSON.stringify(query).includes("dismissed_for_date"),
    ),
  ).toBe(true);
  expect(
    mocks.select.mock.calls.every(
      ([, query]) =>
        query.or ===
        "(mobility_practice_run_id.is.null,plan_kind.is.null,plan_kind.neq.mobility,program_workout_id.not.is.null)",
    ),
  ).toBe(true);
});
