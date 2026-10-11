import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExerciseEditorPanel } from "@/routes/library";
import userEvent from "@testing-library/user-event";

describe("exercise editor panel", () => {
  it("edits and restores the training location alongside equipment", async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    const props = {
      onClose: vi.fn(),
      onSubmit: save,
      isPending: false,
      workoutTypes: ["Strength"],
      equipmentItems: [],
    };
    const { rerender } = render(<ExerciseEditorPanel {...props} state={{ mode: "create" }} />);
    await user.type(screen.getByPlaceholderText("Choose default category"), "Strength");
    await user.type(screen.getByPlaceholderText("e.g. Bench Press"), "Ring Dip");
    const location = screen.getByRole("combobox", { name: "Training location", exact: true });
    expect(location).toHaveTextContent("Both (Home + Gym)");
    location.focus();
    await user.keyboard("{ArrowDown}");
    await screen.findByRole("option", { name: "Gym only" });
    await user.keyboard("{End}{Enter}");
    expect(location).toHaveTextContent("Gym only");
    await user.click(screen.getByRole("button", { name: "Create", exact: true }));
    const saved = save.mock.calls[0][0];
    expect(saved.locationScope).toBe("gym");
    rerender(
      <ExerciseEditorPanel
        {...props}
        state={{ mode: "edit", row: { ...saved, id: "dip", row: 0 } }}
      />,
    );
    expect(
      screen.getByRole("combobox", { name: "Training location", exact: true }),
    ).toHaveTextContent("Gym only");
    screen.getByRole("combobox", { name: "Training location", exact: true }).focus();
    await user.keyboard("{ArrowDown}");
    await screen.findByRole("option", { name: "Home only" });
    await user.keyboard("{Home}{ArrowDown}{Enter}");
    await user.click(screen.getByRole("button", { name: "Save", exact: true }));
    expect(save.mock.calls[1][0]).toMatchObject({ locationScope: "home", equipmentItemIds: [] });
    rerender(
      <ExerciseEditorPanel
        {...props}
        state={{ mode: "edit", row: { ...save.mock.calls[1][0], id: "dip", row: 0 } }}
      />,
    );
    expect(
      screen.getByRole("combobox", { name: "Training location", exact: true }),
    ).toHaveTextContent("Home only");
  });
  it("saves extra categories without changing the default or tracking, then restores and removes them", async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    const props = {
      onClose: vi.fn(),
      onSubmit: save,
      isPending: false,
      workoutTypes: ["Conditioning", "Strength"],
      categoryOptions: ["Conditioning", "Strength", "Power"],
      equipmentItems: [],
    };
    const { rerender } = render(<ExerciseEditorPanel {...props} state={{ mode: "create" }} />);
    await user.type(screen.getByPlaceholderText("Choose default category"), "Conditioning");
    await user.type(screen.getByPlaceholderText("e.g. Bench Press"), "Kettlebell Swing");
    await user.click(screen.getByRole("checkbox", { name: "Strength", exact: true }));
    await user.click(screen.getByRole("checkbox", { name: "Power", exact: true }));
    await user.click(screen.getByRole("button", { name: "Create", exact: true }));
    expect(save).toHaveBeenCalledTimes(1);
    const saved = save.mock.calls[0][0];
    expect(saved).toMatchObject({
      workoutType: "Conditioning",
      metric: "weight_reps",
      additionalWorkoutTypes: ["Strength", "Power"],
    });
    rerender(
      <ExerciseEditorPanel
        {...props}
        state={{ mode: "edit", row: { ...saved, id: "swing", row: 0 } }}
      />,
    );
    expect(screen.getByRole("checkbox", { name: "Strength", exact: true })).toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "Power", exact: true }));
    await user.click(screen.getByRole("button", { name: "Save", exact: true }));
    expect(save.mock.calls[1][0]).toMatchObject({
      workoutType: "Conditioning",
      metric: "weight_reps",
      additionalWorkoutTypes: ["Strength"],
    });
  });
  it("renders outside a dialog without requiring Radix dialog context", () => {
    render(
      <ExerciseEditorPanel
        state={{ mode: "new" }}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        isPending={false}
        workoutTypes={["Strength"]}
        equipmentItems={[]}
      />,
    );

    expect(screen.getByRole("heading", { name: "New movement" })).toBeInTheDocument();
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
