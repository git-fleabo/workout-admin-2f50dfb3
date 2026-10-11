import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ select: vi.fn() }));
vi.mock("@/lib/supabase-public", () => ({ supabasePublicSelect: mocks.select }));
vi.mock("@/lib/supabase-people.browser", () => ({
  getCurrentPerson: async () => ({ id: "person" }),
}));
import {
  getPersonalDataExport,
  downloadPersonalData,
  serializeSessionCsv,
} from "@/lib/supabase-export.browser";
type Row = Record<string, unknown>;
function database(tables: Record<string, Row[]>, serverLimit = 500) {
  if (!tables.people) tables.people = [{ id: "person" }];
  mocks.select.mockImplementation(
    async (table: string, params: Record<string, string | number>) => {
      expect(params.select).toBe("*");
      expect(Object.keys(params).some((key) => key.includes("!"))).toBe(false);
      let rows = tables[table] ?? [];
      for (const [key, value] of Object.entries(params)) {
        if (typeof value !== "string") continue;
        if (value.startsWith("eq."))
          rows = rows.filter((row) => String(row[key]) === value.slice(3));
        if (value.startsWith("in.(")) {
          const values = value.slice(4, -1).split(",");
          expect(values).not.toContain("undefined");
          expect(values.length).toBeLessThanOrEqual(50);
          rows = rows.filter((row) => values.includes(String(row[key])));
        }
      }
      const offset = Number(params.offset ?? 0);
      return rows.slice(offset, offset + Math.min(Number(params.limit), serverLimit));
    },
  );
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
it("scopes each child layer to the selected profile and includes assigned template IDs", async () => {
  database(
    {
      people: [{ id: "person" }, { id: "other" }],
      sessions: [
        { id: "s1", person_id: "person" },
        { id: "s2", person_id: "other" },
      ],
      session_entries: [
        { id: "e1", session_id: "s1" },
        { id: "e2", session_id: "s2" },
      ],
      entry_sets: [
        { id: "set1", session_entry_id: "e1" },
        { id: "set2", session_entry_id: "e2" },
      ],
      entry_metrics: [{ id: "m1", session_entry_id: "e1" }],
      entry_set_segments: [{ id: "seg1", entry_set_id: "set1" }],
      session_method_blocks: [{ id: "b1", session_id: "s1" }],
      session_method_block_entries: [{ block_id: "b1", session_entry_id: "e1" }],
      programs: [
        { id: "owned", created_by_person_id: "person" },
        { id: "template", created_by_person_id: null },
      ],
      program_assignments: [{ id: "a1", person_id: "person", program_id: "template" }],
      program_workouts: [
        { id: "w1", program_id: "owned" },
        { id: "w2", program_id: "template" },
      ],
      suggested_workouts: [{ id: "p1", person_id: "person" }],
      suggested_workout_entries: [{ id: "pe1", suggested_workout_id: "p1" }],
      suggested_workout_sets: [{ id: "ps1", suggested_workout_entry_id: "pe1" }],
      suggested_workout_set_segments: [{ id: "pseg", suggested_workout_set_id: "ps1" }],
    },
    1,
  );
  const data = await getPersonalDataExport();
  expect(data.sessions.map((row) => row.id)).toEqual(["s1"]);
  expect(data.session_entries.map((row) => row.id)).toEqual(["e1"]);
  expect(data.entry_sets.map((row) => row.id)).toEqual(["set1"]);
  expect(data.entry_set_segments.map((row) => row.id)).toEqual(["seg1"]);
  expect(data.entry_metrics.map((row) => row.id)).toEqual(["m1"]);
  expect(data.session_method_block_entries).toEqual([{ block_id: "b1", session_entry_id: "e1" }]);
  expect(data.programs.map((row) => row.id)).toEqual(["owned", "template"]);
  expect(data.program_workouts.map((row) => row.id)).toEqual(["w1", "w2"]);
  expect(data.suggested_workout_set_segments.map((row) => row.id)).toEqual(["pseg"]);
});
it("paginates beyond 1,000 records and batches large parent ID lists", async () => {
  database({
    sessions: Array.from({ length: 1001 }, (_, i) => ({ id: `s${i}`, person_id: "person" })),
    session_entries: [{ id: "last", session_id: "s1000" }],
  });
  const data = await getPersonalDataExport();
  expect(data.sessions).toHaveLength(1001);
  expect(data.session_entries).toEqual([{ id: "last", session_id: "s1000" }]);
});
it("exports an empty profile without unscoped child reads and produces CSV headers", async () => {
  database({});
  const data = await getPersonalDataExport();
  expect(data.entry_sets).toEqual([]);
  expect(mocks.select.mock.calls.filter(([table]) => table === "entry_sets")).toHaveLength(0);
  expect(serializeSessionCsv(data)).toContain("session_date,session_title,session_id");
});
it("keeps yoga/climbing without sets and quotes commas, quotes and newlines", () => {
  const csv = serializeSessionCsv({
    sessions: [
      { id: "yoga", title: 'Yoga, "slow"', notes: "line 1\nline 2", duration_minutes: 20 },
      { id: "empty", title: "Empty session" },
    ],
    session_entries: [{ id: "e1", session_id: "yoga", name: "Yoga" }],
    entry_sets: [],
  });
  expect(csv).toContain('"Yoga, ""slow"""');
  expect(csv).toContain('"line 1\nline 2"');
  expect(csv).toContain("Empty session");
});
it.each(["json", "csv"] as const)("creates a downloadable %s file", async (format) => {
  database({ sessions: [{ id: "s1", person_id: "person", title: "Workout" }] });
  const blobSpy = vi.fn(() => "blob:export");
  vi.stubGlobal("URL", { createObjectURL: blobSpy, revokeObjectURL: vi.fn() });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  try {
    await downloadPersonalData(format);
    expect(blobSpy).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledOnce();
    expect((click.mock.instances[0] as HTMLAnchorElement).download).toMatch(
      new RegExp(`\\.${format}$`),
    );
  } finally {
    vi.unstubAllGlobals();
  }
});
it("keeps session CSV independent of unrelated backup tables", async () => {
  database({ sessions: [{ id: "s1", person_id: "person", title: "Workout" }] });
  const original = mocks.select.getMockImplementation()!;
  mocks.select.mockImplementation(async (table, params) => {
    if (table === "coaching_preferences") throw new Error("Unavailable preferences");
    return original(table, params);
  });
  vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:csv"), revokeObjectURL: vi.fn() });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  try {
    await downloadPersonalData("csv");
    expect(click).toHaveBeenCalledOnce();
    expect(mocks.select.mock.calls.some(([table]) => table === "coaching_preferences")).toBe(false);
  } finally {
    vi.unstubAllGlobals();
  }
});

it("rejects a backup when sync or editing changes its profile between complete reads", async () => {
  database({
    programs: [{ id: "program", created_by_person_id: "person" }],
    program_assignments: [
      { id: "assignment", person_id: "person", program_id: "program", current_workout_index: 0 },
    ],
  });
  const original = mocks.select.getMockImplementation()!;
  let captures = 0;
  mocks.select.mockImplementation(async (table, params) => {
    if (table === "program_assignments" && params.offset === 0) captures++;
    const rows = await original(table, params);
    return table === "program_assignments"
      ? rows.map((row: Row) => ({ ...row, current_workout_index: captures - 1 }))
      : rows;
  });
  await expect(getPersonalDataExport()).rejects.toThrow("changed during the backup");
});
