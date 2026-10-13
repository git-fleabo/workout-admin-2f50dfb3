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
  savedKBPlan: null as unknown,
  trainingMethods: [] as TrainingMethod[],
  locations: [] as {
    id: string;
    name: string;
    kind: "home" | "gym" | "other";
    equipmentItemIds: string[];
  }[],
  extraExercises: [] as {
    id: string;
    name: string;
    workoutType: string;
    metric: string;
    focusArea: string;
    availableLocationIds: string[];
    equipment: string;
    locationScope?: "home" | "gym" | "both";
    equipmentItemIds?: string[];
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
    info: vi.fn(),
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
    equipmentItems: [
      { id: "climbing-wall", name: "Climbing wall", isActive: true },
      { id: "rings", name: "Gymnastic rings", isActive: true },
      { id: "mat", name: "Mat", isActive: true },
    ],
    intensities: [],
  })),
  getRecentLogsClient: vi.fn(async () => ({ recent: [] })),
  getTrainingLocationsClient: vi.fn(async () =>
    mocks.locations.length
      ? mocks.locations
      : [{ id: "gym", name: "Gym", kind: "gym", equipmentItemIds: ["climbing-wall"] }],
  ),
  replaceWorkoutSessionClient: vi.fn(),
}));

vi.mock("@/lib/supabase-plans.browser", () => ({
  completeSuggestedWorkoutClient: vi.fn(),
  getNextSuggestedWorkoutsClient: vi.fn(async () => []),
  getSavedWorkoutPlanClient: vi.fn(async () => mocks.savedKBPlan),
  updateSuggestedWorkoutStatusClient: vi.fn(),
}));

vi.mock("@/lib/supabase-training-methods.browser", () => ({
  listTrainingMethodsClient: vi.fn(async () => ({ items: mocks.trainingMethods })),
}));

import { ClimbForm, FullWorkoutForm } from "@/components/workout-logger/full-workout-form";
import { kettlebellWorkoutDraft } from "@/lib/kettlebell-workouts";
import { kbFixture, kbId } from "../helpers/kettlebell-fixtures";
import { WORKOUT_PLAN_DRAFT_KEY } from "@/lib/workout-plan";
import { replaceWorkoutSessionClient } from "@/lib/supabase-log.browser";

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
  function kbPlan(mode = "amrap") {
    const workout = kbFixture();
    workout.prescription.movements[0].exercise = "Bench Press";
    workout.durationMinutes = 20;
    workout.prescription.methodBlocks = [
      {
        trainingMethodId: kbId(500),
        methodName: mode.toUpperCase(),
        family: "timed_density",
        memberMovementIndexes: [0],
        rounds: "",
        blockDurationMinutes: "20",
        restBetweenRoundsSeconds: "",
        restBetweenMovementsSeconds: "",
        workIntervalSeconds: "",
        restIntervalSeconds: "",
        config: { mode },
      },
    ];
    return {
      ...kettlebellWorkoutDraft(workout, { id: "gym", kind: "gym" }),
      suggestedWorkoutId: "kb-plan",
    };
  }

  it("defaults a prescribed KB session to one-click summary completion without set inputs", async () => {
    window.localStorage.setItem(WORKOUT_PLAN_DRAFT_KEY, JSON.stringify(kbPlan()));
    renderWithQueries(<FullWorkoutForm />);
    await screen.findByText("Kettlebell · Simple session log");
    expect(screen.getByRole("spinbutton", { name: "Duration (minutes)" })).toHaveValue(20);
    expect(screen.queryByText("Movements and sets")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Finish workout", exact: true }));
    await waitFor(() => expect(mocks.addWorkoutSessionClient).toHaveBeenCalledTimes(1));
    const saved = mocks.addWorkoutSessionClient.mock
      .calls[0][0] as import("@/lib/supabase-log.browser").WorkoutSessionInput;
    expect(saved.suggestedWorkoutId).toBe("kb-plan");
    expect(saved.kettlebellSummary).toEqual({
      weightUsed: "",
      result: "",
      resultLabel: "Rounds completed",
    });
    expect(saved.entries).toHaveLength(1);
    expect(saved.entries[0].setRows).toEqual([]);
    expect(saved.entries[0].reps).toBe("");
    expect(saved.methodBlocks).toEqual([]);
    expect(saved.entries[0].notes).toContain("Prescribed workout (reference only)");
  });

  it("upgrades an older unfinished KB draft from its saved snapshot", async () => {
    const plan = kbPlan();
    mocks.savedKBPlan = { ...plan, programAssignmentId: null, programWorkoutId: null };
    const older = { ...plan };
    delete older.kettlebell;
    window.localStorage.setItem(WORKOUT_PLAN_DRAFT_KEY, JSON.stringify(older));
    renderWithQueries(<FullWorkoutForm />);
    await screen.findByText("Kettlebell · Simple session log");
    expect(screen.getByRole("spinbutton", { name: "Duration (minutes)" })).toHaveValue(20);
    await userEvent.click(screen.getByRole("button", { name: "Log individual sets" }));
    expect(screen.getByText("Movements and sets")).toBeVisible();
    expect(mocks.addWorkoutSessionClient).not.toHaveBeenCalled();
  });

  it("restores KB summary inputs and preserves them when switching to individual sets and back", async () => {
    window.localStorage.setItem(WORKOUT_PLAN_DRAFT_KEY, JSON.stringify(kbPlan()));
    const first = renderWithQueries(<FullWorkoutForm />);
    await screen.findByText("Kettlebell · Simple session log");
    await userEvent.type(
      screen.getByRole("textbox", { name: "Weight used (optional)" }),
      "2 × 16 kg",
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: "Session notes (optional)" }),
      "Stopped early",
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: "Rounds completed (optional)" }),
      "4 + part of next",
    );
    const minutes = screen.getByRole("spinbutton", { name: "Duration (minutes)" });
    await userEvent.clear(minutes);
    await userEvent.type(minutes, "18");
    first.unmount();
    renderWithQueries(<FullWorkoutForm />);
    expect(await screen.findByRole("textbox", { name: "Weight used (optional)" })).toHaveValue(
      "2 × 16 kg",
    );
    expect(screen.getByRole("spinbutton", { name: "Duration (minutes)" })).toHaveValue(18);
    await userEvent.click(screen.getByRole("button", { name: "Log individual sets" }));
    expect(screen.getByText("Movements and sets")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Use simple session log" }));
    expect(screen.getByRole("textbox", { name: "Rounds completed (optional)" })).toHaveValue(
      "4 + part of next",
    );
    expect(screen.getByRole("textbox", { name: "Session notes (optional)" })).toHaveValue(
      "Stopped early",
    );
    await userEvent.click(screen.getByRole("button", { name: "Finish workout", exact: true }));
    await waitFor(() => expect(mocks.addWorkoutSessionClient).toHaveBeenCalledTimes(1));
    expect(mocks.addWorkoutSessionClient.mock.calls[0][0]).toMatchObject({
      duration: "18",
      notes: expect.stringContaining("Stopped early"),
      kettlebellSummary: { weightUsed: "2 × 16 kg", result: "4 + part of next" },
    });
    await userEvent.click(await screen.findByRole("button", { name: "Edit workout", exact: true }));
    expect(screen.getByRole("textbox", { name: "Weight used (optional)" })).toHaveValue(
      "2 × 16 kg",
    );
    expect(screen.getByRole("button", { name: "Save correction" })).toBeVisible();
    vi.mocked(replaceWorkoutSessionClient).mockResolvedValue({
      ok: true,
      sessionId: "saved-session",
      replacedSessionId: "saved-session",
      planRelinkFailed: false,
    });
    await userEvent.click(screen.getByRole("button", { name: "Save correction" }));
    await waitFor(() =>
      expect(replaceWorkoutSessionClient).toHaveBeenCalledWith(
        "saved-session",
        expect.objectContaining({
          kettlebellSummary: expect.objectContaining({ weightUsed: "2 × 16 kg" }),
          entries: [expect.objectContaining({ setRows: [] })],
        }),
      ),
    );
  });

  it("keeps EMOM logging minimal and rejects a blank duration while retaining the draft", async () => {
    window.localStorage.setItem(WORKOUT_PLAN_DRAFT_KEY, JSON.stringify(kbPlan("emom")));
    renderWithQueries(<FullWorkoutForm />);
    await screen.findByText("Kettlebell · Simple session log");
    expect(screen.queryByRole("textbox", { name: /Rounds completed/ })).not.toBeInTheDocument();
    await userEvent.clear(screen.getByRole("spinbutton", { name: "Duration (minutes)" }));
    await userEvent.click(screen.getByRole("button", { name: "Finish workout", exact: true }));
    expect(mocks.addWorkoutSessionClient).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("enter a duration");
    expect(window.localStorage.getItem("workout-session-draft:signed-out")).not.toBeNull();
  });
  it("names repeated movement notes and keeps each control ID distinct", async () => {
    renderWithQueries(<FullWorkoutForm />);
    await screen.findByText("Your workout");
    await userEvent.click(screen.getByRole("button", { name: "Add movement", exact: true }));
    for (const summary of screen.getAllByText("Movement notes · Optional", { exact: true })) {
      await userEvent.click(summary);
    }
    const first = screen.getByRole("textbox", { name: "Movement 1 notes", exact: true });
    const second = screen.getByRole("textbox", { name: "Movement 2 notes", exact: true });
    expect(first).toBeVisible();
    expect(second).toBeVisible();
    expect(first.id).toBeTruthy();
    expect(second.id).not.toBe(first.id);
    expect(mocks.addWorkoutSessionClient).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    mocks.addWorkoutSessionClient.mockClear();
    mocks.savedKBPlan = null;
    mocks.extraExercises = [];
    mocks.trainingMethods = [];
    mocks.locations = [];
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

  it("offers repaired Ring Dip at Home and keeps equipment checks when changing locations", async () => {
    mocks.locations = [
      { id: "home", name: "Home", kind: "home", equipmentItemIds: ["rings"] },
      { id: "other", name: "Unfurl", kind: "other", equipmentItemIds: ["mat"] },
    ];
    mocks.extraExercises = [
      {
        id: "dip",
        name: "Ring Dip",
        workoutType: "Strength",
        metric: "reps_only",
        focusArea: "Push",
        equipment: "Gymnastic rings",
        equipmentItemIds: ["rings"],
        locationScope: "both",
        availableLocationIds: ["home"],
      },
    ];
    const user = userEvent.setup();
    renderWithQueries(<FullWorkoutForm />);
    await user.click(await screen.findByRole("button", { name: "Home" }));
    await user.click(
      screen
        .getAllByRole("combobox")
        .find((element) => element.getAttribute("aria-haspopup") === "dialog")!,
    );
    await user.click(await screen.findByRole("option", { name: /Ring Dip/ }));
    expect(screen.queryByText("Some movements are not available here")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Unfurl" }));
    expect(
      await screen.findByText(/Missing equipment at Unfurl: Gymnastic rings/),
    ).toBeInTheDocument();
  });

  it("explains a scope restriction without blaming equipment that Home already has", async () => {
    mocks.locations = [
      { id: "gym", name: "Gym", kind: "gym", equipmentItemIds: ["rings"] },
      { id: "home", name: "Home", kind: "home", equipmentItemIds: ["rings"] },
    ];
    mocks.extraExercises = [
      {
        id: "dip",
        name: "Ring Dip",
        workoutType: "Strength",
        metric: "reps_only",
        focusArea: "Push",
        equipment: "Gymnastic rings",
        equipmentItemIds: ["rings"],
        locationScope: "gym",
        availableLocationIds: ["gym"],
      },
    ];
    const user = userEvent.setup();
    renderWithQueries(<FullWorkoutForm />);
    await user.click(await screen.findByRole("button", { name: "Gym" }));
    await user.click(
      screen
        .getAllByRole("combobox")
        .find((element) => element.getAttribute("aria-haspopup") === "dialog")!,
    );
    await user.click(await screen.findByRole("option", { name: /Ring Dip/ }));
    await user.click(screen.getByRole("button", { name: "Home" }));
    expect(await screen.findByText(/Ring Dip: Set to Gym only in Library/)).toBeInTheDocument();
    expect(screen.queryByText(/Missing equipment/)).not.toBeInTheDocument();
    await user.click(
      screen
        .getAllByRole("combobox")
        .find((element) => element.getAttribute("aria-haspopup") === "dialog")!,
    );
    await user.type(screen.getByPlaceholderText("Search movement name..."), "Ring Dip");
    expect(await screen.findByRole("option", { name: /Ring Dip.*Gym only/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.queryByText("Equipment not assigned")).not.toBeInTheDocument();
  });

  it("offers Gym-scoped movements at equipped Other locations consistently with Library", async () => {
    mocks.locations = [{ id: "other", name: "Unfurl", kind: "other", equipmentItemIds: ["mat"] }];
    mocks.extraExercises = [
      {
        id: "yoga",
        name: "Yoga Class",
        workoutType: "Yoga",
        metric: "duration",
        focusArea: "",
        equipment: "Mat",
        equipmentItemIds: ["mat"],
        locationScope: "gym",
        availableLocationIds: ["other"],
      },
    ];
    const user = userEvent.setup();
    renderWithQueries(<FullWorkoutForm />);
    await user.click(await screen.findByRole("button", { name: "Unfurl" }));
    await user.click(
      screen
        .getAllByRole("combobox")
        .find((element) => element.getAttribute("aria-haspopup") === "dialog")!,
    );
    const option = await screen.findByRole("option", { name: /Yoga Class/ });
    expect(option).not.toHaveAttribute("aria-disabled", "true");
    await user.click(option);
    expect(screen.queryByText("Some movements are not available here")).not.toBeInTheDocument();
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

  it("transfers an offline finish into the pending save and clears the form without recording completion", async () => {
    renderWithQueries(<FullWorkoutForm />);
    await screen.findByText("Your workout");
    await chooseBenchPress();
    mocks.addWorkoutSessionClient.mockResolvedValueOnce({ sessionId: "", queued: true } as {
      sessionId: string;
    });
    await userEvent.click(screen.getByRole("button", { name: "Review and finish" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Finish workout", exact: true }),
    );
    await waitFor(() =>
      expect(window.localStorage.getItem("workout-session-draft:signed-out")).toBeNull(),
    );
    expect(window.localStorage.getItem("last-completed-workout:signed-out")).toBeNull();
    expect(mocks.addWorkoutSessionClient).toHaveBeenCalledTimes(1);
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

describe("ClimbForm durable draft", () => {
  it("restores the unfinished climb after remount and can finish offline without a remote duplicate check", async () => {
    mocks.addWorkoutSessionClient.mockClear();
    const view = renderWithQueries(<ClimbForm />);
    const minutes = await screen.findByRole("spinbutton", { name: "Climbing duration minutes" });
    await userEvent.type(minutes, "30");
    await waitFor(() =>
      expect(
        JSON.parse(window.localStorage.getItem("climbing-session-draft:signed-out") ?? "null")?.form
          .durationMinutes,
      ).toBe("30"),
    );
    const entryClientId = JSON.parse(
      window.localStorage.getItem("climbing-session-draft:signed-out")!,
    ).entryClientId;
    view.unmount();
    renderWithQueries(<ClimbForm />);
    await waitFor(() =>
      expect(screen.getByRole("spinbutton", { name: "Climbing duration minutes" })).toHaveValue(30),
    );
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    try {
      mocks.addWorkoutSessionClient.mockResolvedValueOnce({ sessionId: "", queued: true } as {
        sessionId: string;
      });
      const button = screen.getByRole("button", { name: "Log climb", exact: true });
      await waitFor(() => expect(button).toBeEnabled());
      await userEvent.click(button);
      await waitFor(() => expect(mocks.addWorkoutSessionClient).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(window.localStorage.getItem("climbing-session-draft:signed-out")).toBeNull(),
      );
      expect(mocks.addWorkoutSessionClient.mock.calls[0][0]).toMatchObject({
        entries: [{ clientId: entryClientId }],
      });
      expect(mocks.addWorkoutSessionClient.mock.calls[0][1]).toMatchObject({
        draftKey: "climbing-session-draft:signed-out",
      });
    } finally {
      Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    }
  });
});

describe("ClimbForm duplicate-session warning", () => {
  beforeEach(() => {
    mocks.addWorkoutSessionClient.mockClear();
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
    await userEvent.click(screen.getByRole("button", { name: "Cancel", exact: true }));
    expect(screen.getByRole("button", { name: "Log climb", exact: true })).toHaveFocus();
  });
});
