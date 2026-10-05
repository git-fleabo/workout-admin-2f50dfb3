import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  archive: vi.fn(async () => ({ ok: true })),
  updateStatus: vi.fn(),
  addGoal: vi.fn(),
  createdGoal: false,
}));

vi.mock("@/lib/supabase-goals.browser", () => ({
  listGoalsClient: vi.fn(async () => ({
    needsProfileClaim: false,
    items: [
      {
        id: "goal-1",
        row: 1,
        goal: "Hold a freestanding handstand",
        goalType: "performance",
        status: "active",
        exerciseId: "exercise-1",
        trackingMode: "hold",
        goalMetric: "hold_seconds",
        targetValue: 30,
        targetUnit: "seconds",
        startingValue: 5,
        deadline: "",
        metric: "",
        target: "",
        period: "year",
        notes: "",
        checkins: [],
      },
      ...(mocks.createdGoal
        ? [
            {
              id: "goal-2",
              row: 2,
              goal: "Hold Handstand for 20 seconds",
              goalType: "performance",
              status: "active",
              exerciseId: "exercise-1",
              trackingMode: "hold",
              goalMetric: "hold_seconds",
              targetValue: 20,
              targetUnit: "seconds",
              startingValue: null,
              deadline: "",
              metric: "seconds",
              target: "20",
              period: "static",
              notes: "",
              checkins: [],
            },
          ]
        : []),
    ],
  })),
  addGoalClient: mocks.addGoal,
}));

vi.mock("@/lib/supabase-programme-support.browser", () => ({
  getProgrammeSkillSupportHistoryClient: vi.fn(async () => ({})),
}));

vi.mock("@/lib/supabase-mobility.browser", () => ({
  listMobilityDataClient: vi.fn(async () => ({
    runs: [],
    drills: [],
    assessments: [],
    sessions: [],
  })),
}));

vi.mock("@/lib/supabase-log.browser", () => ({
  getLibraryClient: vi.fn(async () => ({
    exercises: [
      {
        id: "exercise-1",
        name: "Handstand",
        workoutType: "Skills/Calisthenics",
        metric: "hold",
        suggestedSets: "3-4",
        suggestedReps: "10-30 sec",
        availableLocationKinds: ["home", "gym"],
      },
    ],
  })),
}));

vi.mock("@/lib/supabase-plans.browser", () => ({
  getScheduledWorkoutPlansClient: vi.fn(async () => []),
  saveWorkoutPlanClient: mocks.save,
  archiveProgrammeSupportPlansClient: mocks.archive,
  updateSuggestedWorkoutStatusClient: mocks.updateStatus,
}));

import { ProgrammeSupportPlanner } from "@/components/programme-support-planner";

const sessions = [
  "2026-10-05",
  "2026-10-07",
  "2026-10-09",
  "2026-10-12",
  "2026-10-14",
  "2026-10-16",
  "2026-10-19",
  "2026-10-21",
  "2026-10-23",
  "2026-10-26",
  "2026-10-28",
  "2026-10-30",
].map((scheduledDate, index) => ({
  workoutId: `workout-${index}`,
  revision: 1,
  name: `Strength ${index + 1}`,
  scheduledDate,
  plan: { version: 1, locationKind: "gym", movements: [] },
}));

function renderPlanner() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ProgrammeSupportPlanner
        assignmentId="assignment-1"
        programmeName="My strength block"
        sessions={sessions as never}
      />
    </QueryClientProvider>,
  );
}

describe("programme supporting goals planner", () => {
  beforeEach(() => {
    mocks.createdGoal = false;
    mocks.addGoal.mockReset();
    mocks.save.mockReset();
    mocks.archive.mockClear();
    mocks.updateStatus.mockClear();
  });

  it("previews and saves an editable four-week skill schedule without changing strength sessions", async () => {
    let number = 0;
    mocks.save.mockImplementation(async () => ({ suggestedWorkoutId: `saved-${++number}` }));
    renderPlanner();

    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: "Build supporting goals" }));
    await userEvent
      .setup()
      .click(screen.getByLabelText("Hold a freestanding handstand", { exact: false }));
    expect(screen.getByText("Proposed next four weeks")).toBeInTheDocument();
    expect(screen.getByText("Starting dose")).toBeInTheDocument();
    const saveButton = screen.getByRole("button", { name: "Save 8 supporting sessions" });
    await userEvent.setup().click(saveButton);
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(8));
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        programAssignmentId: "assignment-1",
        goalId: "goal-1",
        planKind: "skill",
        replaceExisting: false,
      }),
    );
    expect(mocks.archive).toHaveBeenCalledWith(
      "assignment-1",
      Array.from({ length: 8 }, (_, index) => `saved-${index + 1}`),
    );
  });

  it("creates and selects a calisthenics goal inside the programme planner", async () => {
    mocks.addGoal.mockImplementation(async () => {
      mocks.createdGoal = true;
      return { ok: true, goalId: "goal-2", row: "Supabase" };
    });
    renderPlanner();

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Build supporting goals" }));
    await user.click(screen.getByRole("button", { name: "Create calisthenics goal" }));
    await user.type(screen.getByLabelText("Target (seconds)"), "20");
    await user.click(screen.getByRole("button", { name: "Create and select goal" }));

    await waitFor(() => expect(mocks.addGoal).toHaveBeenCalledTimes(1));
    expect(mocks.addGoal).toHaveBeenCalledWith(
      expect.objectContaining({
        goal: "Hold Handstand for 20 seconds",
        exerciseId: "exercise-1",
        goalMetric: "hold_seconds",
        targetValue: 20,
      }),
    );
    expect(
      await screen.findByRole("checkbox", { name: /Hold Handstand for 20 seconds/ }),
    ).toBeChecked();
    expect(screen.getByText("Starting dose")).toBeInTheDocument();
  });
});
