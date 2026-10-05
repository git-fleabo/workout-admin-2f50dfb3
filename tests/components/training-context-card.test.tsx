import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TrainingContextCard } from "@/components/training-context-card";
import { CoachOutcomeReviewCard } from "@/components/coach-outcome-review-card";
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
        strengthReview={<div>Strength week review</div>}
      />,
    );

    expect(screen.getByRole("heading", { name: "Weekly coach review" })).toBeInTheDocument();
    expect(screen.getByText("Read only")).toBeInTheDocument();
    expect(screen.getByText("Exact upcoming week")).toBeInTheDocument();
    expect(screen.getByText("2 saved sessions")).toBeInTheDocument();
    expect(screen.getByText("Strength block · Session A")).toBeInTheDocument();
    expect(screen.getByText("Handstand practice")).toBeInTheDocument();
    expect(screen.getByText("Strength week review")).toBeInTheDocument();
    expect(screen.getByText("1 available")).toBeInTheDocument();
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
        strengthReview={<div>Strength review available</div>}
      />,
    );

    expect(screen.getByText("Coach suggestion")).toBeInTheDocument();
    expect(screen.getByText("Strength review available")).toBeInTheDocument();
    expect(screen.getByText("2 available")).toBeInTheDocument();
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

  it("shows the exact reviewed support dose before applying it", async () => {
    const onDecision = vi.fn(async () => undefined);
    render(
      <WeeklyCoachRecommendationCard
        recommendation={{
          key: "dose:progress:support-1:2026-10-06",
          type: "adjust_support_dose",
          suggestedWorkoutId: "support-1",
          subjectFocusId: "goal:skill",
          sessionLabel: "Handstand practice",
          fromDate: "2026-10-06",
          proposedDate: "2026-10-06",
          title: "Progress Handstand practice",
          rationale: "Four successful weeks support a small increase.",
          learningNote: null,
          adjustment: "progress",
          currentSets: 3,
          currentValue: 5,
          targetSets: 3,
          targetValue: 6,
          doseUnit: "reps",
        }}
        pending={false}
        onDecision={onDecision}
      />,
    );

    expect(screen.getByText("Current").parentElement).toHaveTextContent(
      "Current 3 × 5 repsProposed 3 × 6 reps",
    );
    fireEvent.click(screen.getByRole("button", { name: "Apply dose" }));
    await waitFor(() => expect(onDecision).toHaveBeenCalledWith("accepted", undefined));
  });

  it("shows readiness evidence inside the unified training context", () => {
    render(
      <TrainingContextCard
        plan={plan}
        adjustments={{}}
        programmeSessions={[]}
        scheduledPlans={[]}
        readiness={{
          status: "hold",
          title: "Hold the current dose",
          detail: "Recovery evidence supports keeping support work steady.",
          evidence: ["Pain evidence: no pain score recorded", "Effort evidence: 2 hard days"],
          maxPain: null,
          hardDays: 2,
          effortCoverage: 50,
          supportAdherence: 75,
          supportDue: 4,
          recoveryLevel: "lighter",
        }}
      />,
    );

    expect(screen.getByText("Readiness evidence")).toBeInTheDocument();
    expect(screen.getByText("Hold the current dose")).toBeInTheDocument();
    expect(screen.getByText("Hold")).toBeInTheDocument();
  });

  it("records an unclear completed outcome with one tap", async () => {
    const onReview = vi.fn(async () => undefined);
    render(
      <CoachOutcomeReviewCard
        review={{
          decisionId: "decision-1",
          recommendationType: "adjust_support_dose",
          sessionLabel: "Handstand practice",
          question: "How did this support dose feel?",
          detail: "The completed workout needs your input.",
        }}
        pending={false}
        onReview={onReview}
      />,
    );

    expect(screen.getByText("Coach check-in")).toBeInTheDocument();
    expect(screen.getByText("One tap")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "About right" }));
    await waitFor(() => expect(onReview).toHaveBeenCalledWith("decision-1", "right"));
  });

  it("previews the entire drafted week and saves only after approval", async () => {
    const onApply = vi.fn(async () => undefined);
    const addition = {
      id: "weekly-draft:goal:handstand",
      focusId: "goal:handstand",
      sourceId: "handstand",
      kind: "skill" as const,
      title: "Handstand",
      defaultPlacement: "with_strength" as const,
      draft: {
        version: 1 as const,
        title: "Handstand practice",
        locationKind: "home" as const,
        basis: "Supporting practice",
        movements: [
          {
            exercise: "Wall handstand",
            workoutType: "Skills/Calisthenics",
            trackingMode: "hold" as const,
            targets: {
              durationMinutes: "",
              distance: "",
              distanceUnit: "",
              rounds: "",
              height: "",
              detail: "Goal: 30 seconds",
            },
            sourceDate: "",
            reason: "Skill practice",
            setRows: Array.from({ length: 3 }, () => ({
              reps: "",
              weight: "",
              durationSeconds: "10",
              rpe: "",
              completed: true,
            })),
          },
        ],
      },
      planKind: "skill" as const,
      goalId: "handstand",
      mobilityRunId: null,
      programAssignmentId: "assignment-1",
      date: "2026-10-05",
      priority: "supporting" as const,
      reason: "Placed beside a saved strength session.",
      pairedWithStrength: true,
    };

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
        scheduledPlans={[]}
        coachingPreferences={{
          primaryFocusId: "programme",
          secondaryFocusIds: ["goal:handstand"],
          maintenanceFocusIds: [],
          weeklyTrainingDays: 4,
          weeklyMinutes: 300,
          maxDemandingDays: 3,
          saved: true,
        }}
        focusOptions={[
          {
            id: "programme",
            label: "Current strength programme",
            description: "Current plan",
          },
          { id: "goal:handstand", label: "Handstand", description: "Active goal" },
        ]}
        weekDraft={{
          startDate: "2026-10-05",
          endDate: "2026-10-11",
          today: "2026-10-05",
          weeklyTrainingDays: 4,
          existingDates: ["2026-10-05"],
          weekDates: plan.days.map((day) => day.date),
          availableDates: plan.days.map((day) => day.date),
          additions: [addition],
          summary: "1 missing priority can be added without moving your saved sessions.",
          rollover: null,
        }}
        onApplyWeekDraft={onApply}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Draft my week/ }));
    expect(screen.getByRole("heading", { name: "Review your drafted week" })).toBeInTheDocument();
    expect(screen.getByText("Entire proposed week")).toBeInTheDocument();
    expect(screen.getByText("Wall handstand · 3 sets · 10s")).toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Add 1 session" }));
    await waitFor(() => expect(onApply).toHaveBeenCalledWith([addition]));
  });
});
