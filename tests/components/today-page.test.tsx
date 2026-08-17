import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  plans: [] as unknown[],
  programmeOffers: [] as unknown[],
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: unknown) => config,
  Link: ({ children, ...props }: { children: ReactNode; to: string }) => (
    <a href={props.to}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
}));

vi.mock("@/lib/supabase-log.browser", () => ({
  getLibraryClient: vi.fn(async () => ({ exercises: [], locations: [], intensities: [] })),
  getRecentLogsClient: vi.fn(async () => ({ recent: [] })),
}));

vi.mock("@/lib/supabase-daily-rotation.browser", () => ({
  getTodayDailyRotationClient: vi.fn(async () => ({ rotation: null, hasConfiguredItems: false })),
  setDailyRotationCompletedClient: vi.fn(),
}));

vi.mock("@/lib/supabase-plans.browser", () => ({
  getNextSuggestedWorkoutsClient: vi.fn(async () => mocks.plans),
  saveWorkoutPlanClient: vi.fn(),
  updateSuggestedWorkoutStatusClient: vi.fn(),
}));

vi.mock("@/lib/supabase-programmes.browser", () => ({
  getCurrentProgrammeWorkoutOffersClient: vi.fn(async () => mocks.programmeOffers),
  startProgrammeWorkoutClient: vi.fn(),
}));

vi.mock("@/lib/workout-plan", () => ({
  WORKOUT_PLAN_DRAFT_KEY: "workout-plan-draft",
  WORKOUT_PLAN_LOCATION_KEY: "workout-plan-location",
  WORKOUT_TRAINING_LOCATION_KEY: "workout-training-location",
  buildWorkoutSuggestion: vi.fn(() => null),
}));

vi.mock("@/lib/workout-lifecycle", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/workout-lifecycle")>();
  return { ...actual, workoutPlanLifecycleState: vi.fn(() => "planned") };
});

import { TodayPage } from "@/routes/index";

function renderToday() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TodayPage />
    </QueryClientProvider>,
  );
}

const savedPlan = {
  suggestedWorkoutId: "plan-1",
  title: "Upper Strength",
  locationKind: "gym",
  status: "planned",
  movements: [{ exercise: "Bench Press", setRows: [{ reps: "5", weight: "60" }], restTime: "" }],
};

const programmeOffer = {
  assignmentId: "assignment-1",
  programmeName: "Base Strength",
  workoutNumber: 1,
  totalWorkouts: 12,
  weekNumber: 1,
  sessionNumber: 1,
  workoutName: "Session A",
  exerciseIds: [],
  movements: [],
  selections: [],
};

describe("TodayPage branching", () => {
  beforeEach(() => {
    mocks.plans = [];
    mocks.programmeOffers = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows a saved next workout when one is available", async () => {
    mocks.plans = [savedPlan];

    renderToday();

    expect(await screen.findByText("Upper Strength")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start workout" })).toBeInTheDocument();
  });

  it("shows a due programme session when programme offers are available", async () => {
    mocks.programmeOffers = [programmeOffer];

    renderToday();

    expect(await screen.findByText("Programme session")).toBeInTheDocument();
    expect(screen.getByText("Base Strength")).toBeInTheDocument();
  });

  it("restores a resumable draft before showing empty next-workout state", async () => {
    window.localStorage.setItem(
      "workout-session-draft:signed-out",
      JSON.stringify({
        version: 1,
        savedAt: new Date().toISOString(),
        loadedSuggestionId: null,
        editingSessionId: null,
        form: {
          date: new Date().toLocaleDateString("en-CA"),
          title: "Draft session",
          entries: [{ exercise: "Bench Press" }],
        },
      }),
    );

    renderToday();

    expect(await screen.findByText("Resume Draft session")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText("No saved next workout yet.")).toBeInTheDocument(),
    );
  });

  it("shows the empty state when there is no saved plan, programme offer, or draft", async () => {
    renderToday();

    expect(await screen.findByText("No saved next workout yet.")).toBeInTheDocument();
  });
});
