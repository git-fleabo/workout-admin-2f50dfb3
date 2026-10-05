import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TrainingContextCard } from "@/components/training-context-card";
import type { WeeklyPlan } from "@/lib/weekly-plan";

const plan: WeeklyPlan = {
  startDate: "2026-10-05",
  endDate: "2026-10-11",
  days: [
    {
      date: "2026-10-05",
      expected: [],
      completed: [],
      inferredItems: [],
      completedItems: [],
    },
    ...["06", "07", "08", "09", "10", "11"].map((day) => ({
      date: `2026-10-${day}`,
      expected: [],
      completed: [],
      inferredItems: [],
      completedItems: [],
    })),
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

describe("training context card", () => {
  it("shows a read-only cross-domain weekly interpretation", () => {
    render(
      <TrainingContextCard
        plan={plan}
        adjustments={{}}
        programmeSessions={[
          {
            assignmentId: "assignment-1",
            programWorkoutId: "workout-1",
            programmeName: "Strength block",
            workoutName: "Session A",
            date: "2026-10-05",
            scheduledDate: "2026-10-05",
            isCatchUp: false,
            weekNumber: 1,
            sessionNumber: 1,
            workoutNumber: 1,
            movementNames: ["Squat"],
            movements: [],
            selectionNotes: [],
            status: "current",
          },
        ]}
        scheduledPlans={[
          {
            version: 1,
            suggestedWorkoutId: "skill-1",
            title: "Handstand practice",
            locationKind: "home",
            basis: "Goal support",
            movements: [],
            readiness: "normal",
            status: "pending",
            createdAt: "2026-10-05",
            programAssignmentId: "assignment-1",
            programWorkoutId: null,
            goalId: "goal-1",
            suggestedFor: "2026-10-05",
            planKind: "skill",
          },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Training context" })).toBeInTheDocument();
    expect(screen.getByText("Read only")).toBeInTheDocument();
    expect(screen.getByText(/Strength 1/)).toBeInTheDocument();
    expect(screen.getByText(/Skill 1/)).toBeInTheDocument();
    expect(screen.getByText(/Skill practice is attached to strength days/)).toBeInTheDocument();
  });
});
