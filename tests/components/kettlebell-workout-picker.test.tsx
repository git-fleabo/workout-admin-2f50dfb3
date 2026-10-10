import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { kbFixture, kbId } from "../helpers/kettlebell-fixtures";

const mocks = vi.hoisted(() => ({ data: null as unknown, start: vi.fn(), navigate: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => mocks.navigate,
}));
vi.mock("@/lib/supabase-kettlebell.browser", () => ({
  getKettlebellCatalogueClient: vi.fn(async () => mocks.data),
  startKettlebellWorkoutClient: mocks.start,
}));
import { KettlebellWorkoutPicker } from "@/components/kettlebell-workout-picker";
import { getKettlebellCatalogueClient } from "@/lib/supabase-kettlebell.browser";

function data(
  workouts = [
    kbFixture(),
    kbFixture("strength", 2),
    kbFixture("muscle"),
    kbFixture("conditioning"),
  ],
) {
  return {
    personId: kbId(1),
    workouts,
    totalRecords: workouts.length,
    locations: [
      { id: kbId(30), kind: "gym", name: "My gym", isActive: true, equipmentIds: [kbId(40)] },
    ],
    equipmentItems: [
      { id: kbId(40), circuitGroup: "kettlebell", name: "Kettlebells", isActive: true },
    ],
    exercises: [{ id: kbId(10), availableLocationIds: [kbId(30)] }],
    recentIds: [],
  };
}
function show(unfinished = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <KettlebellWorkoutPicker hasUnfinishedWorkout={unfinished} />
    </QueryClientProvider>,
  );
}
async function open() {
  await userEvent.click(screen.getByRole("button", { name: "Pick a kettlebell workout" }));
  await screen.findByRole("combobox", { name: "Kettlebells available" });
  await waitFor(() => expect(screen.getByRole("button", { name: "Pick workout" })).toBeEnabled());
}

describe("kettlebell workout picker", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    mocks.data = data();
    mocks.navigate.mockResolvedValue(undefined);
    vi.spyOn(Math, "random").mockReturnValue(0);
    mocks.start.mockResolvedValue({
      version: 1,
      suggestedWorkoutId: kbId(90),
      title: "Accepted original test",
      locationKind: "gym",
      basis: "Standalone",
      movements: kbFixture().prescription.movements,
      programAssignmentId: null,
      programWorkoutId: null,
    });
    vi.mocked(getKettlebellCatalogueClient).mockImplementation(
      async () => mocks.data as Awaited<ReturnType<typeof getKettlebellCatalogueClient>>,
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it("only loads when opened and clearly reports the pending book batch", async () => {
    mocks.data = data([]);
    show();
    expect(getKettlebellCatalogueClient).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Pick a kettlebell workout" }));
    expect(await screen.findByText(/first batch will contain workouts 1–5/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start this workout" })).not.toBeInTheDocument();
    expect(mocks.start).not.toHaveBeenCalled();
  });
  it("selects in each chosen category and keeps it when swapping", async () => {
    show();
    await open();
    for (const category of ["Muscle", "Conditioning", "Strength"]) {
      await userEvent.click(screen.getByRole("button", { name: category, exact: true }));
      const pick = screen.queryByRole("button", { name: "Pick workout", exact: true });
      if (pick) await userEvent.click(pick);
      const preview = screen.getByRole("region", { name: "Selected kettlebell workout" });
      expect(
        within(preview).getByText(new RegExp(`Original ${category.toLowerCase()} test`)),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: category, exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    }
    await userEvent.click(screen.getByRole("button", { name: "Choose another" }));
    expect(screen.getByText("Original strength test 2")).toBeInTheDocument();
    expect(mocks.start).not.toHaveBeenCalled();
  });
  it("does not repeat offers until shuffle restart and does not save previews or cancellations", async () => {
    mocks.data = data([kbFixture(), kbFixture("strength", 2)]);
    show();
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Pick workout", exact: true }));
    expect(screen.getByText("Original strength test 1")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Choose another" }));
    expect(screen.getByText("Original strength test 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose another" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Restart shuffle" }));
    expect(screen.getByText("Original strength test 1")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel", exact: true }));
    expect(mocks.start).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("workout-plan-draft")).toBeNull();
  });
  it("restores the preview and category across remount without another draw", async () => {
    const view = show();
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Conditioning", exact: true }));
    await userEvent.click(screen.getByRole("button", { name: "Pick workout", exact: true }));
    const before = window.localStorage.getItem(`kettlebell-picker:${kbId(1)}`);
    view.unmount();
    show();
    await userEvent.click(screen.getByRole("button", { name: "Pick a kettlebell workout" }));
    expect(await screen.findByText("Original conditioning test 1")).toBeInTheDocument();
    expect(window.localStorage.getItem(`kettlebell-picker:${kbId(1)}`)).toBe(before);
  });
  it("starts once, hands the accepted standalone session to Log and keeps the same request on retry", async () => {
    show();
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Pick workout", exact: true }));
    mocks.start.mockRejectedValueOnce(new Error("Network interrupted"));
    await userEvent.click(screen.getByRole("button", { name: "Start this workout" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Start this workout" })).toBeEnabled(),
    );
    const request = mocks.start.mock.calls[0][3];
    await userEvent.dblClick(screen.getByRole("button", { name: "Start this workout" }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: "/log" }));
    expect(mocks.start).toHaveBeenCalledTimes(2);
    expect(mocks.start.mock.calls[1][3]).toBe(request);
    const saved = JSON.parse(window.localStorage.getItem("workout-plan-draft") ?? "null");
    expect(saved.programAssignmentId).toBeNull();
    expect(saved.programWorkoutId).toBeNull();
  });
  it("protects an unfinished workout instead of opening another", async () => {
    show(true);
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Pick workout", exact: true }));
    expect(screen.getByRole("button", { name: "Start this workout" })).toBeDisabled();
    expect(mocks.start).not.toHaveBeenCalled();
  });
  it("never silently switches category when the selected pool is empty", async () => {
    mocks.data = data([kbFixture()]);
    show();
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Muscle", exact: true }));
    expect(screen.getByText(/No muscle workouts match/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pick workout", exact: true })).toBeDisabled();
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it("shows EMOM cadence without presenting it as continuous work", async () => {
    const workout = kbFixture("muscle");
    workout.prescription.methodBlocks = [
      {
        trainingMethodId: kbId(80),
        methodName: "EMOM",
        family: "timed_density",
        memberMovementIndexes: [0],
        rounds: "5",
        blockDurationMinutes: "20",
        workIntervalSeconds: "",
        restIntervalSeconds: "",
        restBetweenMovementsSeconds: "",
        restBetweenRoundsSeconds: "",
        config: { mode: "emom", interval_seconds: 60, cycle_length: 4 },
      },
    ];
    mocks.data = data([workout]);
    show();
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Pick workout", exact: true }));
    expect(screen.getByText(/Start every 60 sec/)).toBeInTheDocument();
    expect(screen.queryByText(/60 sec work/)).not.toBeInTheDocument();
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it("shows timed sequence rounds and recovery separately from the total duration", async () => {
    const workout = kbFixture("conditioning");
    workout.prescription.methodBlocks = [
      {
        trainingMethodId: kbId(80),
        methodName: "Timed sequence",
        family: "exercise_group",
        memberMovementIndexes: [0, 1],
        rounds: "2",
        blockDurationMinutes: "20",
        workIntervalSeconds: "",
        restIntervalSeconds: "",
        restBetweenMovementsSeconds: "0",
        restBetweenRoundsSeconds: "120",
        config: { mode: "timed_sequence", round_seconds: 540 },
      },
    ];
    workout.prescription.movements.push(structuredClone(workout.prescription.movements[0]));
    mocks.data = data([workout]);
    show();
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Pick workout", exact: true }));
    expect(
      screen.getByText(/2 rounds · 20 min · 9 min per round · 120 sec between rounds/),
    ).toBeInTheDocument();
    expect(mocks.start).not.toHaveBeenCalled();
  });
});
