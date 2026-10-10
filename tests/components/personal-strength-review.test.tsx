import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ProgrammeRefreshCard } from "@/components/programme-refresh-card";
import {
  personalStrengthAssignment as assignment,
  personalStrengthTemplate as template,
  personalStrengthRecovery as recovery,
} from "../helpers/personal-strength-fixtures";

it("previews editable personal reductions and applies only after approval", async () => {
  const onApply = vi.fn(async () => undefined);
  const user = userEvent.setup();
  render(
    <ProgrammeRefreshCard
      assignment={assignment}
      template={template}
      recovery={recovery}
      appliedReview={null}
      saving={false}
      onSave={async () => undefined}
      onApplyReview={onApply}
    />,
  );
  expect(screen.queryByRole("button", { name: "Adjust manually" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Review exact week" }));
  expect(onApply).not.toHaveBeenCalled();
  expect(screen.getAllByText(/Set 1: 8 reps @ 19.57 kg/)).toHaveLength(3);
  expect(screen.getAllByText(/1 × 10 sec/)).toHaveLength(3);
  expect(screen.getByText("12 Oct 2026")).toBeInTheDocument();
  expect(screen.queryByText(/0 kg training max/)).not.toBeInTheDocument();
  const controls = screen.getAllByRole("combobox");
  controls[0].focus();
  await user.keyboard("{Enter}{ArrowDown}{ArrowDown}{Enter}");
  expect(screen.getAllByText(/Reviewed: Set 1: 8 reps @ 20.6 kg/)).toHaveLength(3);
  expect(onApply).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Apply reviewed week" }));
  await waitFor(() => expect(onApply).toHaveBeenCalledOnce());
  expect(onApply.mock.calls[0][0]).toMatchObject({
    isPersonal: true,
    expectedCurrentWorkoutIndex: 0,
    exercises: [
      { proposedManualAdjustmentPercent: 0, proposedSetAdjustment: -1 },
      { proposedManualAdjustmentPercent: 0, proposedSetAdjustment: -1 },
    ],
  });
});
it("closing a personal review saves nothing", async () => {
  const onApply = vi.fn(async () => undefined);
  const user = userEvent.setup();
  render(
    <ProgrammeRefreshCard
      assignment={assignment}
      template={template}
      recovery={recovery}
      appliedReview={null}
      saving={false}
      onSave={async () => undefined}
      onApplyReview={onApply}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Review exact week" }));
  await user.keyboard("{Escape}");
  expect(onApply).not.toHaveBeenCalled();
});
