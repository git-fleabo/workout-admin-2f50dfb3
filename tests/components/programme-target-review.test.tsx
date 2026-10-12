import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { buildBaseStrengthPersonalSessions } from "@/lib/base-strength-personal";
import { DEFAULT_VOLUME_INTENSITY_OPTIONS } from "@/lib/base-strength-preview";
import { strengthChoices, strengthTemplate } from "../helpers/base-strength-fixtures";

const mocks = vi.hoisted(() => ({ save: vi.fn(async () => {}) }));
vi.mock("@tanstack/react-router", () => ({
  Link: () => null,
  useBlocker: () => ({ status: "idle" }),
}));
vi.mock("@/hooks/use-desktop", () => ({ useIsDesktop: () => false }));
vi.mock("@/lib/supabase-log.browser", () => ({
  getLibraryClient: async () => ({ exercises: [] }),
}));
vi.mock("@/lib/supabase-personal-programmes.browser", () => ({
  savePersonalProgrammeSessionsClient: mocks.save,
}));
vi.mock("@/components/base-strength-progression", () => ({ BaseStrengthProgression: () => null }));
import { PersonalProgrammeEditor } from "@/components/personal-programme-editor";

function renderEditor(locked = false) {
  const template = strengthTemplate("volume_intensity");
  const choices = strengthChoices("volume_intensity");
  choices["accessory:Row:2"].exerciseName = "Kettlebell Clean & Press";
  choices["accessory:Row:2"].load = null;
  const [session] = buildBaseStrengthPersonalSessions({
    programme: "volume_intensity",
    template,
    choices,
    options: DEFAULT_VOLUME_INTENSITY_OPTIONS,
    startedOn: "2026-10-12",
    increment: 2.5,
    locationKind: "gym",
  });
  const assignment = {
    id: "assignment",
    currentWorkoutIndex: 0,
    status: "active",
    personalProgramme: { name: "Volume/Intensity", sessions: [session] },
  } as Parameters<typeof PersonalProgrammeEditor>[0]["assignment"];
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <PersonalProgrammeEditor
        assignment={assignment}
        template={template}
        lockedWorkoutIds={locked ? [session.workoutId] : []}
        initialWorkoutId={session.workoutId}
      />
    </QueryClientProvider>,
  );
  return session;
}

it("opens the linked mobile session, explains the missing load and saves only the chosen session", async () => {
  mocks.save.mockClear();
  const original = renderEditor();
  const user = userEvent.setup();
  await screen.findByRole("dialog");
  expect(screen.getByText("Kettlebell Clean & Press: choose a load for every set.")).toBeVisible();
  for (let i = 1; i <= 3; i++) {
    await user.type(screen.getByLabelText(`Kettlebell Clean & Press set ${i} load`), "16");
  }
  expect(screen.queryByText("Before starting this session")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Save future session" }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
  const [assignmentId, updates] = mocks.save.mock.calls[0] as unknown as [
    string,
    (typeof original)[],
  ];
  expect(assignmentId).toBe("assignment");
  expect(updates).toHaveLength(1);
  expect(updates[0].workoutId).toBe(original.workoutId);
  expect(updates[0].plan.movements[2].setRows.every((set) => set.weight === "16")).toBe(true);
  expect(original.plan.movements[2].setRows.every((set) => set.weight === "")).toBe(true);
});

it("does not open a linked session that has already started or been skipped", async () => {
  renderEditor(true);
  await screen.findByText(/Started or skipped/);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByRole("button", { name: "Edit", exact: true })).toBeNull();
});
