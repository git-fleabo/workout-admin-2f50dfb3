import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  plans: [] as unknown[],
  programmeOffers: [] as unknown[],
  programmeOverview: {
    assignments: [] as unknown[],
    templates: [] as unknown[],
    skippedWorkoutIds: [] as string[],
  },
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
  getMyProgrammeOverviewClient: vi.fn(async () => mocks.programmeOverview),
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
  planKind: "strength",
  suggestedFor: new Date().toISOString().slice(0, 10),
  movements: [{ exercise: "Bench Press", setRows: [{ reps: "5", weight: "60" }], restTime: "" }],
};

const programmeOffer = {
  assignmentId: "assignment-1",
  programmeName: "Base Strength",
  workoutNumber: 1,
  totalWorkouts: 12,
  scheduledDate: null,
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
    mocks.programmeOverview.assignments = [];
    mocks.programmeOverview.templates = [];
    mocks.programmeOverview.skippedWorkoutIds = [];
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows a saved next workout when one is available", async () => {
    mocks.plans = [savedPlan];

    renderToday();

    expect(await screen.findByText("Upper Strength")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start session" })).toBeInTheDocument();
  });

  it("puts the next programme session before daily practice with return choices", async () => {
    mocks.programmeOffers = [programmeOffer];

    renderToday();

    const programmeHeading = await screen.findByRole("heading", {
      name: "Your programme",
    });
    const dailyPracticeHeading = screen.getByRole("heading", {
      name: "Daily practice reminder",
    });

    expect(
      programmeHeading.compareDocumentPosition(dailyPracticeHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText("Base Strength")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with this session" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ease back in" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Skip ahead" })).toBeInTheDocument();
  });

  it("offers a gentle return after a long break", async () => {
    mocks.programmeOffers = [{ ...programmeOffer, scheduledDate: "2020-01-01" }];

    renderToday();

    expect(await screen.findByText("Picking up after a break?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ease back in" })).toBeInTheDocument();
  });

  it("keeps return choices and progress visible for a saved programme workout", async () => {
    const linkedPlan = {
      ...savedPlan,
      title: "Base Strength · Session B",
      status: "pending",
      basis: "Programme target.",
      programAssignmentId: "assignment-1",
      programWorkoutId: "workout-2",
      movements: [
        {
          ...savedPlan.movements[0],
          reason: "Programme target.",
          targets: {
            durationMinutes: "",
            distance: "",
            distanceUnit: "",
            rounds: "",
            height: "",
            detail: "",
          },
          setRows: [
            { reps: "5", weight: "60", durationSeconds: "" },
            { reps: "5", weight: "60", durationSeconds: "" },
          ],
        },
      ],
    };
    mocks.plans = [linkedPlan];
    mocks.programmeOverview.assignments = [
      {
        id: "assignment-1",
        programId: "programme-1",
        status: "active",
        currentWorkoutIndex: 1,
        startedOn: "2020-01-01",
      },
    ];
    mocks.programmeOverview.templates = [
      {
        id: "programme-1",
        workouts: [
          { id: "workout-1", sequenceIndex: 0, weekNumber: 1, dayNumber: 1 },
          { id: "workout-2", sequenceIndex: 1, weekNumber: 1, dayNumber: 2 },
        ],
      },
    ];
    mocks.programmeOverview.skippedWorkoutIds = ["workout-1"];

    renderToday();

    expect(await screen.findByText("Base Strength · Session B")).toBeInTheDocument();
    expect(screen.getByText(/0 completed · 1 skipped · Session 2 of 2/)).toBeInTheDocument();
    expect(screen.getByText("Picking up after a break?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with this session" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Skip ahead" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Ease back in" }));
    await waitFor(() => expect(window.localStorage.getItem("workout-plan-draft")).not.toBeNull());
    const easier = JSON.parse(window.localStorage.getItem("workout-plan-draft") ?? "null");
    expect(easier.movements[0].setRows).toHaveLength(1);
    expect(easier.movements[0].setRows[0].weight).toBe("54");
    expect(linkedPlan.movements[0].setRows).toHaveLength(2);
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
