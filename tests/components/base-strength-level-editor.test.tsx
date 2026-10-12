import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { buildBaseStrengthPersonalSessions } from "@/lib/base-strength-personal";
import {
  listBaseLevels,
  previewBaseLevels,
  type BaseLevelContext,
} from "@/lib/base-strength-levels";
import { DEFAULT_VOLUME_INTENSITY_OPTIONS } from "@/lib/base-strength-preview";
import { strengthChoices, strengthTemplate } from "../helpers/base-strength-fixtures";
const mocks = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@/lib/supabase-personal-programmes.browser", () => ({
  savePersonalProgrammeSessionsClient: mocks.save,
}));
import { BaseStrengthLevelEditor } from "@/components/base-strength-level-editor";

function renderEditor() {
  const template = strengthTemplate("volume_intensity");
  const choices = strengthChoices("volume_intensity");
  choices["accessory:Row:2"].exerciseName = "Kettlebell Clean & Press";
  choices["accessory:Row:2"].load = null;
  const sessions = buildBaseStrengthPersonalSessions({
    programme: "volume_intensity",
    template,
    options: DEFAULT_VOLUME_INTENSITY_OPTIONS,
    choices,
    startedOn: "2026-10-12",
    increment: 2.5,
    locationKind: "gym",
  });
  sessions.forEach((session) => {
    session.revision = 1;
  });
  const context: BaseLevelContext = {
    template,
    lockedWorkoutIds: [sessions[1].workoutId],
    assignment: {
      id: "assignment",
      status: "active",
      currentWorkoutIndex: 0,
      personalProgramme: { name: "My Volume/Intensity", sessions },
    } as BaseLevelContext["assignment"],
  };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  render(
    <QueryClientProvider client={queryClient}>
      <BaseStrengthLevelEditor {...context} />
    </QueryClientProvider>,
  );
  return { context, invalidate };
}

beforeEach(() => {
  mocks.save.mockReset().mockResolvedValue(1);
});

it("offers the main control, previews preserved percentages and saves only after explicit approval", async () => {
  const { context, invalidate } = renderEditor();
  const baseline = JSON.stringify(context);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Edit base levels" }));
  const level = listBaseLevels(context).find(
    (level) => level.role === "main" && level.phase === "base",
  )!;
  const input = screen.getByLabelText(`${level.exercise} base main estimated max (kg)`);
  await user.clear(input);
  await user.type(input, "120");
  await user.click(screen.getByRole("button", { name: "Preview changes" }));
  const expected = previewBaseLevels(context, { [level.key]: "120" });
  expect(screen.getByText(`${expected.updates.length} future sessions will change.`)).toBeVisible();
  expect(screen.getAllByText(/% ·/).length).toBeGreaterThan(1);
  expect(mocks.save).not.toHaveBeenCalled();
  await user.click(
    screen.getByRole("button", { name: `Apply to ${expected.updates.length} future sessions` }),
  );
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith("assignment", expected.updates));
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["programme-workout-offers"] });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(JSON.stringify(context)).toBe(baseline);
});

it("fills a supporting load across future base sessions and allows cancellation without saving", async () => {
  const { context } = renderEditor();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Edit base levels" }));
  await user.type(
    screen.getByLabelText("Kettlebell Clean & Press base supporting load (kg)"),
    "16",
  );
  await user.click(screen.getByRole("button", { name: "Preview changes" }));
  expect(screen.getAllByText("not set → 16 kg").length).toBeGreaterThan(0);
  await user.click(screen.getByRole("button", { name: "Back to levels" }));
  expect(screen.getByLabelText("Kettlebell Clean & Press base supporting load (kg)")).toHaveValue(
    16,
  );
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(mocks.save).not.toHaveBeenCalled();
  expect(
    context.assignment.personalProgramme!.sessions[0].plan.movements[2].setRows[0].weight,
  ).toBe("");
});

it("rejects invalid maxes and reports a failed atomic save without claiming success", async () => {
  const { context } = renderEditor();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Edit base levels" }));
  const level = listBaseLevels(context).find((level) => level.kind === "max")!;
  const input = screen.getByLabelText(
    `${level.exercise} ${level.phase} ${level.role} estimated max (kg)`,
  );
  await user.clear(input);
  await user.type(input, "0");
  await user.click(screen.getByRole("button", { name: "Preview changes" }));
  expect(screen.getByRole("alert")).toHaveTextContent("positive estimated max");
  expect(mocks.save).not.toHaveBeenCalled();
  await user.clear(input);
  await user.type(input, "120");
  await user.click(screen.getByRole("button", { name: "Preview changes" }));
  mocks.save.mockRejectedValueOnce(
    new Error("This programme changed elsewhere. Refresh before saving."),
  );
  await user.click(screen.getByRole("button", { name: /Apply to \d+ future sessions/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent("programme changed elsewhere");
  expect(screen.getByRole("dialog")).toBeVisible();
  expect(screen.getByRole("button", { name: /Apply to \d+ future sessions/ })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Close editor" })).toBeEnabled();
});
