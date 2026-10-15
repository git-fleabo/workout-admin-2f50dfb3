import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import {
  personalStrengthAssignment,
  personalStrengthTemplate,
} from "../helpers/personal-strength-fixtures";
import { buildBaseStrengthPersonalSessions } from "@/lib/base-strength-personal";
import { DEFAULT_VOLUME_INTENSITY_OPTIONS } from "@/lib/base-strength-preview";
import { listBaseLevels } from "@/lib/base-strength-levels";
import { strengthChoices, strengthTemplate } from "../helpers/base-strength-fixtures";

const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  latest: vi.fn(),
  personal: vi.fn(),
  native: vi.fn(),
  history: vi.fn(),
  load: vi.fn(),
  library: vi.fn(),
  save: vi.fn(),
  sourceRpc: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    search,
  }: {
    children: ReactNode;
    to: string;
    search?: Record<string, string>;
  }) => <a href={to + (search ? `?${new URLSearchParams(search)}` : "")}>{children}</a>,
}));
vi.mock("@/lib/supabase-programmes.browser", () => ({
  getActiveProgrammeRefreshContextClient: mocks.context,
}));
vi.mock("@/lib/supabase-programme-strength-review.browser", () => ({
  getLatestProgrammeStrengthWeekReviewClient: mocks.latest,
  applyPersonalStrengthWeekReviewClient: mocks.personal,
  applyProgrammeStrengthWeekReviewClient: mocks.native,
}));
vi.mock("@/lib/supabase-log.browser", () => ({
  getRecentLogsClient: mocks.history,
  getLibraryClient: mocks.library,
}));
vi.mock("@/lib/supabase-weekly-load.browser", () => ({ getWeeklyLoadHistoryClient: mocks.load }));
vi.mock("@/lib/supabase-personal-programmes.browser", () => ({
  savePersonalProgrammeSessionsClient: mocks.save,
}));
vi.mock("@/lib/supabase-public", () => ({
  getSupabaseSession: () => ({ user: { id: "account" } }),
  supabasePublicRpc: mocks.sourceRpc,
}));
import { WeeklyProgrammeReview } from "@/components/weekly-programme-review";

const context = () => ({
  assignment: structuredClone(personalStrengthAssignment),
  template: structuredClone(personalStrengthTemplate),
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));
  mocks.context.mockResolvedValue(context());
  mocks.latest.mockResolvedValue(null);
  mocks.history.mockResolvedValue({ recent: [] });
  mocks.load.mockResolvedValue([]);
  mocks.library.mockResolvedValue({ exercises: [] });
  mocks.personal.mockResolvedValue("approved");
  mocks.native.mockResolvedValue("approved");
  mocks.save.mockResolvedValue(1);
});
afterEach(() => vi.useRealTimers());
function renderReview(current = true, onCurrentWeek = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  return {
    client,
    invalidate,
    ...render(
      <QueryClientProvider client={client}>
        <WeeklyProgrammeReview current={current} onCurrentWeek={onCurrentWeek} />
      </QueryClientProvider>,
    ),
  };
}

it("opens the personal prescription without writing and applies only the approved review", async () => {
  const { invalidate } = renderReview();
  await userEvent.click(await screen.findByRole("button", { name: "Review exact week" }));
  expect(mocks.personal).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toHaveTextContent("Saved:");
  expect(screen.getByRole("dialog")).toHaveTextContent("Reviewed:");
  expect(screen.queryByRole("button", { name: "Adjust manually" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Apply reviewed week" }));
  await waitFor(() => expect(mocks.personal).toHaveBeenCalledTimes(1));
  expect(mocks.personal.mock.calls[0]).toMatchObject([
    personalStrengthAssignment.id,
    { isPersonal: true, expectedCurrentWorkoutIndex: 0 },
    "normal",
  ]);
  expect(mocks.native).not.toHaveBeenCalled();
  expect(mocks.context.mock.calls.length).toBeGreaterThan(1);
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["programme-workout-offers"] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["weekly-review"] });
});

it("cancel and Escape preserve prescriptions and return focus", async () => {
  renderReview();
  const trigger = await screen.findByRole("button", { name: "Review exact week" });
  await userEvent.click(trigger);
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(trigger).toHaveFocus();
  await userEvent.click(trigger);
  await userEvent.keyboard("{Escape}");
  expect(trigger).toHaveFocus();
  expect(mocks.personal).not.toHaveBeenCalled();
  expect(mocks.save).not.toHaveBeenCalled();
});

it("rejects a changed programme at approval instead of saving the old preview", async () => {
  renderReview();
  await userEvent.click(await screen.findByRole("button", { name: "Review exact week" }));
  const changed = context();
  changed.assignment.currentWorkoutIndex = 1;
  mocks.context.mockResolvedValue(changed);
  await userEvent.click(screen.getByRole("button", { name: "Apply reviewed week" }));
  await screen.findByText(/programme or its review changed since this preview/);
  expect(mocks.personal).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Apply reviewed week" })).toBeDisabled(),
  );
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await userEvent.click(screen.getByRole("button", { name: "Review exact week" }));
  expect(
    screen.queryByText(/programme or its review changed since this preview/),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Apply reviewed week" })).toBeEnabled();
});

it("does not load current programme controls while inspecting a past review", async () => {
  const current = vi.fn();
  renderReview(false, current);
  await userEvent.click(screen.getByRole("button", { name: "Review current programme" }));
  expect(current).toHaveBeenCalledOnce();
  expect(mocks.context).not.toHaveBeenCalled();
  expect(mocks.history).not.toHaveBeenCalled();
});

it("offers a programme choice when no active assignment exists", async () => {
  mocks.context.mockResolvedValue(null);
  renderReview();
  await screen.findByText(/No active programme to adjust/);
  expect(screen.getByRole("link", { name: "Choose a programme" })).toHaveAttribute(
    "href",
    "/programmes",
  );
  expect(mocks.latest).not.toHaveBeenCalled();
});

it("blocks previews until evidence loads and supports a failed evidence retry", async () => {
  mocks.history.mockRejectedValueOnce(new Error("Offline"));
  renderReview();
  await screen.findByText(/Couldn’t load the programme’s current evidence/);
  expect(screen.queryByRole("button", { name: "Review exact week" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Retry programme evidence" }));
  expect(await screen.findByRole("button", { name: "Review exact week" })).toBeInTheDocument();
});

it("does not assume there is no prior approval when its read failed", async () => {
  mocks.latest.mockRejectedValueOnce(new Error("Offline"));
  renderReview();
  await screen.findByText(/Couldn’t load the programme’s current evidence/);
  expect(screen.queryByRole("button", { name: "Review exact week" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Retry programme evidence" }));
  await screen.findByRole("button", { name: "Review exact week" });
});

it("uses saved Plan choices for the same account and current week", async () => {
  localStorage.setItem(
    "weekly-plan-adjustments:account:2026-10-15",
    JSON.stringify({
      "2026-10-15": ["gym", "climb"],
      "2026-10-16": ["gym"],
      "2026-10-17": ["gym"],
    }),
  );
  renderReview();
  await userEvent.click(await screen.findByRole("button", { name: "Review exact week" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("Planned week: 4 load points across 3 days");
  expect(mocks.personal).not.toHaveBeenCalled();
});

it("exposes the existing source-programme preview and approval without recovery overrides", async () => {
  const base = context();
  const template = strengthTemplate("volume_intensity");
  const sessions = buildBaseStrengthPersonalSessions({
    programme: "volume_intensity",
    template,
    choices: strengthChoices("volume_intensity"),
    options: DEFAULT_VOLUME_INTENSITY_OPTIONS,
    startedOn: "2026-10-12",
    increment: 2.5,
    locationKind: "gym",
  });
  base.assignment.programId = template.id;
  base.template = template;
  base.assignment.personalProgramme = { name: "My Volume/Intensity", sessions };
  mocks.context.mockResolvedValue(base);
  renderReview();
  await userEvent.click(await screen.findByRole("button", { name: "Edit base levels" }));
  const levels = listBaseLevels({ ...base, lockedWorkoutIds: [] });
  const level = levels.find((item) => item.role === "main" && item.phase === "base")!;
  const field = screen.getByLabelText(`${level.exercise} base main estimated max (kg)`);
  await userEvent.clear(field);
  await userEvent.type(field, "120");
  await userEvent.click(screen.getByRole("button", { name: "Preview changes" }));
  expect(mocks.save).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toHaveTextContent("future sessions will change");
  await userEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: /Apply to \d+ future sessions/,
    }),
  );
  await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
  expect(mocks.personal).not.toHaveBeenCalled();
  expect(mocks.history).not.toHaveBeenCalled();
});

it("keeps Bullmastiff progression as a separate evidence review and fingerprinted approval", async () => {
  const base = context();
  const template = strengthTemplate("bullmastiff");
  const sessions = buildBaseStrengthPersonalSessions({
    programme: "bullmastiff",
    template,
    choices: strengthChoices("bullmastiff"),
    options: DEFAULT_VOLUME_INTENSITY_OPTIONS,
    startedOn: "2026-10-12",
    increment: 2.5,
    locationKind: "gym",
  });
  const session = sessions.find((item) =>
    item.plan.movements.some((m) => m.baseStrength?.role === "main" && m.baseStrength.week > 1),
  )!;
  base.template = template;
  base.assignment.programId = template.id;
  base.assignment.currentWorkoutIndex = template.workouts.find(
    (w) => w.id === session.workoutId,
  )!.sequenceIndex;
  base.assignment.personalProgramme = { name: "My Bullmastiff", sessions };
  mocks.context.mockResolvedValue(base);
  mocks.sourceRpc.mockImplementation(async (name: string) =>
    name === "review_base_strength_progression"
      ? {
          kind: "increase",
          load: 110,
          detail: "Based on the linked completed plus set.",
          fingerprint: "source-evidence",
          revision: session.revision,
        }
      : 1,
  );
  renderReview();
  await userEvent.click(
    (await screen.findAllByRole("button", { name: "Review completed plus set" }))[0],
  );
  await screen.findByText("Next working load: 110 kg");
  expect(
    mocks.sourceRpc.mock.calls.some(([name]) => name === "apply_base_strength_progression"),
  ).toBe(false);
  await userEvent.click(screen.getByRole("button", { name: "Apply to this session" }));
  await waitFor(() =>
    expect(mocks.sourceRpc).toHaveBeenCalledWith(
      "apply_base_strength_progression",
      expect.objectContaining({
        p_assignment_id: base.assignment.id,
        p_workout_id: session.workoutId,
        p_fingerprint: "source-evidence",
        p_revision: session.revision,
      }),
    ),
  );
  expect(mocks.personal).not.toHaveBeenCalled();
});
