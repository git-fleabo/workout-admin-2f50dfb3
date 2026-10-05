import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProgrammeRefreshCard } from "@/components/programme-refresh-card";
import type { ProgrammeAssignment, ProgrammeTemplate } from "@/lib/supabase-programmes.browser";
import type { WeeklyRecoveryRecommendation } from "@/lib/weekly-recovery";

const assignment: ProgrammeAssignment = {
  id: "assignment-1",
  programId: "programme-1",
  personId: "person-1",
  status: "active",
  currentWorkoutIndex: 0,
  startedOn: "2026-10-05",
  completedOn: null,
  notes: null,
  createdAt: "2026-10-01T00:00:00Z",
  cycleNumber: 1,
  previousAssignmentId: null,
  exercises: [
    {
      id: "mapping-1",
      slotKey: "squat",
      exerciseId: "exercise-1",
      exerciseName: "High Bar Squat",
      focusArea: "Lower Body",
      trainingMax: 100,
      enabled: true,
      loadAdjustmentPercent: 0,
      manualAdjustmentPercent: 0,
      manualAdjustedAt: null,
      lastDecision: "progress",
    },
  ],
  pools: [],
};

const template: ProgrammeTemplate = {
  id: "programme-1",
  name: "Adaptive strength",
  description: null,
  methodType: "adaptive_strength_12_week",
  durationWeeks: 12,
  sessionsPerWeek: 1,
  defaultSetChoice: "minimum",
  percentBase: "training_max",
  roundingIncrement: 2.5,
  workouts: [
    {
      id: "week-1-a",
      name: "Week 1 A",
      sequenceIndex: 0,
      weekNumber: 1,
      dayNumber: 1,
      sessionNumber: 1,
      description: null,
      entries: [
        {
          id: "entry-1",
          exerciseId: null,
          name: "Squat",
          slotKey: "squat",
          orderIndex: 0,
          sets: "3",
          reps: "5",
          minSets: 3,
          maxSets: 4,
          minReps: 5,
          maxReps: 6,
          intensityPercent: 75,
          intensityMinPercent: 75,
          intensityMaxPercent: 80,
          percentBase: "training_max",
          roundingIncrement: 5,
          isOptional: false,
          weight: null,
          duration: null,
          rpe: null,
          rpeCap: 8,
          selectionRole: null,
          rest: null,
          notes: null,
        },
      ],
    },
    {
      id: "week-2-a",
      name: "Week 2 A",
      sequenceIndex: 1,
      weekNumber: 2,
      dayNumber: 1,
      sessionNumber: 1,
      description: null,
      entries: [
        {
          id: "entry-2",
          exerciseId: null,
          name: "Squat",
          slotKey: "squat",
          orderIndex: 0,
          sets: "3",
          reps: "5",
          minSets: 3,
          maxSets: 4,
          minReps: 5,
          maxReps: 6,
          intensityPercent: 75,
          intensityMinPercent: 75,
          intensityMaxPercent: 80,
          percentBase: "training_max",
          roundingIncrement: 5,
          isOptional: false,
          weight: null,
          duration: null,
          rpe: null,
          rpeCap: 8,
          selectionRole: null,
          rest: null,
          notes: null,
        },
      ],
    },
  ],
};

const recovery: WeeklyRecoveryRecommendation = {
  level: "deload",
  title: "Consider a deload week",
  detail: "Repeated hard weeks support reducing strength work before reassessing.",
  evidence: ["Four hard days in the last fortnight"],
  hardDays: 4,
  decliningExercises: [],
  recentLoad: 8,
  priorLoad: 4,
  plannedLoad: 4,
  plannedDays: 3,
  effortCoverage: 80,
};

describe("strength programme review", () => {
  it("shows the exact prescription and applies the reviewed load and set choices", async () => {
    const onSave = vi.fn(async () => undefined);
    const onApplyReview = vi.fn(async () => undefined);
    const user = userEvent.setup();
    render(
      <ProgrammeRefreshCard
        assignment={assignment}
        template={template}
        recovery={recovery}
        appliedReview={null}
        saving={false}
        onSave={onSave}
        onApplyReview={onApplyReview}
      />,
    );

    expect(screen.getByText("Draft a lighter strength week")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Review exact week" }));

    expect(screen.getByText("Exact upcoming prescriptions")).toBeInTheDocument();
    expect(screen.getByText(/2 × 5 reps @ 70 kg/)).toBeInTheDocument();
    expect(screen.getByText(/Rest 150–180s/)).toBeInTheDocument();

    screen.getAllByRole("combobox")[1]!.focus();
    await user.keyboard("{Enter}{ArrowUp}{Enter}");
    expect(screen.getByText(/3 × 5 reps @ 70 kg/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Apply reviewed week" }));
    await waitFor(() =>
      expect(onApplyReview).toHaveBeenCalledWith(
        expect.objectContaining({
          programmeWeek: 1,
          recommendationKind: "reduce",
          exercises: [
            expect.objectContaining({
              assignmentExerciseId: "mapping-1",
              proposedManualAdjustmentPercent: -5,
              proposedSetAdjustment: 0,
            }),
          ],
        }),
      ),
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it("waits for the applied week, then drafts a restore from successful outcomes", async () => {
    const appliedReview = {
      id: "review-1",
      programmeWeek: 1,
      startWorkoutIndex: 0,
      endWorkoutIndex: 0,
      workoutIds: ["week-1-a"],
      recoveryLevel: "deload" as const,
      recommendationKind: "reduce" as const,
      exercises: [
        {
          assignmentExerciseId: "mapping-1",
          exerciseName: "High Bar Squat",
          automaticAdjustmentPercent: 0,
          manualAdjustmentPercent: -5,
          combinedAdjustmentPercent: -5,
          setAdjustment: -1,
        },
      ],
      appliedAt: "2026-10-05T08:00:00Z",
      outcomes: [],
    };
    const { rerender } = render(
      <ProgrammeRefreshCard
        assignment={assignment}
        template={template}
        recovery={recovery}
        appliedReview={appliedReview}
        saving={false}
        onSave={vi.fn()}
        onApplyReview={vi.fn()}
      />,
    );

    expect(screen.getByText("Strength review applied")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review exact week" })).not.toBeInTheDocument();

    rerender(
      <ProgrammeRefreshCard
        assignment={{ ...assignment, currentWorkoutIndex: 1 }}
        template={template}
        recovery={{ ...recovery, level: "normal", detail: "Recovery is stable." }}
        appliedReview={{
          ...appliedReview,
          outcomes: [
            {
              assignmentExerciseId: "mapping-1",
              workoutId: "week-1-a",
              decision: "progress",
              rpe: 7,
              technique: "good",
              pain: 0,
            },
          ],
        }}
        saving={false}
        onSave={vi.fn()}
        onApplyReview={vi.fn()}
      />,
    );

    expect(screen.getByText("Return to automatic strength progression")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review exact week" })).toBeInTheDocument();
  });
});
