import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { WeeklyReviewData } from "@/lib/supabase-weekly-review.browser";
import { DESKTOP_WORKSPACE_QUERY } from "@/hooks/use-desktop";

const mocks = vi.hoisted(() => ({ review: vi.fn(), timeline: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  Link: ({
    children,
    to,
    search,
    ...props
  }: {
    children: ReactNode;
    to: string;
    search?: Record<string, string>;
  }) => (
    <a href={to + (search ? `?${new URLSearchParams(search)}` : "")} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/supabase-weekly-review.browser", () => ({
  getWeeklyReviewClient: mocks.review,
  weeklyReviewWeekStart: () => "2026-10-19",
  moveWeeklyReviewWeek: (_date: string, direction: number) =>
    direction < 0 ? "2026-10-12" : "2026-10-19",
}));
vi.mock("@/lib/supabase-timeline.browser", () => ({ getTimelineDataClient: mocks.timeline }));
vi.mock("@/components/weekly-goal-review", () => ({
  WeeklyGoalReview: ({ weekStart }: { weekStart: string }) => (
    <div>Goal evidence for {weekStart}</div>
  ),
}));
vi.mock("@/components/weekly-programme-review", () => ({
  WeeklyProgrammeReview: ({
    current,
    onCurrentWeek,
  }: {
    current: boolean;
    onCurrentWeek: () => void;
  }) =>
    current ? (
      <div>Current programme controls</div>
    ) : (
      <button onClick={onCurrentWeek}>Review current programme</button>
    ),
}));
import { WeeklyReviewPage } from "@/routes/weekly-review";

function fixture(weekStart = "2026-10-19"): WeeklyReviewData {
  return {
    weekStart,
    weekEnd: "2026-10-25",
    reviewEnd: "2026-10-23",
    isCurrentWeek: weekStart === "2026-10-19",
    isCompleteWeek: false,
    comparisonLabel: "Compared with last week",
    summary: {
      sessions: 2,
      activeDays: 2,
      minutes: 45,
      strengthVolume: 1200,
      movements: 2,
      hardDays: 0,
      rpeCoverage: 50,
    },
    comparison: {
      sessions: 1,
      activeDays: 1,
      minutes: 30,
      strengthVolume: 1000,
      sessionDelta: 1,
      activeDayDelta: 1,
      minuteDelta: 15,
      volumeDelta: 200,
    },
    adherence: { total: 0, completed: 0, skipped: 0, open: 0, percentage: null },
    programmeAdherence: {
      due: 1,
      completed: 1,
      onTime: 1,
      late: 0,
      outstanding: 0,
      missed: 0,
      skipped: 0,
      percentage: 100,
    },
    programmeCompletedThisWeek: 1,
    supportCompletedThisWeek: 1,
    activityMix: [{ label: "Strength", sessions: 2 }],
    locations: [{ label: "Home", sessions: 2 }],
    highlights: [{ title: "Good consistency", detail: "Two sessions logged", tone: "positive" }],
    watchlist: [],
    actions: [
      {
        title: "Keep going",
        detail: "Continue your saved programme",
        evidence: "Two sessions recorded",
        tone: "positive",
      },
    ],
    sessions: [
      {
        id: `${weekStart}-first`,
        title: "Strength A",
        date: weekStart,
        location: "Home",
        activities: ["Strength"],
        movements: ["Bench Press"],
        minutes: 45,
        rpe: 7,
      },
      {
        id: `${weekStart}-second`,
        title: "Strength B",
        date: weekStart,
        location: "Home",
        activities: ["Strength"],
        movements: ["Deadlift"],
        minutes: 0,
        rpe: null,
      },
    ],
  };
}
let changeViewport: (matches: boolean) => void;
beforeEach(() => {
  vi.clearAllMocks();
  let matches = true;
  const listeners = new Set<() => void>();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((query: string) => ({
      get matches() {
        return query === DESKTOP_WORKSPACE_QUERY && matches;
      },
      media: query,
      addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
    })),
  });
  changeViewport = (value) =>
    act(() => {
      matches = value;
      listeners.forEach((listener) => listener());
    });
  mocks.review.mockImplementation(async (week: string) => fixture(week));
  mocks.timeline.mockResolvedValue({ entries: [] });
});
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <WeeklyReviewPage />
    </QueryClientProvider>,
  );
  return client;
}

it("uses Plan's desktop detection and switches back to the mobile review", async () => {
  mount();
  await screen.findByTestId("desktop-review-workspace");
  expect(window.matchMedia).toHaveBeenCalledWith(DESKTOP_WORKSPACE_QUERY);
  expect(screen.getByRole("table")).toBeInTheDocument();
  changeViewport(false);
  expect(screen.queryByTestId("desktop-review-workspace")).not.toBeInTheDocument();
  expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  expect(screen.getByText("Goal evidence for 2026-10-19")).toBeVisible();
  expect(screen.getByText("Current programme controls")).toBeVisible();
  changeViewport(true);
  expect(screen.getByRole("tablist", { name: "Review sections" })).toBeInTheDocument();
});

it("inspects sessions, preserves missing values, and opens the matching full log", async () => {
  const user = userEvent.setup();
  mount();
  await screen.findByRole("table");
  await user.click(screen.getByRole("button", { name: /^Strength B/ }));
  const details = within(screen.getByRole("region", { name: "Selected session" }));
  expect(details.getByText("Deadlift")).toBeVisible();
  expect(details.getByText("Duration not recorded · Effort not recorded")).toBeVisible();
  expect(details.getByRole("link", { name: "Open full log" })).toHaveAttribute(
    "href",
    "/history?session=2026-10-19-second",
  );
  await user.click(screen.getByRole("button", { name: "Previous week" }));
  await waitFor(() =>
    expect(screen.getByRole("link", { name: "Open full log" })).toHaveAttribute(
      "href",
      "/history?session=2026-10-12-first",
    ),
  );
  expect(screen.queryByText("Deadlift")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Next week" })).toBeEnabled();
  await user.click(screen.getByRole("button", { name: "Back to this week" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Next week" })).toBeDisabled());
});

it("keeps next steps available across tabs and passes the selected week to reviews", async () => {
  const user = userEvent.setup();
  const client = mount();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  await screen.findByRole("table");
  await user.click(screen.getByRole("tab", { name: "Goals & progress" }));
  expect(screen.getByText("Goal evidence for 2026-10-19")).toBeVisible();
  expect(screen.getByRole("complementary", { name: "Next steps" })).toHaveTextContent("Keep going");
  await user.click(screen.getByRole("button", { name: "Previous week" }));
  await screen.findByText("Goal evidence for 2026-10-12");
  await user.click(screen.getByRole("tab", { name: "Programme adjustments" }));
  expect(screen.queryByText("Current programme controls")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Review current programme" }));
  await screen.findByText("Current programme controls");
  await user.click(screen.getByRole("button", { name: "Refresh weekly review" }));
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["goals"] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["programme-strength-week-review"] });
});

it("handles an empty week without stale session details", async () => {
  const empty = fixture();
  empty.summary.sessions = 0;
  empty.sessions = [];
  empty.activityMix = [];
  empty.actions = [];
  mocks.review.mockResolvedValue(empty);
  mount();
  await screen.findByText("No training recorded for this week");
  expect(screen.queryByRole("region", { name: "Selected session" })).not.toBeInTheDocument();
  expect(screen.getByText("No completed sessions in this period.")).toBeVisible();
  expect(screen.getByText("No suggestions for this period yet.")).toBeVisible();
});
