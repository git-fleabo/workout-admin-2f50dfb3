import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
  delete: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/lib/supabase-public", () => ({
  supabaseCachedSelect: mocks.select,
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
  addExerciseClient,
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
    "person_exercises",
    { id: "eq.enabled" },
    { location_scope: "both" },
  );
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
  delete fields.locationScope;
  mocks.update.mockClear();
  await updateExerciseClient("swing", fields);
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(mocks.update.mock.calls.some(([table]) => table === "person_exercises")).toBe(false);
  await updateExerciseClient("swing", { ...fields, locationScope: "home" });
  expect(mocks.update).toHaveBeenCalledWith(
    "person_exercises",
    { id: "eq.enabled" },
    { location_scope: "home" },
  );
  mocks.insert.mockImplementation(async (table) => (table === "exercises" ? [{ id: "new" }] : []));
  await addExerciseClient({ ...fields, locationScope: "gym" });
  expect(mocks.insert).toHaveBeenCalledWith(
    "person_exercises",
    expect.objectContaining({
      exercise_id: "new",
      location_scope: "gym",
    }),
  );
});
