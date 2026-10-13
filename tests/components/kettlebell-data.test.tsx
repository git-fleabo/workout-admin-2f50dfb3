import { beforeEach, describe, expect, it, vi } from "vitest";
import { kbId } from "../helpers/kettlebell-fixtures";

const mocks = vi.hoisted(() => ({ select: vi.fn() }));
vi.mock("@/lib/supabase-public", () => ({
  supabasePublicSelect: mocks.select,
  supabasePublicInsert: vi.fn(),
  supabasePublicUpdate: vi.fn(),
  supabasePublicDelete: vi.fn(),
  supabasePublicRpc: vi.fn(),
}));
vi.mock("@/lib/supabase-people.browser", () => ({
  getCurrentPerson: vi.fn(async () => ({ id: "10000000-0000-4000-8000-000000000001" })),
}));
import { getNextSuggestedWorkoutsClient } from "@/lib/supabase-plans.browser";

function row(number: number, status: "pending" | "accepted") {
  return {
    id: kbId(number),
    title: `Session ${number}`,
    basis: "Saved session",
    status,
    readiness: null,
    created_at: "2026-10-10T12:00:00Z",
    suggested_for: "2026-10-10",
    plan_kind: "strength",
    program_assignment_id: null,
    program_workout_id: null,
    training_locations: { kind: "gym", name: "My gym" },
    suggested_workout_method_blocks: [],
    suggested_workout_entries: [
      {
        id: kbId(number + 1000),
        exercise_id: kbId(10),
        name: "Test lift",
        workout_type: "Strength",
        order_index: 0,
        tracking_mode: "weight_reps",
        target_metrics: {},
        suggested_workout_sets: [
          {
            id: kbId(number + 2000),
            set_number: 1,
            reps: 5,
            weight: 12,
            duration_seconds: null,
            rpe: null,
            completed: false,
            suggested_workout_set_segments: [],
          },
        ],
      },
    ],
  };
}
describe("accepted standalone plans stay independently resumable", () => {
  beforeEach(() => vi.clearAllMocks());
  it("keeps both an existing pending workout and an accepted kettlebell session on the same day", async () => {
    mocks.select.mockResolvedValue([row(90, "accepted"), row(91, "pending")]);
    const plans = await getNextSuggestedWorkoutsClient();
    expect(plans.map((p) => p.suggestedWorkoutId)).toEqual([kbId(90), kbId(91)]);
  });
  it("keeps multiple accepted sessions independently instead of hiding one behind the same activity kind", async () => {
    mocks.select.mockResolvedValue([row(90, "accepted"), row(91, "accepted")]);
    expect(await getNextSuggestedWorkoutsClient()).toHaveLength(2);
  });
  it("retains the KB snapshot when resuming an accepted plan from Today", async () => {
    mocks.select.mockResolvedValue([
      {
        ...row(90, "accepted"),
        kettlebell_workout_id: kbId(80),
        kettlebell_snapshot: {
          category: "conditioning",
          instructions: "Preserved source rules",
          bell_count: 2,
          required_bell_weights: 1,
          duration_minutes: 20,
        },
      },
    ]);
    const [plan] = await getNextSuggestedWorkoutsClient();
    expect(plan.kettlebell).toMatchObject({
      workoutId: kbId(80),
      instructions: "Preserved source rules",
      bellCount: 2,
      durationMinutes: 20,
    });
    expect(mocks.select.mock.calls[0][1].select).toContain("kettlebell_snapshot");
  });
});
