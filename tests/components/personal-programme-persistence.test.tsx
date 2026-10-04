import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  rpc: vi.fn(),
  person: { id: "11111111-1111-4111-8111-111111111111" },
}));
vi.mock("@/lib/supabase-public", () => ({
  supabasePublicSelect: mocks.select,
  supabasePublicRpc: mocks.rpc,
  supabasePublicInsert: vi.fn(),
  supabasePublicUpdate: vi.fn(),
  supabasePublicDelete: vi.fn(),
}));
vi.mock("@/lib/supabase-people.browser", () => ({ getCurrentPerson: async () => mocks.person }));
import { getNextSuggestedWorkoutsClient } from "@/lib/supabase-plans.browser";
import {
  listPersonalProgrammesClient,
  savePersonalProgrammeSessionsClient,
} from "@/lib/supabase-personal-programmes.browser";
import { personalPlanSchema } from "@/lib/personal-programme";
const rule = { type: "double" as const, minReps: 8, maxReps: 12, incrementKg: 0.5, maxRpe: 8 };
afterEach(() => vi.resetAllMocks());
describe("personal programme persistence", () => {
  it("restores the started prescription including rest and progression after a reload", async () => {
    mocks.select.mockResolvedValue([
      {
        id: "plan-id",
        title: "My block · A",
        basis: "Saved targets",
        readiness: null,
        status: "accepted",
        created_at: "2026-10-05",
        program_assignment_id: "assignment-id",
        program_workout_id: "workout-id",
        training_location_id: "actual-gym",
        training_locations: { kind: "gym", name: "Gym" },
        suggested_workout_method_blocks: [],
        suggested_workout_entries: [
          {
            id: "entry-id",
            name: "Press",
            workout_type: "Strength",
            order_index: 0,
            source_date: null,
            reason: "My instructions",
            tracking_mode: "weight_reps",
            target_metrics: { rest_time: "3 min", progression: rule },
            suggested_workout_sets: [
              {
                set_number: 1,
                reps: 10,
                weight: 22,
                duration_seconds: null,
                rpe: 8,
                completed: true,
              },
            ],
          },
        ],
      },
    ]);
    const [restored] = await getNextSuggestedWorkoutsClient();
    expect(restored.personalProgramme).toBe(true);
    expect(restored.trainingLocationId).toBe("actual-gym");
    expect(restored.movements[0].progression).toEqual(rule);
    expect(restored.movements[0].restTime).toBe("3 min");
    expect(restored.movements[0].setRows[0]).toMatchObject({ weight: "22", reps: "10", rpe: "8" });
  });
  it("keeps existing programmes usable before installation while surfacing other errors", async () => {
    mocks.select.mockRejectedValueOnce(
      new Error("Supabase request failed: missing table Code: PGRST205"),
    );
    expect((await listPersonalProgrammesClient()).size).toBe(0);
    mocks.select.mockRejectedValueOnce(new Error("Network disconnected"));
    await expect(listPersonalProgrammesClient()).rejects.toThrow("Network disconnected");
  });
  it("validates edits before sending any update", async () => {
    await expect(
      savePersonalProgrammeSessionsClient("assignment", [
        {
          workoutId: "w",
          revision: 1,
          name: "A",
          scheduledDate: "2026-10-05",
          plan: { version: 1, locationKind: "gym", movements: [] },
        },
      ]),
    ).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(
      personalPlanSchema.safeParse({ version: 1, locationKind: "gym", movements: [] }).success,
    ).toBe(false);
  });
});
