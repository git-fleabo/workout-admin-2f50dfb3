import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { SessionDurationField } from "@/components/session-duration-field";

it("gives each brief a unique labelled duration field and retains its original bounds", async () => {
  render(
    <>
      <SessionDurationField value={60} min={30} max={90} onChange={() => {}} />
      <SessionDurationField value={20} min={10} max={45} label="Duration" onChange={() => {}} />
      <SessionDurationField
        value={40}
        min={20}
        max={60}
        description="Includes the warm-up."
        onChange={() => {}}
      />
    </>,
  );
  const fields = screen.getAllByRole("spinbutton");
  expect(new Set(fields.map((field) => field.id)).size).toBe(3);
  expect(fields[0]).toHaveAccessibleName("Total duration (minutes)");
  expect(fields[1]).toHaveAccessibleName("Duration (minutes)");
  expect(fields[2]).toHaveAccessibleName("Total duration (minutes)");
  expect(fields[2]).toHaveAccessibleDescription("Includes the warm-up.");
  [
    [30, 90],
    [10, 45],
    [20, 60],
  ].forEach(([min, max], index) => {
    expect(fields[index]).toHaveAttribute("min", String(min));
    expect(fields[index]).toHaveAttribute("max", String(max));
  });
  const label = document.querySelector(`label[for="${fields[0].id}"]`)!;
  await userEvent.click(label);
  expect(fields[0]).toHaveFocus();
});
