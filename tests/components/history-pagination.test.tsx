import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ select: vi.fn() }));
vi.mock("@/lib/supabase-public", () => ({ supabasePublicSelect: mocks.select }));
vi.mock("@/lib/supabase-people.browser", () => ({
  getCurrentPerson: async () => ({ id: "person" }),
  claimNoamProfile: vi.fn(),
}));
import { supabaseSelectAll, supabaseSelectByIds } from "@/lib/supabase-pagination.browser";
import { getDashboardDataClient } from "@/lib/supabase-dashboard.browser";
import { getTimelineDataClient } from "@/lib/supabase-timeline.browser";
import { getClimbingProgressClient } from "@/lib/supabase-climbing.browser";
import { getPRsClient } from "@/lib/supabase-log.browser";
import { listTrainingRestDaysClient } from "@/lib/supabase-rest-days.browser";

beforeEach(() => {
  mocks.select.mockReset();
});
it("reads beyond 1,000 rows under a smaller server cap with stable tie ordering", async () => {
  const data = Array.from({ length: 1207 }, (_, id) => ({ id: String(id) }));
  mocks.select.mockImplementation(async (_table, params) =>
    data.slice(params.offset, params.offset + 73),
  );
  expect(
    await supabaseSelectAll("sessions", { person_id: "eq.person", order: "session_date.asc" }),
  ).toEqual(data);
  const calls = mocks.select.mock.calls;
  expect(calls.at(-1)?.[1].offset).toBe(1207);
  expect(
    calls.every(
      ([, params]) =>
        params.person_id === "eq.person" && params.order === "session_date.asc,id.asc",
    ),
  ).toBe(true);
});
it("rejects an incomplete read or an endpoint repeating the same page", async () => {
  mocks.select.mockResolvedValueOnce([{ id: "1" }]).mockRejectedValueOnce(new Error("Offline"));
  await expect(supabaseSelectAll("sessions")).rejects.toThrow("Offline");
  mocks.select.mockResolvedValue([{ id: "1" }]);
  await expect(supabaseSelectAll("sessions")).rejects.toThrow("loaded completely");
});
it("orders membership tables by their composite key instead of an absent id", async () => {
  mocks.select
    .mockResolvedValueOnce([{ block_id: "b", session_entry_id: "e" }])
    .mockResolvedValueOnce([]);
  await supabaseSelectAll("session_method_block_entries", { select: "session_entry_id" });
  expect(mocks.select.mock.calls[0][1].order).toBe("block_id.asc,session_entry_id.asc");
  expect(mocks.select.mock.calls[0][1].select).toContain("block_id,session_entry_id");
});
it("loads rest days for Today, Plan and History using their composite key across pages", async () => {
  const rows = [
    { person_id: "person", rest_date: "2026-10-24" },
    { person_id: "person", rest_date: "2026-10-25" },
  ];
  mocks.select.mockImplementation(async (table, params) => {
    if (table !== "training_rest_days") return [];
    const columns = params.select.split(",");
    const orderColumns = params.order.split(",").map((part: string) => part.split(".")[0]);
    if (columns.includes("id") || orderColumns.includes("id")) {
      throw new Error("column training_rest_days.id does not exist");
    }
    expect(params.person_id).toBe("eq.person");
    expect(columns).toEqual(expect.arrayContaining(["person_id", "rest_date"]));
    expect(params.order).toBe("rest_date.asc,person_id.asc");
    return rows.slice(params.offset, params.offset + 1);
  });

  expect(await listTrainingRestDaysClient()).toEqual(rows);
  expect(mocks.select.mock.calls.map(([, params]) => params.offset)).toEqual([0, 1, 2]);
  expect((await getTimelineDataClient()).entries).toEqual([
    expect.objectContaining({ id: "rest-2026-10-25", kind: "rest", date: "2026-10-25" }),
    expect.objectContaining({ id: "rest-2026-10-24", kind: "rest", date: "2026-10-24" }),
  ]);
});
it("dashboard and timeline include the newest measurements after the old cap and restrict the profile", async () => {
  const rows = Array.from({ length: 1001 }, (_, index) => ({
    id: `bw-${index}`,
    logged_date: index === 1000 ? "2026-10-11" : "2020-01-01",
    bodyweight: index === 1000 ? 80 : 70,
    notes: null,
  }));
  mocks.select.mockImplementation(async (table, params) => {
    expect(params.person_id).toBe("eq.person");
    if (table !== "bodyweight_logs") return [];
    return rows.slice(params.offset, params.offset + 101);
  });
  const dashboard = await getDashboardDataClient();
  expect(dashboard.kpis.latestBodyweight).toBe(80);
  const timeline = await getTimelineDataClient();
  expect(timeline.entries).toHaveLength(1001);
  expect(timeline.entries.some((entry) => entry.date === "2026-10-11" && entry.value === 80)).toBe(
    true,
  );
});
it("climbing progress follows every page rather than the first response", async () => {
  mocks.select
    .mockResolvedValueOnce([
      {
        id: "old",
        sessions: { session_date: "2026-01-01", person_id: "person" },
        entry_metrics: [{ metric_key: "grade", metric_text: "V3" }],
      },
    ])
    .mockResolvedValueOnce([
      {
        id: "new",
        sessions: { session_date: "2026-10-11", person_id: "person" },
        entry_metrics: [{ metric_key: "grade", metric_text: "V5" }],
      },
    ])
    .mockResolvedValueOnce([]);
  expect((await getClimbingProgressClient()).map((row) => row.grade)).toEqual(["V3", "V5"]);
  expect(mocks.select.mock.calls).toHaveLength(3);
  expect(mocks.select.mock.calls[1][1]["sessions.person_id"]).toBe("eq.person");
  expect(mocks.select.mock.calls[1][1].offset).toBe(1);
});

it("batches large parent ID filters and still exhausts each server page", async () => {
  const ids = Array.from({ length: 121 }, (_, index) => `session-${index}`);
  mocks.select.mockImplementation(async (_table, params) => {
    const batch = params.session_id.slice(4, -1).split(",");
    expect(batch.length).toBeLessThanOrEqual(50);
    return batch.slice(params.offset, params.offset + 7).map((id: string) => ({ id }));
  });
  expect(
    (await supabaseSelectByIds<{ id: string }>("session_entries", "session_id", ids)).map(
      (row) => row.id,
    ),
  ).toEqual(ids);
});

it("retains an older personal record beyond the previous PR limit", async () => {
  const tests = Array.from({ length: 1001 }, (_, index) => ({
    id: `test-${index}`,
    exercise_name: "Squat",
    test_date: index === 1000 ? "2020-01-01" : "2026-10-11",
    estimated_total: index === 1000 ? 200 : 150,
  }));
  mocks.select.mockImplementation(async (table, params) => {
    if (table !== "one_rm_tests") return [];
    expect(params.person_id).toBe("eq.person");
    return tests.slice(params.offset, params.offset + 100);
  });
  const records = await getPRsClient();
  expect(records.oneRm).toEqual([
    expect.objectContaining({ exercise: "Squat", date: "2020-01-01", estTotal: "200" }),
  ]);
});
