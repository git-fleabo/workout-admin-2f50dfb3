import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { buildBaseStrengthPersonalSessions } from "@/lib/base-strength-personal";
import { DEFAULT_VOLUME_INTENSITY_OPTIONS } from "@/lib/base-strength-preview";
import { strengthChoices, strengthTemplate } from "../helpers/base-strength-fixtures";

const mocks = vi.hoisted(() => ({
  library: vi.fn(),
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
  Link: ({
    children,
    to,
    search,
  }: {
    children: ReactNode;
    to: string;
    search?: Record<string, string>;
  }) => <a href={to + (search ? `?${new URLSearchParams(search)}` : "")}>{children}</a>,
  useNavigate: () => vi.fn(),
}));

vi.mock("@/lib/supabase-log.browser", () => ({
  getLibraryClient: mocks.library,
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
  const result = render(
    <QueryClientProvider client={queryClient}>
      <TodayPage />
    </QueryClientProvider>,
  );
  return { ...result, queryClient };
}

const savedPlan = {
  suggestedWorkoutId: "plan-1",
  title: "Upper Strength",
  locationKind: "gym",
  status: "planned",
  planKind: "strength",
  suggestedFor: "2026-10-06",
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
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-06T12:00:00.000Z"));
    mocks.plans = [];
    mocks.library.mockReset().mockResolvedValue({ exercises: [], locations: [], intensities: [] });
    mocks.programmeOffers = [];
    mocks.programmeOverview.assignments = [];
    mocks.programmeOverview.templates = [];
    mocks.programmeOverview.skippedWorkoutIds = [];
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("routes missing accessory targets to the exact editor and restores starting after they are saved", async () => {
    const choices = strengthChoices("volume_intensity");
    choices["accessory:Row:2"].load = null;
    choices["accessory:Row:2"].exerciseName = "Kettlebell Clean & Press";
    const [session] = buildBaseStrengthPersonalSessions({
      programme: "volume_intensity",
      template: strengthTemplate("volume_intensity"),
      options: DEFAULT_VOLUME_INTENSITY_OPTIONS,
      choices,
      startedOn: "2026-10-06",
      increment: 2.5,
      locationKind: "gym",
    });
    mocks.programmeOffers = [
      {
        ...programmeOffer,
        programWorkoutId: session.workoutId,
        movements: session.plan.movements,
        personalSession: session,
      },
    ];
    mocks.library.mockResolvedValue({
      exercises: [],
      locations: [{ id: "gym", name: "Gym", kind: "gym" }],
      intensities: [],
    });
    const { queryClient } = renderToday();
    const review = await screen.findByRole("link", { name: "Review session targets" });
    expect(review).toHaveAttribute(
      "href",
      `/plan?programme=assignment-1&session=${session.workoutId}`,
    );
    expect(
      screen.getByText("Kettlebell Clean & Press: choose a load for every set."),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Continue with this session" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ease back in" })).toBeNull();
    const saved = structuredClone(session);
    saved.plan.movements[2].setRows.forEach((set) => {
      set.weight = "16";
    });
    mocks.programmeOffers = [
      {
        ...programmeOffer,
        programWorkoutId: saved.workoutId,
        movements: saved.plan.movements,
        personalSession: saved,
      },
    ];
    await queryClient.invalidateQueries({ queryKey: ["programme-workout-offers"] });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Continue with this session" })).toBeEnabled(),
    );
    expect(screen.queryByRole("link", { name: "Review session targets" })).toBeNull();
  });

  it("shows a saved next workout when one is available", async () => {
    mocks.plans = [savedPlan];

    renderToday();

    expect(await screen.findByText("Upper Strength")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start session" })).toBeInTheDocument();
  });

  it("holds supporting sessions back until their programme starts", async () => {
    mocks.plans = [
      {
        ...savedPlan,
        title: "Handstand practice",
        planKind: "skill",
        programAssignmentId: "assignment-1",
        goalId: "goal-1",
      },
    ];
    mocks.programmeOverview.assignments = [
      {
        id: "assignment-1",
        programId: "programme-1",
        status: "paused",
        currentWorkoutIndex: 0,
      },
    ];

    renderToday();

    expect(await screen.findByText("No saved next workout yet.")).toBeInTheDocument();
    expect(screen.queryByText("Handstand practice")).not.toBeInTheDocument();
  });

  it("offers the next supporting session once its programme is active", async () => {
    mocks.plans = [
      {
        ...savedPlan,
        title: "Handstand practice",
        planKind: "skill",
        programAssignmentId: "assignment-1",
        goalId: "goal-1",
      },
    ];
    mocks.programmeOverview.assignments = [
      {
        id: "assignment-1",
        programId: "programme-1",
        status: "active",
        currentWorkoutIndex: 0,
      },
    ];

    renderToday();

    expect(await screen.findByText("Handstand practice")).toBeInTheDocument();
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

  it("keeps programme actions safe while location data is pending rather than reporting missing equipment", async () => {
    let release!: (value: unknown) => void;
    mocks.library.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    mocks.programmeOffers = [programmeOffer];
    renderToday();
    expect(await screen.findByText("Loading training locations…")).toBeVisible();
    expect(screen.queryByText(/These mapped movements do not share/)).toBeNull();
    expect(screen.getByRole("button", { name: "Continue with this session" })).toBeDisabled();
    release({
      exercises: [],
      locations: [{ id: "gym", name: "Gym", kind: "gym" }],
      intensities: [],
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Continue with this session" })).toBeEnabled(),
    );
    expect(
      screen.getByRole("combobox", { name: "Base Strength training location" }),
    ).toHaveTextContent("Gym");
  });

  it("offers a retry for failed reference reads and enables the programme only after recovery", async () => {
    mocks.library.mockRejectedValueOnce(new TypeError("Offline")).mockResolvedValue({
      exercises: [],
      locations: [{ id: "gym", name: "Gym", kind: "gym" }],
      intensities: [],
    });
    mocks.programmeOffers = [programmeOffer];
    renderToday();
    const retry = await screen.findByRole("button", { name: "Retry training setup" });
    expect(screen.getByRole("button", { name: "Continue with this session" })).toBeDisabled();
    expect(screen.queryByText(/These mapped movements do not share/)).toBeNull();
    await userEvent.click(retry);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Continue with this session" })).toBeEnabled(),
    );
  });

  it("does not start from stale cached setup after a failed refresh", async () => {
    mocks.library
      .mockResolvedValueOnce({
        exercises: [],
        locations: [{ id: "gym", name: "Gym", kind: "gym" }],
        intensities: [],
      })
      .mockRejectedValue(new TypeError("Offline"));
    mocks.programmeOffers = [programmeOffer];
    const { queryClient } = renderToday();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Continue with this session" })).toBeEnabled(),
    );
    await queryClient.refetchQueries({ queryKey: ["library"] });
    expect(await screen.findByRole("button", { name: "Retry training setup" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Continue with this session" })).toBeDisabled();
  });

  it("still reports a genuine location mismatch after successful reference loading", async () => {
    mocks.programmeOffers = [programmeOffer];
    renderToday();
    expect(await screen.findByText(/These mapped movements do not share/)).toBeVisible();
    expect(screen.queryByText("Loading training locations…")).toBeNull();
    expect(screen.getByRole("button", { name: "Continue with this session" })).toBeDisabled();
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

  it("labels a resumable KB summary instead of counting every prescribed step as a movement", async () => {
    window.localStorage.setItem(
      "workout-session-draft:signed-out",
      JSON.stringify({
        version: 1,
        savedAt: new Date().toISOString(),
        form: {
          date: new Date().toLocaleDateString("en-CA"),
          title: "KB practice",
          entries: Array.from({ length: 40 }, () => ({ exercise: "Kettlebell Swing" })),
          kettlebellLog: { mode: "summary" },
        },
      }),
    );
    renderToday();
    expect(await screen.findByText("Summary log in progress")).toBeVisible();
    expect(screen.queryByText(/40 movements/)).not.toBeInTheDocument();
  });
});
