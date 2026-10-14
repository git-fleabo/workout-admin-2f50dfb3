import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  personalStrengthAssignment,
  personalStrengthTemplate,
} from "../helpers/personal-strength-fixtures";
const mocks = vi.hoisted(() => ({ clashes: vi.fn(), apply: vi.fn() }));
vi.mock("@/lib/supabase-programme-reschedule.browser", () => ({
  getProgrammeRescheduleClashesClient: mocks.clashes,
  applyProgrammeRescheduleClient: mocks.apply,
}));
import { ProgrammeRescheduleDialog } from "@/components/programme-reschedule-dialog";

function renderDialog(hasDraft = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ProgrammeRescheduleDialog
        assignment={structuredClone(personalStrengthAssignment)}
        template={personalStrengthTemplate}
        lockedWorkoutIds={[]}
        hasDraft={hasDraft}
      />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-14T12:00:00Z"));
  mocks.clashes.mockReset().mockResolvedValue([]);
  mocks.apply
    .mockReset()
    .mockImplementation(
      async (preview) =>
        preview.sessions.filter((session: { locked: boolean }) => !session.locked).length,
    );
});
afterEach(() => vi.useRealTimers());

describe("Reviewed programme date changes", () => {
  it("previews exact dates and clashes, cancels without writes, then applies and reviews Undo", async () => {
    mocks.clashes.mockImplementation(async (preview) => [
      {
        id: "yoga",
        date: preview.newDate,
        workoutId: preview.anchorWorkoutId,
        title: "Yoga class",
      },
    ]);
    renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Plans changed" }));
    expect(await screen.findByText(/Yoga class/)).toBeVisible();
    expect(screen.getByRole("table")).toBeVisible();
    expect(mocks.apply).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Cancel", exact: true }));
    expect(mocks.apply).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Plans changed" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Apply reviewed dates" })).toBeEnabled(),
    );
    await userEvent.click(screen.getByRole("button", { name: "Apply reviewed dates" }));
    await waitFor(() => expect(mocks.apply).toHaveBeenCalledTimes(1));
    expect(mocks.apply.mock.calls[0][2]).toBe(false);
    await userEvent.click(await screen.findByRole("button", { name: "Undo date change" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Restore reviewed dates" })).toBeEnabled(),
    );
    await userEvent.click(screen.getByRole("button", { name: "Restore reviewed dates" }));
    await waitFor(() => expect(mocks.apply).toHaveBeenCalledTimes(2));
    expect(mocks.apply.mock.calls[1][2]).toBe(true);
    expect(mocks.apply.mock.calls[1][0].sessions[0].newDate).toBe(
      mocks.apply.mock.calls[0][0].sessions[0].date,
    );
  });

  it("requires a successful clash read and rechecks after a retry", async () => {
    mocks.clashes.mockRejectedValueOnce(new Error("Clash read failed")).mockResolvedValue([]);
    renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Plans changed" }));
    expect(await screen.findByText("Clash read failed")).toBeVisible();
    expect(screen.getByRole("button", { name: "Apply reviewed dates" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Retry clash check" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Apply reviewed dates" })).toBeEnabled(),
    );
  });

  it("keeps stale-save failures visible and prevents an unchanged retry", async () => {
    mocks.apply.mockRejectedValue(
      new Error("A session changed or started. Reopen the date preview."),
    );
    renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Plans changed" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Apply reviewed dates" })).toBeEnabled(),
    );
    await userEvent.click(screen.getByRole("button", { name: "Apply reviewed dates" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("A session changed or started");
    expect(screen.getByRole("button", { name: "Apply reviewed dates" })).toBeDisabled();
  });

  it("protects an unfinished local workout before opening the date editor", () => {
    renderDialog(true);
    expect(screen.getByRole("button", { name: "Plans changed" })).toBeDisabled();
    expect(mocks.apply).not.toHaveBeenCalled();
  });
});
