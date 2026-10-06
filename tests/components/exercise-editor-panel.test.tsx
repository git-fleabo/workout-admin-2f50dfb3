import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExerciseEditorPanel } from "@/routes/library";

describe("exercise editor panel", () => {
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
