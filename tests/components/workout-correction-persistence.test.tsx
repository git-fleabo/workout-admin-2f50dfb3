import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), remove: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/supabase-people.browser", () => ({
  getCurrentPerson: async () => ({ id: "person" }),
  claimNoamProfile: vi.fn(),
}));
vi.mock("@/lib/supabase-public", () => ({
  supabasePublicSelect: vi.fn(async (table: string) =>
    table === "activity_types"
      ? [{ id: "activity", name: "Yoga" }]
      : table === "exercises"
        ? [{ id: "exercise", activity_type_id: "activity", activity_types: { name: "Yoga" } }]
        : [],
  ),
  supabasePublicRpc: mocks.rpc,
  supabasePublicDelete: mocks.remove,
  supabasePublicInsert: vi.fn(),
  supabasePublicUpdate: mocks.update,
}));
import { replaceWorkoutSessionClient, type WorkoutSessionInput } from "@/lib/supabase-log.browser";
const input = {
  date: "2026-10-11",
  title: "Corrected yoga",
  completed: true,
  entries: [{ exercise: "Yoga", workoutType: "Yoga", duration: "10", pain: "" }],
} as WorkoutSessionInput;
afterEach(() => vi.clearAllMocks());
it("keeps the existing session identity through one correction RPC", async () => {
  mocks.rpc.mockResolvedValue("original");
  expect(await replaceWorkoutSessionClient("original", input)).toMatchObject({
    sessionId: "original",
    replacedSessionId: "original",
    planRelinkFailed: false,
  });
  expect(mocks.rpc).toHaveBeenCalledWith(
    "correct_workout",
    expect.objectContaining({
      p_session_id: "original",
      p_person_id: "person",
      p_session: expect.objectContaining({ title: "Corrected yoga" }),
    }),
  );
  expect(mocks.remove).not.toHaveBeenCalled();
  expect(mocks.update).not.toHaveBeenCalled();
});
it("does not delete any record after a committed correction loses its response", async () => {
  mocks.rpc
    .mockRejectedValueOnce(new TypeError("Failed to fetch"))
    .mockResolvedValueOnce("original");
  await expect(replaceWorkoutSessionClient("original", input)).rejects.toThrow("Failed to fetch");
  expect(mocks.remove).not.toHaveBeenCalled();
  await expect(replaceWorkoutSessionClient("original", input)).resolves.toMatchObject({
    sessionId: "original",
  });
  expect(mocks.rpc.mock.calls[0]).toEqual(mocks.rpc.mock.calls[1]);
  expect(mocks.remove).not.toHaveBeenCalled();
});
it("rejects an unconfirmed correction without falling back to delete/insert", async () => {
  mocks.rpc.mockResolvedValue("different");
  await expect(replaceWorkoutSessionClient("original", input)).rejects.toThrow("not confirmed");
  expect(mocks.remove).not.toHaveBeenCalled();
});
