import { ADAPTIVE_STRENGTH_METHOD, programmeWorkoutScheduledDate } from "./adaptive-strength.ts";
import { buildProgrammeMovementPrescription } from "./programme-prescription.ts";
import type {
  ProgrammeAssignment,
  ProgrammeAssignmentExercise,
  ProgrammeTemplate,
} from "./supabase-programmes.browser.ts";
import type { WeeklyRecoveryRecommendation } from "./weekly-recovery.ts";
import type { WorkoutPlanMovement } from "./workout-plan.ts";

export type StrengthProgrammeReviewExercise = {
  assignmentExerciseId: string;
  exerciseId: string;
  exerciseName: string;
  trainingMax: number;
  automaticAdjustmentPercent: number;
  currentManualAdjustmentPercent: number;
  proposedManualAdjustmentPercent: number;
  proposedCombinedAdjustmentPercent: number;
  reason: string;
};

export type StrengthProgrammeReviewMovement = {
  exerciseId: string;
  exerciseName: string;
  movement: WorkoutPlanMovement;
};

export type StrengthProgrammeReviewSession = {
  workoutId: string;
  workoutName: string;
  scheduledDate: string | null;
  sessionNumber: number | null;
  movements: StrengthProgrammeReviewMovement[];
};

export type StrengthProgrammeReview = {
  programmeWeek: number | null;
  title: string;
  detail: string;
  evidence: string[];
  exercises: StrengthProgrammeReviewExercise[];
  sessions: StrengthProgrammeReviewSession[];
  changedExerciseCount: number;
};

const SUPPORTED_MANUAL_ADJUSTMENTS = [-5, -2.5, 0, 2.5, 5] as const;

function clampManualAdjustment(value: number) {
  return SUPPORTED_MANUAL_ADJUSTMENTS.reduce((closest, option) =>
    Math.abs(option - value) < Math.abs(closest - value) ? option : closest,
  );
}

function recommendationForExercise(
  exercise: ProgrammeAssignmentExercise,
  recovery: WeeklyRecoveryRecommendation,
) {
  const automatic = exercise.loadAdjustmentPercent;
  if (recovery.level === "deload") {
    const combined = Math.min(automatic, -5);
    return {
      manual: clampManualAdjustment(combined - automatic),
      reason:
        automatic <= -5
          ? "The last exercise review already supplies the full five-point reduction."
          : "The weekly recovery review supports a five-point reduction from the programmed intensity.",
    };
  }
  if (recovery.level === "lighter") {
    const combined = Math.min(automatic, -2.5);
    return {
      manual: clampManualAdjustment(combined - automatic),
      reason:
        automatic <= -2.5
          ? "The last exercise review already supplies at least the proposed lighter loading."
          : "The weekly recovery review supports a small reduction from the programmed intensity.",
    };
  }
  return {
    manual: 0,
    reason:
      exercise.lastDecision === "regress"
        ? "Keep the automatic reduction from the last exercise review, without an extra weekly override."
        : exercise.lastDecision === "repeat"
          ? "Keep the automatic repeat adjustment from the last exercise review."
          : "Use the programme's automatic progression without an extra weekly override.",
  };
}

function reviewCopy(recovery: WeeklyRecoveryRecommendation) {
  if (recovery.level === "deload") {
    return {
      title: "Draft a lighter strength week",
      detail:
        "The coach has capped each lift at five percentage points below its programmed intensity. Review every exact prescription before applying it.",
    };
  }
  if (recovery.level === "lighter") {
    return {
      title: "Draft a small strength reduction",
      detail:
        "The coach has capped each lift at least 2.5 percentage points below its programmed intensity. Review every exact prescription before applying it.",
    };
  }
  return {
    title: "Keep the next strength week on plan",
    detail:
      "The current evidence does not support an extra weekly reduction. The preview retains any automatic exercise review and clears temporary manual overrides.",
  };
}

function targetWorkouts(assignment: ProgrammeAssignment, template: ProgrammeTemplate) {
  const remaining = template.workouts.filter(
    (workout) => workout.sequenceIndex >= assignment.currentWorkoutIndex,
  );
  const first = remaining[0];
  if (!first) return [];
  if (first.weekNumber != null) {
    return remaining.filter((workout) => workout.weekNumber === first.weekNumber);
  }
  return remaining.slice(0, Math.max(1, template.sessionsPerWeek ?? 1));
}

export function buildStrengthProgrammeReview({
  assignment,
  template,
  recovery,
  manualAdjustments,
}: {
  assignment: ProgrammeAssignment;
  template: ProgrammeTemplate;
  recovery: WeeklyRecoveryRecommendation;
  manualAdjustments?: Record<string, number>;
}): StrengthProgrammeReview | null {
  if (
    assignment.personalProgramme ||
    template.methodType !== ADAPTIVE_STRENGTH_METHOD ||
    template.id !== assignment.programId
  ) {
    return null;
  }

  const workouts = targetWorkouts(assignment, template);
  if (!workouts.length) return null;

  const exercises = assignment.exercises.flatMap<StrengthProgrammeReviewExercise>((exercise) => {
    if (!exercise.enabled || !exercise.exerciseId || exercise.trainingMax == null) return [];
    const recommendation = recommendationForExercise(exercise, recovery);
    const proposedManual = clampManualAdjustment(
      manualAdjustments?.[exercise.id] ?? recommendation.manual,
    );
    return [
      {
        assignmentExerciseId: exercise.id,
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        trainingMax: exercise.trainingMax,
        automaticAdjustmentPercent: exercise.loadAdjustmentPercent,
        currentManualAdjustmentPercent: exercise.manualAdjustmentPercent,
        proposedManualAdjustmentPercent: proposedManual,
        proposedCombinedAdjustmentPercent: exercise.loadAdjustmentPercent + proposedManual,
        reason: recommendation.reason,
      },
    ];
  });
  if (!exercises.length) return null;

  const reviewByAssignmentExerciseId = new Map(
    exercises.map((exercise) => [exercise.assignmentExerciseId, exercise]),
  );
  const assignmentBySlot = new Map(
    assignment.exercises.map((exercise) => [exercise.slotKey, exercise]),
  );
  const sessions = workouts.map<StrengthProgrammeReviewSession>((workout) => {
    const movements = workout.entries.flatMap<StrengthProgrammeReviewMovement>((entry) => {
      if (!entry.slotKey || entry.selectionRole) return [];
      const assignmentExercise = assignmentBySlot.get(entry.slotKey);
      const reviewExercise = assignmentExercise
        ? reviewByAssignmentExerciseId.get(assignmentExercise.id)
        : null;
      if (!assignmentExercise || !reviewExercise) return [];
      const movement = buildProgrammeMovementPrescription({
        entry,
        exercise: {
          ...assignmentExercise,
          manualAdjustmentPercent: reviewExercise.proposedManualAdjustmentPercent,
        },
        methodType: template.methodType,
        defaultSetChoice: template.defaultSetChoice,
      });
      return movement
        ? [
            {
              exerciseId: reviewExercise.exerciseId,
              exerciseName: reviewExercise.exerciseName,
              movement,
            },
          ]
        : [];
    });
    return {
      workoutId: workout.id,
      workoutName: workout.name,
      scheduledDate: programmeWorkoutScheduledDate(
        assignment.startedOn,
        workout.weekNumber,
        workout.dayNumber,
      ),
      sessionNumber: workout.sessionNumber,
      movements,
    };
  });
  if (sessions.some((session) => !session.movements.length)) return null;

  const copy = reviewCopy(recovery);
  return {
    programmeWeek: workouts[0]?.weekNumber ?? null,
    ...copy,
    evidence: recovery.evidence,
    exercises,
    sessions,
    changedExerciseCount: exercises.filter(
      (exercise) =>
        exercise.proposedManualAdjustmentPercent !== exercise.currentManualAdjustmentPercent,
    ).length,
  };
}
