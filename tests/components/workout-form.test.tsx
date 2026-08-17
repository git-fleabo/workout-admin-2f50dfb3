import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  addWorkoutSessionClient: vi.fn(async () => ({ sessionId: "saved-session" })),
  duplicateResponse: false,
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
  REST_OPTIONS: [],
  addWorkoutSessionClient: mocks.addWorkoutSessionClient,
  deleteSessionClient: vi.fn(),
  findDuplicateLogClient: vi.fn(async () => mocks.duplicateResponse),
  getLibraryClient: vi.fn(async () => ({
    exercises: [
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
  listTrainingMethodsClient: vi.fn(async () => ({ items: [] })),
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
