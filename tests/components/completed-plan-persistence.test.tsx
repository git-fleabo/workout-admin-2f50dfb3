import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ select: vi.fn() }));
vi.mock("@/lib/supabase-public", () => ({
  supabasePublicSelect: mocks.select,
  supabasePublicInsert: vi.fn(),
  supabasePublicRpc: vi.fn(),
  supabasePublicUpdate: vi.fn(),
  supabasePublicDelete: vi.fn(),
}));
vi.mock("@/lib/supabase-people.browser", () => ({
  getCurrentPerson: async () => ({ id: "person" }),
}));
import { getScheduledWorkoutPlansClient } from "@/lib/supabase-plans.browser";
afterEach(() => vi.resetAllMocks());
it("queries completions by actual week and preserves the original scheduled date", async () => {
  mocks.select.mockImplementation(async (_table: string, query: { status: string }) =>
    query.status === "eq.completed"
      ? [
          {
            id: "plan",
            title: "Climb",
            status: "completed",
            created_at: "2026-10-10",
            suggested_for: "2026-10-14",
            plan_kind: "climbing",
            completed_session_id: "logged",
            completed_session: { session_date: "2026-10-10", duration_minutes: 30 },
            training_locations: { kind: "home" },
            suggested_workout_entries: [
              { id: "e", name: "Climbing", tracking_mode: "climbing", order_index: 0 },
            ],
            suggested_workout_method_blocks: [],
          },
        ]
      : [],
  );
  const plans = await getScheduledWorkoutPlansClient("2026-10-05", "2026-10-11");
  expect(plans[0]).toMatchObject({
    suggestedFor: "2026-10-10",
    scheduledFor: "2026-10-14",
    completedSessionId: "logged",
    completedMinutes: 30,
  });
  expect(mocks.select).toHaveBeenCalledWith(
    "suggested_workouts",
    expect.objectContaining({
      status: "eq.completed",
      "completed_session.and": "(session_date.gte.2026-10-05,session_date.lte.2026-10-11)",
      person_id: "eq.person",
      program_workout_id: "is.null",
    }),
  );
  expect(mocks.select).toHaveBeenCalledWith(
    "suggested_workouts",
    expect.objectContaining({
      status: "in.(pending,accepted)",
      suggested_for: "gte.2026-10-05",
      and: "(suggested_for.lte.2026-10-11)",
    }),
  );
});
