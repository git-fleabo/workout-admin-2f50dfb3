import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ select: vi.fn(), scope: "both", homeEquipment: ["rings"] }));
vi.mock("@/lib/supabase-public", () => ({
  supabaseCachedSelect: mocks.select,
  supabasePublicSelect: mocks.select,
  supabasePublicUpdate: vi.fn(),
  supabasePublicInsert: vi.fn(),
  supabasePublicDelete: vi.fn(),
  supabasePublicRpc: vi.fn(),
}));
vi.mock("@/lib/supabase-people.browser", () => ({
  getCurrentPerson: async () => ({ id: "person" }),
  listManagedPeopleClient: async () => [{ id: "person" }],
  claimNoamProfile: vi.fn(),
}));
import { listLibraryClient } from "@/lib/supabase-library.browser";
import { exerciseLocationAvailability } from "@/lib/exercise-availability";

it("Library and Log agree on Home, Gym and Other after equipment and scope changes", async () => {
  mocks.select.mockImplementation(async (table) => {
    if (table === "exercises")
      return [
        {
          id: "dip",
          name: "Ring Dip",
          is_active: true,
          activity_types: { name: "Strength" },
          default_metric: "reps_only",
        },
      ];
    if (table === "person_exercises")
      return [
        {
          id: "enabled",
          exercise_id: "dip",
          is_enabled: true,
          location_scope: mocks.scope,
        },
      ];
    if (table === "equipment_items")
      return [
        {
          id: "rings",
          name: "Gymnastic rings",
          is_active: true,
          circuit_group: "bar_rings",
        },
      ];
    if (table === "exercise_equipment_items")
      return [{ exercise_id: "dip", equipment_item_id: "rings" }];
    if (table === "training_locations")
      return [
        { id: "home", name: "Home", kind: "home" },
        { id: "gym", name: "Gym", kind: "gym" },
        { id: "other", name: "Other", kind: "other" },
      ];
    if (table === "training_location_equipment")
      return [
        ...mocks.homeEquipment.map((id) => ({ location_id: "home", equipment_item_id: id })),
        { location_id: "gym", equipment_item_id: "rings" },
        { location_id: "other", equipment_item_id: "rings" },
      ];
    return [];
  });
  for (const scope of ["both", "gym"]) {
    mocks.scope = scope;
    const result = await listLibraryClient();
    const dip = result.items[0];
    expect(dip.availableLocationIds).toEqual(
      scope === "both" ? ["home", "gym", "other"] : ["gym", "other"],
    );
    for (const location of result.locations) {
      expect(exerciseLocationAvailability(dip, location).available).toBe(
        dip.availableLocationIds.includes(location.id),
      );
    }
  }
  mocks.scope = "both";
  mocks.homeEquipment = [];
  const result = await listLibraryClient();
  expect(result.items[0].availableLocationIds).toEqual(["gym", "other"]);
});
