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
  expect(screen.getByText(/30 steps/)).toBeVisible();
  await userEvent.click(screen.getByText("Full workout prescription"));
  expect(details).toHaveAttribute("open");
  const notes = screen.getByText("Step-by-step notes").closest("details")!;
  expect(notes).not.toHaveAttribute("open");
  expect(details.querySelectorAll("tbody tr")).toHaveLength(30);
  await userEvent.click(screen.getByText("Step-by-step notes"));
  expect(notes.querySelectorAll("li")).toHaveLength(2);
  expect(screen.getByText("Set 1: 1 rep")).toBeVisible();
  expect(screen.getByText("The preserved instructions.")).toBeVisible();
  expect(JSON.stringify(movements)).toBe(original);
});

it("shows a changing ladder compactly and avoids duplicating reason and detail", async () => {
  const lift = kbFixture().prescription.movements[0];
  const movements = Array.from({ length: 10 }, (_, index) => {
    const first = structuredClone(lift);
    const second = structuredClone(lift);
    first.exercise = "Swing";
    second.exercise = "Squat";
    first.setRows = first.setRows.slice(0, 1);
    second.setRows = second.setRows.slice(0, 1);
    first.setRows[0].reps = "10";
    second.setRows[0].reps = String(10 - index);
    for (const movement of [first, second]) {
      movement.targets.detail = `Rung ${10 - index}. Change sides after the pair.`;
      movement.reason = `${movement.setRows[0].reps} reps. ${movement.targets.detail}`;
    }
    return [first, second];
  }).flat();
  render(
    <WorkoutPrescriptionPreview
      movements={movements}
      methodBlocks={[]}
      instructions="Keep swings at ten; descend squats from ten to one."
    />,
  );
  await userEvent.click(screen.getByText("Full workout prescription"));
  const table = screen.getByRole("table", { name: "Ordered workout targets" });
  expect(table.querySelectorAll("tbody tr")).toHaveLength(10);
  const rows = table.querySelectorAll("tbody tr");
  expect([...rows[0].children].map((cell) => cell.textContent)).toEqual([
    "1–2",
    "10 reps",
    "10 reps",
  ]);
  expect([...rows[9].children].map((cell) => cell.textContent)).toEqual([
    "19–20",
    "10 reps",
    "1 rep",
  ]);
  screen.getAllByText(movements[0].reason).forEach((note) => expect(note).not.toBeVisible());
  await userEvent.click(screen.getByText("Step-by-step notes"));
  screen.getAllByText(movements[0].reason).forEach((note) => expect(note).toBeVisible());
  expect(screen.queryByText(movements[0].targets.detail)).toBeNull();
});
