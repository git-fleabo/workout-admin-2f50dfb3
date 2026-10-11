import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  sessions: [] as Record<string, unknown>[],
  plans: [] as Record<string, unknown>[],
}));
vi.mock("@/lib/supabase-public", () => ({
  supabasePublicSelect: async (table: string, params: Record<string, unknown>) => {
    if (params.offset) return [];
    expect(params.person_id).toBe("eq.person");
    return table === "sessions" ? mocks.sessions : mocks.plans;
  },
}));
vi.mock("@/lib/supabase-people.browser", () => ({
  getCurrentPerson: async () => ({ id: "person" }),
}));
vi.mock("@/lib/supabase-log.browser", () => ({
  getPRsClient: async () => ({ oneRm: [], skills: [] }),
}));
vi.mock("@/lib/supabase-programmes.browser", () => ({
  getUpcomingProgrammeScheduleClient: async () => [],
  listProgrammeAssignmentsClient: async () => [
    { personId: "person", status: "active", currentWorkoutIndex: 0 },
  ],
}));
import { getWeeklyReviewClient } from "@/lib/supabase-weekly-review.browser";
const session = (id: string, date = "2026-10-06") => ({
  id,
  session_date: date,
  completed: true,
  session_entries: [
    {
      name: "Mobility",
      completed: true,
      activity_types: { name: "Mobility" },
      entry_metrics: [],
      entry_sets: [],
    },
  ],
});
const plan = (
  id: string,
  sessionId: string,
  workoutId: string | null,
  assignmentId: string | null = "assignment",
  status = "completed",
) => ({
  id,
  title: id,
  status,
  suggested_for: "2026-10-06",
  created_at: "2026-10-06T10:00:00Z",
  completed_session_id: sessionId,
  program_assignment_id: assignmentId,
  program_workout_id: workoutId,
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-08T12:00:00Z"));
  mocks.sessions = [];
  mocks.plans = [];
});
afterEach(() => vi.useRealTimers());
it("reports programme-linked support without claiming strength advancement", async () => {
  mocks.sessions = [session("mobility")];
  mocks.plans = [plan("support", "mobility", null)];
  const review = await getWeeklyReviewClient();
  expect(review.programmeCompletedThisWeek).toBe(0);
  expect(review.supportCompletedThisWeek).toBe(1);
  expect(review.highlights.some((item) => item.title === "1 supporting session completed")).toBe(
    true,
  );
  expect(
    review.highlights.some((item) => item.detail.includes("moves the programme forward")),
  ).toBe(false);
});
it("counts only completed linked strength sessions in the actual completion period and deduplicates session identity", async () => {
  mocks.sessions = [
    session("strength"),
    session("support"),
    session("extra"),
    session("old", "2026-09-01"),
  ];
  mocks.plans = [
    plan("strength", "strength", "workout"),
    plan("duplicate", "strength", "workout"),
    plan("support", "support", null),
    plan("extra", "extra", null, null),
    plan("old", "old", "previous"),
    plan("pending", "support", "next", "assignment", "accepted"),
  ];
  const review = await getWeeklyReviewClient();
  expect(review.programmeCompletedThisWeek).toBe(1);
  expect(review.supportCompletedThisWeek).toBe(1);
  expect(review.adherence.completed).toBe(1);
  expect(
    review.highlights.find((item) => item.title.includes("strength programme session"))?.detail,
  ).toContain("moves the programme forward");
});
