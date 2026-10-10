import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
  delete: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/lib/supabase-public", () => ({
  supabasePublicSelect: mocks.select,
  supabasePublicUpdate: mocks.update,
  supabasePublicInsert: mocks.insert,
  supabasePublicDelete: mocks.delete,
  supabasePublicRpc: mocks.rpc,
}));
vi.mock("@/lib/supabase-people.browser", () => ({
  getCurrentPerson: async () => ({ id: "person" }),
  listManagedPeopleClient: async () => [{ id: "person" }],
  claimNoamProfile: vi.fn(),
}));
import {
  listLibraryClient,
  updateExerciseClient,
  type LibraryFields,
} from "@/lib/supabase-library.browser";

it("round-trips additional categories and saves them through the admin RPC without changing the default", async () => {
  mocks.select.mockImplementation(async (table, params) => {
    if (table === "activity_types")
      return [
        { id: "conditioning", name: "Conditioning" },
        { id: "strength", name: "Strength" },
      ].filter((row) => !params.name || params.name === `eq.${row.name}`);
    if (table === "exercises")
      return [
        {
          id: "swing",
          name: "Kettlebell Swing",
          is_active: true,
          activity_types: { name: "Conditioning" },
          default_metric: "weight_reps",
          exercise_activity_types: [{ activity_types: { name: "Strength" } }],
        },
      ];
    if (table === "person_exercises")
      return [{ id: "enabled", exercise_id: "swing", is_enabled: true }];
    return [];
  });
  const library = await listLibraryClient();
  const swing = library.items[0];
  expect(swing).toMatchObject({
    workoutType: "Conditioning",
    additionalWorkoutTypes: ["Strength"],
    metric: "weight_reps",
  });
  expect(library.workoutTypes).toContain("Strength");
  expect(library.categoryOptions).toEqual(["Conditioning", "Strength"]);
  const fields: LibraryFields = { ...swing, equipmentItemIds: [] };
  await updateExerciseClient("swing", fields);
  expect(mocks.update).toHaveBeenCalledWith(
    "exercises",
    { id: "eq.swing" },
    expect.objectContaining({ activity_type_id: "conditioning", default_metric: "weight_reps" }),
  );
  expect(mocks.rpc).toHaveBeenCalledWith("set_exercise_categories", {
    p_exercise_id: "swing",
    p_categories: ["Strength"],
  });
  mocks.rpc.mockClear();
  delete fields.additionalWorkoutTypes;
  await updateExerciseClient("swing", fields);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
