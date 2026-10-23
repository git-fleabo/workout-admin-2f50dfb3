import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ExerciseSessionPoint } from "@/lib/training-types";

const mocks = vi.hoisted(() => ({ points: [] as ExerciseSessionPoint[], desktop: false }));
vi.mock("@/hooks/use-desktop", () => ({ useIsDesktop: () => mocks.desktop }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: object) => ({
    ...config,
    useSearch: () => ({ exercise: "bench" }),
  }),
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock("@/components/session-detail-dialog", () => ({
  SessionDetailDialog: ({ sessionId }: { sessionId: string | null }) =>
    sessionId ? <div role="dialog">Session {sessionId}</div> : null,
}));
vi.mock("@/components/workout-logger/prs-view", () => ({ PRsView: () => null }));
vi.mock("recharts", async (original) => ({
  ...(await original<object>()),
  ResponsiveContainer: () => <div data-testid="chart" />,
}));
vi.mock("@/lib/supabase-log.browser", () => ({
  getLibraryClient: async () => ({
    exercises: [
      {
        id: "bench",
        name: "Bench Press",
        workoutType: "Strength",
        metric: "weight_reps",
        locationScope: "both",
      },
      {
        id: "deadlift",
        name: "Deadlift",
        workoutType: "Strength",
        metric: "weight_reps",
        locationScope: "gym",
      },
      {
        id: "run",
        name: "Treadmill Run",
        workoutType: "Cardio",
        metric: "distance",
        locationScope: "home",
      },
    ],
  }),
}));
vi.mock("@/lib/supabase-history.browser", () => ({
  getLoggedExerciseKeysClient: async () => ({
    ids: ["bench", "deadlift", "run"],
    names: ["bench press", "deadlift", "treadmill run"],
    recent: [],
  }),
  getExerciseHistoryClient: async () => ({ points: mocks.points }),
  getPlannedActualComparisonsClient: async () => [],
}));
vi.mock("@/lib/supabase-programmes.browser", () => ({
  getCurrentProgrammeWorkoutOffersClient: async () => [],
}));
vi.mock("@/lib/supabase-personal-programmes.browser", () => ({
  getProgrammeExerciseContextClient: async () => null,
}));
vi.mock("@/lib/supabase-climbing.browser", () => ({ getClimbingProgressClient: async () => [] }));
import { Route } from "@/routes/progress";

function point(
  date: string,
  maxWeight: number | null,
  locationKind: "home" | "gym" = "gym",
): ExerciseSessionPoint {
  return {
    sessionId: date,
    date,
    locationKind,
    locationName: locationKind,
    methods: [],
    sessions: 1,
    totalReps: 5,
    totalVolume: (maxWeight ?? 0) * 5,
    maxWeight,
    est1RM: null,
    sets: [],
    totalDuration: 0,
    activityDurationMinutes: 0,
    totalDistanceKm: 0,
    distanceUnit: null,
    rounds: 0,
    feel: null,
    heightCm: null,
    positionMeasurementCm: null,
    positionMeasurementSetup: null,
    problems: 0,
    grade: null,
    gradient: null,
    averageRpe: null,
  };
}
function showProgress() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Page = (Route as unknown as { component: () => ReactNode }).component;
  render(
    <QueryClientProvider client={client}>
      <Page />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-22T12:00:00Z"));
  mocks.desktop = false;
  mocks.points = [
    point("2026-07-20", 50),
    point("2026-10-10", 55, "home"),
    point("2026-10-20", 60),
  ];
});
afterEach(() => vi.useRealTimers());

it("keeps the headline tied to location and period filters without labelling working weight as estimated 1RM", async () => {
  showProgress();
  const highlight = await screen.findByLabelText("Progress highlight");
  expect(highlight).toHaveTextContent("60 kg");
  expect(highlight).toHaveTextContent("+20% vs prior period");
  expect(highlight).toHaveTextContent("Last 8 weeks · All locations · All methods");
  const estimate = screen.getByText("Best est. 1RM").closest("div")!.parentElement!;
  expect(estimate).toHaveTextContent("—");
  expect(estimate).not.toHaveTextContent("60.0 kg");
  await userEvent.click(screen.getByRole("button", { name: "home", exact: true }));
  expect(highlight).toHaveTextContent("55 kg");
  expect(highlight).not.toHaveTextContent("+20%");
  expect(highlight).toHaveTextContent("Home");
  expect(screen.getByRole("button", { name: "home", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await userEvent.click(screen.getByRole("button", { name: "all", exact: true }));
  await userEvent.click(screen.getByRole("button", { name: "All", exact: true }));
  expect(highlight).toHaveTextContent("All recorded history");
  expect(highlight).not.toHaveTextContent("vs prior period");
});
it("shows an unmeasured result without inventing zero or a percentage", async () => {
  mocks.points = [point("2026-10-20", null)];
  showProgress();
  const highlight = await screen.findByLabelText("Progress highlight");
  expect(within(highlight).getByText("Not measured")).toBeInTheDocument();
  expect(highlight).not.toHaveTextContent("0 kg");
  expect(highlight).not.toHaveTextContent("%");
});

it("uses the desktop exercise list, filters the selected exercise, and opens exact sessions from its history", async () => {
  mocks.desktop = true;
  const user = userEvent.setup();
  showProgress();
  await screen.findByTestId("desktop-progress-workspace");
  await screen.findByLabelText("Progress highlight");
  const search = screen.getByRole("textbox", { name: "Search logged exercises" });
  await user.type(search, "dead");
  expect(screen.queryByRole("button", { name: /Bench Press/ })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /Deadlift/ }));
  expect(await screen.findByLabelText("Progress highlight")).toHaveTextContent("Deadlift");
  await user.clear(search);
  await user.click(screen.getByRole("button", { name: "home", exact: true }));
  expect(screen.queryByRole("button", { name: /Deadlift/ })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /Bench Press/ }));
  expect(await screen.findByLabelText("Progress highlight")).toHaveTextContent("55 kg");
  await user.click(screen.getByRole("tab", { name: "Session history" }));
  expect(screen.getByText("Exact session history")).toBeVisible();
  const sessionTable = screen.getByRole("table");
  await user.click(within(sessionTable).getByRole("button", { name: /10 Oct 2026/ }));
  expect(screen.getByRole("dialog")).toHaveTextContent("2026-10-10");
});

it("returns to trends if an exercise does not support the selected analysis tab", async () => {
  mocks.desktop = true;
  const user = userEvent.setup();
  showProgress();
  await screen.findByLabelText("Progress highlight");
  await user.click(screen.getByRole("tab", { name: "Methods & plan" }));
  expect(screen.getByText("Method comparison")).toBeVisible();
  await user.click(screen.getByRole("button", { name: /Treadmill Run/ }));
  expect(screen.getByRole("tab", { name: "Trends" })).toHaveAttribute("aria-selected", "true");
  expect(screen.queryByRole("tab", { name: "Methods & plan" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("tab", { name: "Personal bests" }));
  expect(screen.getByRole("tabpanel")).toHaveTextContent("Personal bests");
});
