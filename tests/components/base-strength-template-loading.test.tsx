import { expect, it, vi } from "vitest";
const { select } = vi.hoisted(() => ({ select: vi.fn() }));
vi.mock("@/lib/supabase-public", () => ({ supabasePublicSelect: select }));
import { listProgrammeTemplatesClient } from "@/lib/supabase-programmes.browser";

it("loads each complete programme sequence separately as the catalogue grows", async () => {
  const programs = ["one", "two"].map((id) => ({
    id,
    name: id,
    description: null,
    method_type: "base_strength_bullmastiff",
    duration_weeks: 18,
    sessions_per_week: 4,
    default_set_choice: null,
    percent_base: "estimated_1rm",
    rounding_increment: 2.5,
  }));
  select.mockImplementation(async (table: string, params: Record<string, string>) => {
    if (table === "programs") return programs;
    if (table === "program_workout_entries") return [];
    if (table === "program_workouts") {
      const programId = params.program_id?.slice(3);
      if (!programId) throw new Error("A global sequence fetch could truncate the catalogue");
      return Array.from({ length: 72 }, (_, i) => ({
        id: `${programId}-${i}`,
        program_id: programId,
        name: `Session ${i + 1}`,
        sequence_index: i,
        week_number: Math.floor(i / 4) + 1,
        day_number: 1,
        session_number: (i % 4) + 1,
        description: null,
      }));
    }
    return [];
  });
  const templates = await listProgrammeTemplatesClient();
  expect(templates.map((t) => t.workouts.length)).toEqual([72, 72]);
  expect(
    select.mock.calls
      .filter(([table]) => table === "program_workouts")
      .map(([, params]) => params.program_id),
  ).toEqual(["eq.one", "eq.two"]);
  expect(templates[1].workouts[71].id).toBe("two-71");
});
