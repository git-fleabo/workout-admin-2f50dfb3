import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { TrainingMethod } from "@/lib/supabase-training-methods.browser";

const mocks = vi.hoisted(() => ({
  addWorkoutSessionClient: vi.fn<(input: unknown) => Promise<{ sessionId: string }>>(async () => ({
    sessionId: "saved-session",
  })),
  duplicateResponse: false,
  trainingMethods: [] as TrainingMethod[],
  extraExercises: [] as {
    id: string;
    name: string;
    workoutType: string;
    metric: string;
    focusArea: string;
    availableLocationIds: string[];
    equipment: string;
  }[],
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: unknown) => config,
  Link: ({ children, ...props }: { children: ReactNode; to: string }) => (
    <a href={props.to}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    message: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/supabase-log.browser", () => ({
  BOARD_GRADIENTS: [],
  REST_OPTIONS: ["60–90s", "90–120s"],
  addWorkoutSessionClient: mocks.addWorkoutSessionClient,
  deleteSessionClient: vi.fn(),
  findDuplicateLogClient: vi.fn(async () => mocks.duplicateResponse),
  getLibraryClient: vi.fn(async () => ({
    exercises: [
      ...mocks.extraExercises,
      {
        id: "bench",
        name: "Bench Press",
        workoutType: "Strength",
        focusArea: "Push",
        availableLocationIds: ["gym"],
        equipment: "barbell",
      },
      {
        id: "bouldering",
        name: "Bouldering Session",
        workoutType: "Climbing",
        focusArea: "Climbing",
        availableLocationIds: ["gym"],
        equipment: "Climbing wall",
      },
      {
        id: "ropes",
        name: "Ropes/Belay",
        workoutType: "Climbing",
        focusArea: "Climbing",
        availableLocationIds: ["gym"],
        equipment: "Climbing wall",
      },
      {
        id: "kilter",
        name: "Kilter",
        workoutType: "Climbing",
        focusArea: "Climbing",
        availableLocationIds: ["gym"],
        equipment: "Climbing wall",
      },
      {
        id: "mix",
        name: "Mix",
        workoutType: "Climbing",
        focusArea: "Climbing",
        availableLocationIds: ["gym"],
        equipment: "Climbing wall",
      },
    ],
    locations: [{ id: "gym", name: "Gym", kind: "gym", equipmentItemIds: [] }],
    equipmentItems: [{ id: "climbing-wall", name: "Climbing wall", isActive: true }],
    intensities: [],
  })),
  getRecentLogsClient: vi.fn(async () => ({ recent: [] })),
  getTrainingLocationsClient: vi.fn(async () => [
    { id: "gym", name: "Gym", kind: "gym", equipmentItemIds: ["climbing-wall"] },
  ]),
  replaceWorkoutSessionClient: vi.fn(),
}));

vi.mock("@/lib/supabase-plans.browser", () => ({
  completeSuggestedWorkoutClient: vi.fn(),
  getNextSuggestedWorkoutsClient: vi.fn(async () => []),
  updateSuggestedWorkoutStatusClient: vi.fn(),
}));

vi.mock("@/lib/supabase-training-methods.browser", () => ({
  listTrainingMethodsClient: vi.fn(async () => ({ items: mocks.trainingMethods })),
}));

import { ClimbForm, FullWorkoutForm } from "@/components/workout-logger/full-workout-form";

function renderWithQueries(node: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
}

async function chooseBenchPress() {
  const user = userEvent.setup();
  await screen.findByRole("button", { name: "Gym" });
  const comboboxes = screen.getAllByRole("combobox");
  await user.click(comboboxes[comboboxes.length - 1]!);
  await user.click(await screen.findByText("Bench Press"));
  return user;
}

describe("FullWorkoutForm draft lifecycle", () => {
  beforeEach(() => {
    mocks.addWorkoutSessionClient.mockClear();
    mocks.extraExercises = [];
    mocks.trainingMethods = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("persists a draft, restores it after remount, and discards it explicitly", async () => {
    const { unmount } = renderWithQueries(<FullWorkoutForm />);
    await screen.findByText("Your workout");
    await chooseBenchPress();

    const draftKey = "workout-session-draft:signed-out";
    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(draftKey) ?? "null");
      expect(stored?.form?.entries?.[0]?.exercise).toBe("Bench Press");
    });

    unmount();
    renderWithQueries(<FullWorkoutForm />);
    await waitFor(() =>
      expect(screen.getAllByRole("combobox")[1]).toHaveTextContent("Bench Press"),
    );

    await userEvent.setup().click(screen.getByRole("button", { name: "Cancel workout" }));
    expect(await screen.findByText(/The unfinished draft, including/)).toBeInTheDocument();
    const cancelButtons = screen.getAllByRole("button", { name: "Cancel workout" });
    await userEvent.setup().click(cancelButtons[cancelButtons.length - 1]!);
    await waitFor(() => expect(window.localStorage.getItem(draftKey)).toBeNull());
  });

  it("calculates DUP back-offs from the actual top-set load and records the selected loads", async () => {
    window.localStorage.setItem(
      "workout-plan-draft",
      JSON.stringify({
        version: 1,
        title: "DUP peak",
        locationKind: "gym",
        trainingLocationId: "gym",
        basis: "Source targets",
        personalProgramme: true,
        movements: [
          {
            exercise: "Bench Press",
            workoutType: "Strength",
            trackingMode: "weight_reps",
            sourceDate: "",
            reason: "Choose top load at RPE 7",
            progression: { type: "source", minReps: 8, maxReps: 12, incrementKg: 2.5, maxRpe: 8 },
            baseStrength: { programme: "dup", phase: "peak", backOffPercent: 90, incrementKg: 2.5 },
            targets: {
              durationMinutes: "",
              distance: "",
              distanceUnit: "",
              rounds: "",
              height: "",
              detail: "",
            },
            setRows: [103, 90, 90].map((weight, i) => ({
              reps: "6",
              weight: String(weight),
              durationSeconds: "",
              rpe: i === 0 ? "7" : "",
              completed: true,
            })),
          },
        ],
      }),
    );
    const user = userEvent.setup();
    renderWithQueries(<FullWorkoutForm />);
    await user.click(await screen.findByRole("button", { name: "Calculate back-off loads" }));
    await waitFor(() => {
      const draft = JSON.parse(
        window.localStorage.getItem("workout-session-draft:signed-out") ?? "null",
      );
      expect(draft?.form?.entries?.[0]?.setRows.map((r: { weight: string }) => r.weight)).toEqual([
        "103",
        "92.5",
        "92.5",
      ]);
    });
    await user.click(screen.getByRole("button", { name: "Review and finish" }));
    await user.click(await screen.findByRole("button", { name: "Finish workout", exact: true }));
    await waitFor(() => expect(mocks.addWorkoutSessionClient).toHaveBeenCalledTimes(1));
    const payload = mocks.addWorkoutSessionClient.mock.calls[0][0] as {
      entries: { setRows: { weight: string }[] }[];
    };
    expect(payload.entries[0].setRows.map((r) => r.weight)).toEqual(["103", "92.5", "92.5"]);
  });

  it("clears the draft after the finish mutation succeeds", async () => {
    renderWithQueries(<FullWorkoutForm />);
    await screen.findByText("Your workout");
    await chooseBenchPress();

    const draftKey = "workout-session-draft:signed-out";
    await waitFor(() => expect(window.localStorage.getItem(draftKey)).not.toBeNull());

    await userEvent.setup().click(screen.getByRole("button", { name: "Review and finish" }));
    await screen.findByText("Finish this workout?");
    await userEvent.setup().click(screen.getByRole("button", { name: "Finish workout" }));

    await waitFor(() => {
      expect(mocks.addWorkoutSessionClient).toHaveBeenCalledTimes(1);
      expect(window.localStorage.getItem(draftKey)).toBeNull();
    });
  });

  it("keeps set number fields focused while entering multi-digit values", async () => {
    renderWithQueries(<FullWorkoutForm />);
    await screen.findByText("Your workout");
    const user = await chooseBenchPress();

    const weight = screen.getByRole("textbox", { name: "Set 1 weight" });
    await user.click(weight);
    await user.type(weight, "72.5");
    expect(weight).toHaveValue("72.5");
    expect(document.activeElement).toBe(weight);

    const reps = screen.getByRole("spinbutton", { name: "Set 1 reps" });
    await user.click(reps);
    await user.type(reps, "10");
    expect(reps).toHaveValue(10);
    expect(document.activeElement).toBe(reps);
  });

  it("shows rest between sets for every strength movement", async () => {
    renderWithQueries(<FullWorkoutForm />);
    await screen.findByText("Your workout");
    await chooseBenchPress();

    const restField = screen.getByText("Rest between sets").parentElement;
    const restSelect = restField?.querySelector<HTMLElement>("[role='combobox']");
    expect(restSelect).toBeTruthy();
    expect(restSelect).toHaveTextContent("Not recorded");
  });

  it("keeps timed recovery in sequence and preserves custom method settings when recording rounds", async () => {
    mocks.extraExercises = [
      {
        id: "recovery",
        name: "Timed Recovery",
        workoutType: "Conditioning",
        metric: "duration",
        focusArea: "",
        availableLocationIds: ["gym"],
        equipment: "bodyweight",
      },
    ];
    mocks.trainingMethods = [
      {
        id: "amrap",
        name: "AMRAP",
        systemKey: "amrap",
        family: "timed_density",
        description: "",
        defaultConfig: { mode: "amrap", block_minutes: 20 },
        isSystem: true,
        isEnabled: true,
        isActive: true,
      },
    ];
    const movement = (exercise: string, workoutType: string, seconds: string) => ({
      exercise,
      workoutType,
      trackingMode: "duration",
      reason: "Original timed test sequence",
      sourceDate: "",
      targets: {
        durationMinutes: "",
        distance: "",
        distanceUnit: "",
        rounds: "",
        height: "",
        detail: "",
      },
      setRows: [{ reps: "", weight: "", durationSeconds: seconds, rpe: "", completed: false }],
    });
    window.localStorage.setItem(
      "workout-plan-draft",
      JSON.stringify({
        version: 1,
        title: "Original timed sequence",
        locationKind: "gym",
        trainingLocationId: "gym",
        basis: "Original test",
        movements: [
          movement("Bench Press", "Strength", "30"),
          movement("Timed Recovery", "Conditioning", "90"),
        ],
        methodBlocks: [
          {
            trainingMethodId: "amrap",
            methodName: "AMRAP",
            family: "timed_density",
            memberMovementIndexes: [0, 1],
            rounds: "",
            blockDurationMinutes: "20",
            workIntervalSeconds: "",
            restIntervalSeconds: "",
            restBetweenMovementsSeconds: "",
            restBetweenRoundsSeconds: "",
            config: { mode: "amrap", active_recovery_seconds: 90, cycle_length: 2 },
          },
        ],
      }),
    );
    renderWithQueries(<FullWorkoutForm />);
    await screen.findByText("Timed Recovery");
    await userEvent.click(screen.getByRole("button", { name: "Edit", exact: true }));
    expect(await screen.findByRole("checkbox", { name: "Include Timed Recovery" })).toBeChecked();
    const roundsField = screen.getByText("Completed rounds (optional)").parentElement!;
    await userEvent.type(within(roundsField).getByRole("spinbutton"), "1");
    await userEvent.click(screen.getByRole("button", { name: "Save method", exact: true }));
    await userEvent.click(screen.getByRole("button", { name: "Review and finish" }));
    await screen.findByText("Finish this workout?");
    await userEvent.click(screen.getByRole("button", { name: "Finish workout", exact: true }));
    await waitFor(() => expect(mocks.addWorkoutSessionClient).toHaveBeenCalledTimes(1));
    const payload = mocks.addWorkoutSessionClient.mock.calls[0]![0] as unknown as {
      entries: { clientId: string }[];
      methodBlocks: {
        memberClientIds: string[];
        completedRounds: string;
        config: Record<string, unknown>;
      }[];
    };
    expect(payload.methodBlocks[0]!.memberClientIds).toEqual(
      payload.entries.map((entry) => entry.clientId),
    );
    expect(payload.methodBlocks[0]!.completedRounds).toBe("1");
    expect(payload.methodBlocks[0]!.config).toMatchObject({
      active_recovery_seconds: 90,
      cycle_length: 2,
    });
  });
});

describe("ClimbForm duplicate-session warning", () => {
  beforeEach(() => {
    mocks.duplicateResponse = true;
  });

  afterEach(() => {
    mocks.duplicateResponse = false;
  });

  it("opens the duplicate warning instead of logging immediately", async () => {
    renderWithQueries(<ClimbForm />);

    await screen.findByText("Log a climb");
    await userEvent.setup().click(await screen.findByRole("button", { name: "Gym" }));
    await userEvent.setup().click(screen.getByRole("button", { name: "Bouldering" }));
    await userEvent
      .setup()
      .type(screen.getByRole("spinbutton", { name: "Climbing duration minutes" }), "30");
    await userEvent.setup().click(screen.getByRole("button", { name: "Log climb" }));

    expect(await screen.findByText("Already logged today")).toBeInTheDocument();
    expect(mocks.addWorkoutSessionClient).not.toHaveBeenCalled();
  });
});
