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
  proposedSetAdjustment: number;
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
  startWorkoutIndex: number;
  endWorkoutIndex: number;
  recommendationKind: StrengthProgrammeRecommendationKind;
  previousReviewId: string | null;
  title: string;
  detail: string;
  evidence: string[];
  exercises: StrengthProgrammeReviewExercise[];
  sessions: StrengthProgrammeReviewSession[];
  changedExerciseCount: number;
};

export type StrengthProgrammeRecommendationKind = "keep" | "reduce" | "restore" | "hold" | "extend";

export type ProgrammeStrengthWeekReviewExercise = {
  assignmentExerciseId: string;
  exerciseName: string;
  automaticAdjustmentPercent: number;
  manualAdjustmentPercent: number;
  combinedAdjustmentPercent: number;
  setAdjustment: number;
};

export type ProgrammeStrengthWeekOutcome = {
  assignmentExerciseId: string;
  workoutId: string;
  decision: "progress" | "repeat" | "regress";
  rpe: number | null;
  technique: "good" | "acceptable" | "poor" | null;
  pain: number | null;
};

export type ProgrammeStrengthWeekReview = {
  id: string;
  programmeWeek: number | null;
  startWorkoutIndex: number;
  endWorkoutIndex: number;
  workoutIds: string[];
  recoveryLevel: WeeklyRecoveryRecommendation["level"];
  recommendationKind: StrengthProgrammeRecommendationKind;
  exercises: ProgrammeStrengthWeekReviewExercise[];
  appliedAt: string;
  outcomes: ProgrammeStrengthWeekOutcome[];
};

export function strengthSetAdjustmentForWorkout(
  review: Pick<
    ProgrammeStrengthWeekReview,
    "startWorkoutIndex" | "endWorkoutIndex" | "exercises"
  > | null,
  assignmentExerciseId: string,
  workoutIndex: number,
) {
  if (!review || workoutIndex < review.startWorkoutIndex || workoutIndex > review.endWorkoutIndex) {
    return 0;
  }
  return (
    review.exercises.find((exercise) => exercise.assignmentExerciseId === assignmentExerciseId)
      ?.setAdjustment ?? 0
  );
}

export type StrengthProgrammeReviewProposal = {
  recommendationKind: StrengthProgrammeRecommendationKind;
  previousReviewId: string | null;
  title: string;
  detail: string;
  evidence: string[];
  manualAdjustments: Record<string, number>;
  setAdjustments: Record<string, number>;
  exerciseReasons: Record<string, string>;
};

const SUPPORTED_MANUAL_ADJUSTMENTS = [-5, -2.5, 0, 2.5, 5] as const;

export function clampStrengthManualAdjustment(value: number) {
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
      manual: clampStrengthManualAdjustment(combined - automatic),
      reason:
        automatic <= -5
          ? "The last exercise review already supplies the full five-point reduction."
          : "The weekly recovery review supports a five-point reduction from the programmed intensity.",
    };
  }
  if (recovery.level === "lighter") {
    const combined = Math.min(automatic, -2.5);
    return {
      manual: clampStrengthManualAdjustment(combined - automatic),
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

function followUpPriority(kind: "restore" | "hold" | "extend") {
  if (kind === "extend") return 3;
  if (kind === "hold") return 2;
  return 1;
}

export function buildStrengthProgrammeFollowUpProposal({
  assignment,
  recovery,
  appliedReview,
}: {
  assignment: ProgrammeAssignment;
  recovery: WeeklyRecoveryRecommendation;
  appliedReview: ProgrammeStrengthWeekReview;
}): StrengthProgrammeReviewProposal | null {
  if (assignment.currentWorkoutIndex <= appliedReview.endWorkoutIndex) return null;

  const manualAdjustments: Record<string, number> = {};
  const setAdjustments: Record<string, number> = {};
  const exerciseReasons: Record<string, string> = {};
  const decisions: Array<"restore" | "hold" | "extend"> = [];
  const outcomeEvidence: string[] = [];

  for (const appliedExercise of appliedReview.exercises) {
    const exercise = assignment.exercises.find(
      (candidate) => candidate.id === appliedExercise.assignmentExerciseId,
    );
    if (!exercise?.enabled) continue;
    const outcomes = appliedReview.outcomes.filter(
      (outcome) => outcome.assignmentExerciseId === exercise.id,
    );
    const hasRegression = outcomes.some(
      (outcome) =>
        outcome.decision === "regress" ||
        outcome.technique === "poor" ||
        (outcome.pain != null && outcome.pain >= 4),
    );
    const allProgressed =
      outcomes.length > 0 && outcomes.every((outcome) => outcome.decision === "progress");
    let decision: "restore" | "hold" | "extend";
    let targetCombined = appliedExercise.combinedAdjustmentPercent;

    if (hasRegression) {
      decision = "extend";
      targetCombined = Math.min(targetCombined, -5);
      exerciseReasons[exercise.id] =
        "Pain, technique or effort evidence triggered a regression, so keep at least the full five-point reduction for another week.";
    } else if (allProgressed && recovery.level === "normal") {
      decision = "restore";
      manualAdjustments[exercise.id] = 0;
      setAdjustments[exercise.id] = 0;
      exerciseReasons[exercise.id] =
        "Every recorded exposure progressed and current recovery is stable, so remove the temporary weekly override.";
      decisions.push(decision);
      outcomeEvidence.push(`${exercise.exerciseName}: all reviewed exposures progressed`);
      continue;
    } else {
      decision = "hold";
      if (recovery.level === "deload") targetCombined = Math.min(targetCombined, -5);
      if (recovery.level === "lighter") targetCombined = Math.min(targetCombined, -2.5);
      exerciseReasons[exercise.id] = outcomes.length
        ? "The completed week did not provide clear evidence to restore full loading, so repeat the reviewed reduction."
        : "There is not enough exercise-level outcome evidence to remove the reviewed reduction yet.";
    }

    decisions.push(decision);
    manualAdjustments[exercise.id] = clampStrengthManualAdjustment(
      targetCombined - exercise.loadAdjustmentPercent,
    );
    setAdjustments[exercise.id] =
      decision === "extend" || recovery.level === "deload" ? -1 : appliedExercise.setAdjustment;
    const counts = outcomes.reduce(
      (result, outcome) => ({ ...result, [outcome.decision]: result[outcome.decision] + 1 }),
      { progress: 0, repeat: 0, regress: 0 },
    );
    outcomeEvidence.push(
      `${exercise.exerciseName}: ${counts.progress} progressed, ${counts.repeat} repeated, ${counts.regress} regressed`,
    );
  }

  if (!decisions.length) return null;
  const recommendationKind = decisions.reduce((strongest, decision) =>
    followUpPriority(decision) > followUpPriority(strongest) ? decision : strongest,
  );
  const copy =
    recommendationKind === "extend"
      ? {
          title: "Extend the lighter strength loading",
          detail:
            "At least one lift regressed during the reviewed week. The next draft keeps a conservative reduction while the automatic exercise review remains in force.",
        }
      : recommendationKind === "hold"
        ? {
            title: "Hold the reviewed strength adjustment",
            detail:
              "The completed week does not yet support removing every temporary reduction. The next draft repeats the proven loading for another week.",
          }
        : {
            title: "Return to automatic strength progression",
            detail:
              "The reviewed week progressed with stable current recovery. The next draft removes the temporary weekly overrides and retains each lift's automatic review.",
          };

  return {
    recommendationKind,
    previousReviewId: appliedReview.id,
    ...copy,
    evidence: [
      `Completed programme week ${appliedReview.programmeWeek ?? "review"}`,
      ...outcomeEvidence,
      `Current recovery: ${recovery.level}`,
    ],
    manualAdjustments,
    setAdjustments,
    exerciseReasons,
  };
}

function reviewCopy(recovery: WeeklyRecoveryRecommendation) {
  if (recovery.level === "deload") {
    return {
      title: "Draft a lighter strength week",
      detail:
        "The coach has capped each lift at five percentage points below its programmed intensity and removed one working set. Review every exact prescription before applying it.",
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
  setAdjustments,
  proposal,
}: {
  assignment: ProgrammeAssignment;
  template: ProgrammeTemplate;
  recovery: WeeklyRecoveryRecommendation;
  manualAdjustments?: Record<string, number>;
  setAdjustments?: Record<string, number>;
  proposal?: StrengthProgrammeReviewProposal | null;
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
  const targetSlotKeys = new Set(
    workouts.flatMap((workout) =>
      workout.entries.flatMap((entry) =>
        entry.slotKey && !entry.selectionRole ? [entry.slotKey] : [],
      ),
    ),
  );

  const exercises = assignment.exercises.flatMap<StrengthProgrammeReviewExercise>((exercise) => {
    if (
      !exercise.enabled ||
      !exercise.exerciseId ||
      exercise.trainingMax == null ||
      !targetSlotKeys.has(exercise.slotKey)
    ) {
      return [];
    }
    const recommendation = recommendationForExercise(exercise, recovery);
    const proposedManual = clampStrengthManualAdjustment(
      manualAdjustments?.[exercise.id] ??
        proposal?.manualAdjustments[exercise.id] ??
        recommendation.manual,
    );
    const proposedSetAdjustment = Math.max(
      -1,
      Math.min(
        0,
        Math.trunc(
          setAdjustments?.[exercise.id] ??
            proposal?.setAdjustments[exercise.id] ??
            (recovery.level === "deload" ? -1 : 0),
        ),
      ),
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
        proposedSetAdjustment,
        reason: proposal?.exerciseReasons[exercise.id] ?? recommendation.reason,
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
        setAdjustment: reviewExercise.proposedSetAdjustment,
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

  const copy = proposal ?? {
    ...reviewCopy(recovery),
    recommendationKind: recovery.level === "normal" ? ("keep" as const) : ("reduce" as const),
    previousReviewId: null,
    evidence: recovery.evidence,
  };
  return {
    programmeWeek: workouts[0]?.weekNumber ?? null,
    startWorkoutIndex: workouts[0]!.sequenceIndex,
    endWorkoutIndex: workouts[workouts.length - 1]!.sequenceIndex,
    recommendationKind: copy.recommendationKind,
    previousReviewId: copy.previousReviewId,
    title: copy.title,
    detail: copy.detail,
    evidence: copy.evidence,
    exercises,
    sessions,
    changedExerciseCount: exercises.filter(
      (exercise) =>
        exercise.proposedManualAdjustmentPercent !== exercise.currentManualAdjustmentPercent ||
        exercise.proposedSetAdjustment !== 0,
    ).length,
  };
}
