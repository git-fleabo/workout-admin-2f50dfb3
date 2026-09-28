import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import type { ProgrammeScheduleSession } from "@/lib/supabase-programmes.browser";
import type { WeeklyPlan } from "@/lib/weekly-plan";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

import { WeeklyPlanOverview } from "@/components/weekly-plan-overview";

const plan: WeeklyPlan = {
  startDate: "2026-09-28",
  endDate: "2026-10-04",
  days: [
    {
      date: "2026-09-28",
      expected: [],
      completed: [],
      inferredItems: ["gym"],
      completedItems: [],
    },
  ],
  locations: {
    home: {
      location: "home",
      frequency: 0,
      confidence: "none",
      sourceDays: 0,
      expectedDates: [],
      suggestion: null,
      progressionExercises: [],
      fatigueExercises: [],
    },
    gym: {
      location: "gym",
      frequency: 0,
      confidence: "none",
      sourceDays: 0,
      expectedDates: [],
      suggestion: null,
      progressionExercises: [],
      fatigueExercises: [],
    },
  },
  loadPatterns: [],
};

const currentSession: ProgrammeScheduleSession = {
  assignmentId: "assignment-1",
  programWorkoutId: "workout-1",
  programmeName: "Base Strength",
  workoutName: "Session A",
  date: "2026-09-28",
  scheduledDate: "2026-09-26",
  isCatchUp: true,
  weekNumber: 1,
  sessionNumber: 1,
  workoutNumber: 1,
  movementNames: ["Bench Press"],
  movements: [],
  selectionNotes: [],
  status: "current",
};

it("puts the next session first and keeps the calendar optional", async () => {
  render(
    <WeeklyPlanOverview
      plan={plan}
      programmeSessions={[currentSession]}
      adjustments={{}}
      onAdjustDay={vi.fn()}
    />,
  );

  expect(screen.getByRole("button", { name: /Next programme session/ })).toHaveTextContent(
    "Base Strength · Session A",
  );
  const disclosure = screen.getByText("Show suggested dates and other training").closest("details");
  expect(disclosure).not.toHaveAttribute("open");

  await userEvent.click(screen.getByText("Show suggested dates and other training"));
  expect(disclosure).toHaveAttribute("open");
  expect(screen.getByText("Bench Press")).toBeVisible();
});
