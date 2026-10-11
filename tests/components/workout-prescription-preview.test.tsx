import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { WorkoutPrescriptionPreview } from "@/components/workout-prescription-preview";
import { kbFixture } from "../helpers/kettlebell-fixtures";
it("keeps start ahead of the disclosure, groups exact repetitions and preserves changed targets", async () => {
  const lift = kbFixture().prescription.movements[0];
  const changed = structuredClone(lift);
  changed.setRows = [{ ...changed.setRows[0], reps: "1" }];
  const movements = [...Array.from({ length: 29 }, () => structuredClone(lift)), changed];
  const original = JSON.stringify(movements);
  render(
    <WorkoutPrescriptionPreview
      movements={movements}
      methodBlocks={[]}
      instructions="The preserved instructions."
      actions={<button>Start this workout</button>}
    />,
  );
  const details = screen.getByText("Full workout prescription").closest("details")!;
  expect(details).not.toHaveAttribute("open");
  const start = screen.getByRole("button", { name: "Start this workout" });
  expect(start.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByText(/30 passes/)).toBeVisible();
  await userEvent.click(screen.getByText("Full workout prescription"));
  expect(details).toHaveAttribute("open");
  expect(details.querySelectorAll("li")).toHaveLength(2);
  expect(screen.getByText("Set 1: 1 rep")).toBeVisible();
  expect(screen.getByText("The preserved instructions.")).toBeVisible();
  expect(JSON.stringify(movements)).toBe(original);
});
