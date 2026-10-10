import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ select: vi.fn() }));
vi.mock("@/lib/supabase-public", () => ({
  supabasePublicSelect: mocks.select,
  supabasePublicRpc: vi.fn(),
  supabasePublicInsert: vi.fn(),
  supabasePublicUpdate: vi.fn(),
  supabasePublicDelete: vi.fn(),
}));
vi.mock("@/lib/supabase-people.browser", () => ({
  getCurrentPerson: async () => ({ id: "person" }),
}));
import { listProgrammeTemplatesClient } from "@/lib/supabase-programmes.browser";
import { getProgrammeExerciseContextClient } from "@/lib/supabase-personal-programmes.browser";
afterEach(() => vi.resetAllMocks());
describe("programme positions from source sequence labels", () => {
  it.each([
    [1, 2, 3],
    [0, 1, 2],
    [1, 7, 9],
  ])("normalizes %j to zero-based ordered positions", async (first, second, third) => {
    const sequence = [first, second, third];
    mocks.select.mockImplementation(async (table: string) =>
      table === "programs"
        ? [{ id: "p", name: "Test" }]
        : table === "program_workouts"
          ? sequence
              .map((sequence_index, i) => ({ id: `w${i}`, program_id: "p", sequence_index }))
              .reverse()
          : [],
    );
    const [template] = await listProgrammeTemplatesClient();
    expect(template.workouts.map((w) => [w.id, w.sequenceIndex])).toEqual([
      ["w0", 0],
      ["w1", 1],
      ["w2", 2],
    ]);
  });
  it("selects the next personal prescription by position after completing week one", async () => {
    const movement = {
      exerciseId: "00000000-0000-4000-8000-000000000010",
      exercise: "Press",
      programmeKey: "press",
      sourceDate: "",
      reason: "Test",
      progression: { type: "fixed", minReps: 8, maxReps: 12, incrementKg: 2.5, maxRpe: 8 },
      workoutType: "Strength",
      trackingMode: "weight_reps",
      targets: {
        durationMinutes: "",
        distance: "",
        distanceUnit: "",
        rounds: "",
        height: "",
        detail: "",
      },
      setRows: [{ reps: "8", weight: "20", rpe: "", durationSeconds: "", completed: true }],
    };
    mocks.select.mockImplementation(async (table: string) => {
      if (table === "program_assignments")
        return [{ id: "a", program_id: "p", current_workout_index: 3 }];
      if (table === "personal_programmes")
        return [
          {
            assignment_id: "a",
            name: "My block",
            personal_programme_sessions: [1, 2, 3, 7, 8, 9].map((_, i) => ({
              program_workout_id: `w${i}`,
              name: `Session ${i + 1}`,
              scheduled_on: "2026-10-19",
              plan: { version: 1, locationKind: "gym", movements: [movement] },
              revision: 1,
            })),
          },
        ];
      if (table === "personal_programme_sessions")
        return [1, 2, 3, 7, 8, 9].map((_, i) => ({
          assignment_id: "a",
          program_workout_id: `w${i}`,
          name: `Session ${i + 1}`,
          scheduled_date: "2026-10-19",
          plan: { version: 1, locationKind: "gym", movements: [movement] },
          revision: 1,
        }));
      if (table === "program_workouts")
        return [1, 2, 3, 7, 8, 9].map((sequence_index, i) => ({ id: `w${i}`, sequence_index }));
      return [];
    });
    expect(
      (await getProgrammeExerciseContextClient("00000000-0000-4000-8000-000000000010"))?.session
        .workoutId,
    ).toBe("w3");
  });
});
