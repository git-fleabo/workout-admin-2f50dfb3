import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
const mocks = vi.hoisted(() => ({ overview: vi.fn(), activate: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
vi.mock("@/lib/supabase-programmes.browser", () => ({
  getMyProgrammeOverviewClient: mocks.overview,
  setProgrammeAssignmentStatusClient: mocks.activate,
  changeProgrammeRunClient: vi.fn(),
  chooseNextProgrammeSessionClient: vi.fn(),
}));
vi.mock("@/components/personal-programme-editor", () => ({
  PersonalProgrammeEditor: ({
    assignment,
    lockedWorkoutIds,
  }: {
    assignment: { id: string };
    lockedWorkoutIds: string[];
  }) => (
    <div>
      Editor for {assignment.id}, locked {lockedWorkoutIds.length}
    </div>
  ),
}));
import { MyProgrammeOverview } from "@/components/my-programme-overview";
const source = {
  id: "source",
  name: "Starting model",
  sessionsPerWeek: 2,
  workouts: [
    { id: "w1", name: "Original A", sequenceIndex: 0, weekNumber: 1 },
    { id: "w2", name: "Original B", sequenceIndex: 1, weekNumber: 1 },
  ],
};
const current = {
  id: "current",
  programId: "source",
  status: "active",
  currentWorkoutIndex: 0,
  startedOn: "2026-10-05",
  cycleNumber: 1,
};
const draft = {
  ...current,
  id: "draft",
  status: "paused",
  personalProgramme: {
    name: "My draft",
    sessions: [
      { workoutId: "w1", name: "My A" },
      { workoutId: "w2", name: "My B" },
    ],
  },
};
const renderOverview = (initialAssignmentId?: string) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MyProgrammeOverview initialAssignmentId={initialAssignmentId} />
    </QueryClientProvider>,
  );
describe("planning a personal version alongside a current run", () => {
  it("opens a draft for editing without pausing or changing the current programme", async () => {
    mocks.overview.mockImplementation(async (selected?: string) => ({
      assignments: [current, draft],
      templates: [source],
      skippedWorkoutIds: [],
      lockedWorkoutIds: selected === "draft" ? [] : ["w1"],
    }));
    renderOverview("draft");
    expect(await screen.findByText("Editor for draft, locked 0")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start programme" })).toBeDisabled();
    expect(screen.getByText(/Pause or end your current programme/)).toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Back to current programme" }));
    await waitFor(() =>
      expect(screen.queryByText("Editor for draft, locked 0")).not.toBeInTheDocument(),
    );
    expect(mocks.activate).not.toHaveBeenCalled();
  });
  it("lets a prepared draft be activated explicitly when no other run is active", async () => {
    mocks.activate.mockReset();
    mocks.activate.mockResolvedValue(draft);
    mocks.overview.mockResolvedValue({
      assignments: [draft],
      templates: [source],
      skippedWorkoutIds: [],
      lockedWorkoutIds: [],
    });
    renderOverview();
    expect(await screen.findByText("Editor for draft, locked 0")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Start programme" }));
    await waitFor(() => expect(mocks.activate).toHaveBeenCalledWith("draft", "active"));
  });
});
