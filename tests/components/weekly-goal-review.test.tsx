import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { reviewGoal, reviewHistory, reviewPoint } from "../helpers/goal-review-fixtures";

const mocks = vi.hoisted(() => ({
  goals: vi.fn(),
  history: vi.fn(),
  activity: vi.fn(),
  review: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: unknown) => config,
  Link: ({
    children,
    to,
    search,
  }: {
    children: ReactNode;
    to: string;
    search?: Record<string, string>;
  }) => <a href={to + (search ? `?${new URLSearchParams(search)}` : "")}>{children}</a>,
}));
vi.mock("@/lib/supabase-goals.browser", () => ({
  listGoalsClient: mocks.goals,
  getGoalActivityClient: mocks.activity,
}));
vi.mock("@/lib/supabase-history.browser", () => ({ getExerciseHistoryClient: mocks.history }));
vi.mock("@/lib/supabase-weekly-review.browser", () => ({
  getWeeklyReviewClient: mocks.review,
  weeklyReviewWeekStart: () => "2026-10-12",
  moveWeeklyReviewWeek: (date: string, direction: number) => (direction < 0 ? "2026-10-05" : date),
}));
vi.mock("@/lib/supabase-timeline.browser", () => ({
  getTimelineDataClient: async () => ({ entries: [] }),
}));
import { WeeklyGoalReview } from "@/components/weekly-goal-review";
import { WeeklyReviewPage } from "@/routes/weekly-review";

function renderReview(
  element = <WeeklyGoalReview weekStart="2026-10-12" reviewEnd="2026-10-14" />,
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return {
    client,
    ...render(<QueryClientProvider client={client}>{element}</QueryClientProvider>),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.goals.mockResolvedValue({ needsProfileClaim: false, items: [reviewGoal()] });
  mocks.history.mockResolvedValue(
    reviewHistory([
      reviewPoint("2026-10-06", 90),
      reviewPoint("2026-10-13", 80),
      reviewPoint("2026-10-15", 110),
    ]),
  );
  mocks.activity.mockResolvedValue([]);
});

it("shows best and latest separately, with direct evidence and exercise links", async () => {
  renderReview();
  const card = await screen.findByRole("article");
  expect(card).toHaveTextContent("90 kg");
  expect(card).toHaveTextContent("Latest measurement: 80 kg");
  expect(card).toHaveTextContent("No increase in the best recorded result");
  expect(screen.queryByText(/110 kg/)).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /View best log/ })).toHaveAttribute(
    "href",
    "/history?session=session-2026-10-06",
  );
  expect(screen.getByRole("link", { name: "Check exercise progress" })).toHaveAttribute(
    "href",
    "/progress?exercise=bench",
  );
  await userEvent.click(screen.getByText("View evidence (2)"));
  expect(screen.getByRole("link", { name: "13 Oct · 80 kg" })).toBeVisible();
  expect(mocks.activity).not.toHaveBeenCalled();
});

it("uses the selected past week without refetching or leaking newer results", async () => {
  const { rerender, client } = renderReview();
  await screen.findByRole("article");
  rerender(
    <QueryClientProvider client={client}>
      <WeeklyGoalReview weekStart="2026-10-05" reviewEnd="2026-10-11" />
    </QueryClientProvider>,
  );
  const card = screen.getByRole("article");
  expect(card).not.toHaveTextContent("80 kg");
  expect(card).toHaveTextContent("Latest measurement: 90 kg");
  expect(mocks.history).toHaveBeenCalledTimes(1);
});

it("deduplicates shared exercise reads and excludes paused or completed goals", async () => {
  mocks.goals.mockResolvedValue({
    items: [
      reviewGoal(),
      reviewGoal({ id: "other", goal: "Bench target two" }),
      reviewGoal({ id: "paused", goal: "Paused goal", status: "paused" }),
      reviewGoal({ id: "done", goal: "Completed goal", status: "complete" }),
    ],
  });
  renderReview();
  await screen.findByText("Bench target two");
  expect(mocks.history).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("Paused goal")).not.toBeInTheDocument();
  expect(screen.queryByText("Completed goal")).not.toBeInTheDocument();
});

it("keeps manual milestones and legacy targets reviewable without claiming measured achievement", async () => {
  mocks.goals.mockResolvedValue({
    items: [
      reviewGoal({
        goalType: "milestone",
        exerciseId: "",
        goalMetric: "completed",
        goal: "Climb V5",
        target: "V5",
      }),
      reviewGoal({
        id: "legacy",
        goalType: "legacy",
        goal: "Practice climbing",
        target: "Climb V5",
      }),
    ],
  });
  renderReview();
  await screen.findByText("Awaiting your confirmation");
  expect(screen.getByText(/Check-ins record practice/)).toBeInTheDocument();
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  expect(mocks.history).not.toHaveBeenCalled();
});

it("does not disguise failed evidence as missing measurements and supports retry", async () => {
  mocks.history.mockRejectedValueOnce(new Error("Offline"));
  renderReview();
  await screen.findByText(/Couldn’t load the goal’s evidence/);
  expect(screen.queryByText(/No measurement for this metric/)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Retry evidence" }));
  expect(await screen.findByText(/Latest measurement: 80 kg/)).toBeInTheDocument();
});

it("supports retrying a failed goals read", async () => {
  mocks.goals.mockRejectedValueOnce(new Error("Offline"));
  renderReview();
  await screen.findByText("Couldn’t load your goals.");
  await userEvent.click(screen.getByRole("button", { name: "Try goals again" }));
  expect(await screen.findByRole("article")).toHaveTextContent("Bench press 100 kg");
});

it("shows a prompt for a new measurement instead of asserting no progress", async () => {
  mocks.history.mockResolvedValue(reviewHistory([]));
  renderReview();
  await screen.findByText(/No measurement for this metric/);
  expect(screen.getByRole("article")).not.toHaveTextContent(/No increase/);
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
});

it("labels incomplete training-time evidence and omits its progress bar", async () => {
  mocks.goals.mockResolvedValue({
    items: [
      reviewGoal({
        goalType: "consistency",
        goalMetric: "minutes",
        period: "week",
        targetUnit: "minutes",
        targetValue: 60,
      }),
    ],
  });
  mocks.activity.mockResolvedValue([
    { id: "timed", date: "2026-10-13", minutes: 30 },
    { id: "missing", date: "2026-10-14", minutes: 0 },
  ]);
  renderReview();
  await screen.findByText(/Some sessions have no recorded duration/);
  expect(screen.getByRole("article")).toHaveTextContent("30 minutes");
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
});

it("keeps additional goals behind a disclosure", async () => {
  mocks.goals.mockResolvedValue({
    items: Array.from({ length: 4 }, (_, index) =>
      reviewGoal({ id: `goal-${index}`, goal: `Goal ${index + 1}` }),
    ),
  });
  renderReview();
  await screen.findByText("Goal 1");
  const more = screen.getByText("More active goals (1)");
  expect(more.closest("details")).not.toHaveAttribute("open");
  await userEvent.click(more);
  expect(more.closest("details")).toHaveAttribute("open");
});

it("handles no active goals and unclaimed profiles without loading evidence", async () => {
  mocks.goals.mockResolvedValue({ items: [] });
  const first = renderReview();
  await screen.findByText(/No active goals yet/);
  first.unmount();
  mocks.goals.mockResolvedValue({ needsProfileClaim: true, items: [] });
  renderReview();
  await screen.findByText(/Open Goals to claim/);
  expect(mocks.history).not.toHaveBeenCalled();
  expect(mocks.activity).not.toHaveBeenCalled();
});

it("keeps goal progress visible in an empty week and refreshes its sources with Review", async () => {
  mocks.review.mockResolvedValue({
    weekStart: "2026-10-12",
    reviewEnd: "2026-10-14",
    isCurrentWeek: true,
    summary: { sessions: 0, activeDays: 0, minutes: 0, strengthVolume: 0 },
    comparison: { sessionDelta: 0, activeDayDelta: 0, minuteDelta: 0, volumeDelta: 0 },
    adherence: { percentage: null, completed: 0, skipped: 0, open: 0 },
    activityMix: [],
    locations: [],
    highlights: [],
    watchlist: [],
    actions: [],
    sessions: [],
  });
  renderReview(<WeeklyReviewPage />);
  await screen.findByRole("article");
  expect(screen.getByText("Show detailed weekly review").closest("details")).not.toHaveAttribute(
    "open",
  );
  expect(screen.getByRole("heading", { name: "Are you moving towards your goals?" })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Refresh weekly review" }));
  await waitFor(() => expect(mocks.goals).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(mocks.history).toHaveBeenCalledTimes(2));
  expect(
    within(screen.getByRole("article")).getByRole("link", { name: /View best log/ }),
  ).toBeInTheDocument();
});
