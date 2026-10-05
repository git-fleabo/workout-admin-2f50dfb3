import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TrainingContextCard } from "@/components/training-context-card";
import { WeeklyCoachRecommendationCard } from "@/components/weekly-coach-recommendation-card";
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

  it("opens an editable coach setup without changing the weekly plan", () => {
    render(
      <TrainingContextCard
        plan={plan}
        adjustments={{}}
        programmeSessions={[]}
        scheduledPlans={[]}
        focusOptions={[
          {
            id: "programme",
            label: "Current strength programme",
            description: "Current plan",
          },
          { id: "goal:1", label: "Handstand", description: "Active goal" },
        ]}
        onSavePreferences={async () => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Set priorities" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Coach setup" })).toBeInTheDocument();
    expect(screen.getByText("Build alongside it")).toBeInTheDocument();
    expect(screen.getByLabelText("Minutes available")).toHaveValue(300);
  });

  it("offers one reviewed move and records rejection without applying it", async () => {
    const onDecision = vi.fn(async () => undefined);
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
            suggestedWorkoutId: "climb-1",
            title: "Climbing session",
            locationKind: "gym",
            basis: "Planned climbing",
            movements: [],
            readiness: "normal",
            status: "pending",
            createdAt: "2026-10-05",
            programAssignmentId: null,
            programWorkoutId: null,
            goalId: null,
            suggestedFor: "2026-10-05",
            planKind: "climbing",
          },
        ]}
        coachingPreferences={{
          primaryFocusId: "programme",
          secondaryFocusIds: [],
          maintenanceFocusIds: [],
          weeklyTrainingDays: 4,
          weeklyMinutes: 300,
          maxDemandingDays: 3,
          saved: true,
        }}
        onRecommendationDecision={onDecision}
      />,
    );

    expect(screen.getByText("Coach suggestion")).toBeInTheDocument();
    expect(screen.getByText(/Move Climbing session to Tuesday/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Not this week" }));
    await waitFor(() =>
      expect(onDecision).toHaveBeenCalledWith(expect.any(Object), "rejected", undefined),
    );
  });

  it("requires review before skipping a maintenance support session", async () => {
    const onDecision = vi.fn(async () => undefined);
    render(
      <WeeklyCoachRecommendationCard
        recommendation={{
          key: "skip-support:support-1:2026-10-09",
          type: "skip_support_session",
          suggestedWorkoutId: "support-1",
          subjectFocusId: "goal:maintenance",
          sessionLabel: "Handstand maintenance",
          fromDate: "2026-10-09",
          proposedDate: "2026-10-09",
          title: "Skip Handstand maintenance this week",
          rationale: "The week exceeds the saved training-day limit.",
          learningNote: "You declined 1 similar reduction.",
        }}
        pending={false}
        onDecision={onDecision}
      />,
    );

    expect(screen.queryByLabelText("Move to")).not.toBeInTheDocument();
    expect(screen.getByText(/Learned from your reviews/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Skip this session" }));
    await waitFor(() => expect(onDecision).toHaveBeenCalledWith("accepted", undefined));
  });
});
