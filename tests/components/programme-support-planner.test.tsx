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
  skillHistory: {} as Record<string, unknown[]>,
  blockHistory: [] as Array<Record<string, unknown>>,
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
  getProgrammeSkillSupportHistoryClient: vi.fn(async () => mocks.skillHistory),
  getProgrammeSupportBlockHistoryClient: vi.fn(async () => mocks.blockHistory),
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

function dateOffset(days: number) {
  const date = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

describe("programme supporting goals planner", () => {
  beforeEach(() => {
    mocks.createdGoal = false;
    mocks.skillHistory = {};
    mocks.blockHistory = [];
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

  it("prompts for review after a support block and prefills the next dose", async () => {
    mocks.skillHistory = {
      "goal-1": ["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24"].map((date) => ({
        date,
        plannedSets: 3,
        plannedDose: 10,
        successful: true,
      })),
    };
    mocks.blockHistory = [
      "2026-08-03",
      "2026-08-06",
      "2026-08-10",
      "2026-08-13",
      "2026-08-17",
      "2026-08-20",
      "2026-08-24",
      "2026-08-27",
    ].map((date, index) => ({
      date,
      status: index === 7 ? "skipped" : "completed",
      goalId: "goal-1",
      mobilityRunId: null,
      locationKind: "home",
    }));
    renderPlanner();

    expect(await screen.findByText("Your supporting block is ready to review")).toBeInTheDocument();
    expect(screen.getByText(/7 of 8 planned sessions/)).toBeInTheDocument();
    expect(screen.getByText(/Small increase/)).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: "Review next four weeks" }));
    expect(screen.getByRole("checkbox", { name: /Hold a freestanding handstand/ })).toBeChecked();
    expect(screen.getByLabelText("Seconds per set")).toHaveValue(12);
  });

  it("shows live week, adherence and dose for the active support block", async () => {
    mocks.blockHistory = [0, 3, 7, 10, 14, 17, 21, 24].map((offset, index) => ({
      date: dateOffset(offset),
      status: index === 0 ? "completed" : "pending",
      goalId: "goal-1",
      mobilityRunId: null,
      locationKind: "home",
      plannedSets: 3,
      plannedDose: 10,
      doseUnit: "seconds",
    }));
    renderPlanner();

    expect(await screen.findByText("Supporting block in progress")).toBeInTheDocument();
    expect(screen.getByText("Week 1 of 4")).toBeInTheDocument();
    expect(screen.getByText(/1 of 8 supporting sessions complete/)).toBeInTheDocument();
    expect(screen.getByText(/3 × 10 seconds/)).toBeInTheDocument();
    expect(
      screen.getByText(/Skill progression waits for four successful weeks/),
    ).toBeInTheDocument();
  });
});
