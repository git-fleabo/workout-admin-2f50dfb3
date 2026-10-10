import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { BaseStrengthProgrammePreview } from "@/components/base-strength-programme-preview";

describe("Base Strength review previews", () => {
  it("lets the user compare programmes and phases without assuming maxes or starting a run", async () => {
    const user = userEvent.setup();
    render(<BaseStrengthProgrammePreview />);
    await user.click(screen.getByRole("button", { name: "Preview Volume/Intensity" }));
    expect(screen.getByText("18 weeks · 54 sessions")).toBeInTheDocument();
    expect(screen.getByLabelText("Squat (kg)")).toHaveValue(null);
    await user.type(screen.getByLabelText("Squat (kg)"), "100");
    expect(screen.getByText("55 kg")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Explore a week"), "9");
    expect(screen.getByLabelText("Squat (kg)")).toHaveValue(null);
    expect(screen.getAllByText(/RPE 7/).length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", { name: /activate|start programme/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Make my version" })).toBeInTheDocument();
  });

  it("shows unknown subsequent Bullmastiff weights and does not borrow a main-lift max for a variation", async () => {
    const user = userEvent.setup();
    render(<BaseStrengthProgrammePreview />);
    await user.click(screen.getByRole("button", { name: "Preview Bullmastiff" }));
    await user.type(screen.getByLabelText("Squat (kg)"), "100");
    expect(screen.getByText("70 kg")).toBeInTheDocument();
    expect(screen.queryByText("60 kg")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Front squat estimated 1RM (kg)"), "50");
    expect(screen.getByText("30 kg")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Explore a week"), "1");
    expect(screen.queryByText("70 kg")).not.toBeInTheDocument();
    expect(screen.getAllByText(/Load depends on the previous completed plus set/).length).toBe(4);
  });

  it("calculates an example and clears its performance evidence when changing weeks", async () => {
    const user = userEvent.setup();
    render(<BaseStrengthProgrammePreview />);
    await user.click(screen.getByRole("button", { name: "Preview Bullmastiff" }));
    await user.click(screen.getByText("Try the Bullmastiff plus-set rule"));
    await user.click(screen.getByRole("button", { name: "Try a 100 kg example" }));
    expect(
      within(screen.getByRole("status")).getByText("Next working load: 75 kg"),
    ).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Explore a week"), "2");
    expect(screen.getByLabelText("Final-set reps")).toHaveValue(null);
    expect(screen.getByLabelText("All prescribed working sets completed")).not.toBeChecked();
    expect(within(screen.getByRole("status")).getByText("Review needed")).toBeInTheDocument();
    await user.click(screen.getByLabelText("All prescribed working sets completed"));
    expect(
      within(screen.getByRole("status")).getByText("Next working load: 75 kg"),
    ).toBeInTheDocument();
    expect(within(screen.getByRole("status")).getByText(/Reset at 75%/)).toBeInTheDocument();
  });

  it("requires a reassessed peak max at the phase transition", async () => {
    const user = userEvent.setup();
    render(<BaseStrengthProgrammePreview />);
    await user.click(screen.getByRole("button", { name: "Preview Bullmastiff" }));
    await user.click(screen.getByText("Try the Bullmastiff plus-set rule"));
    await user.click(screen.getByRole("button", { name: "Try a 100 kg example" }));
    await user.selectOptions(screen.getByLabelText("Explore a week"), "8");
    await user.click(screen.getByLabelText("All prescribed working sets completed"));
    expect(
      within(screen.getByRole("status")).getByText(/Reassess and enter a peak-phase/),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText("Reassessed peak-phase estimated 1RM (kg)"), "120");
    expect(
      within(screen.getByRole("status")).getByText("Next working load: 102.5 kg"),
    ).toBeInTheDocument();
  });
});
