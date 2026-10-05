import type {
  ProgrammeStrengthWeekReview,
  ProgrammeStrengthWeekReviewExercise,
  ProgrammeStrengthWeekOutcome,
  StrengthProgrammeRecommendationKind,
} from "./strength-programme-review";
import { getCurrentPerson } from "./supabase-people.browser";
import { supabasePublicRpc, supabasePublicSelect } from "./supabase-public";
import type { WeeklyRecoveryLevel } from "./weekly-recovery";

type StrengthWeekReviewRow = {
  id: string;
  programme_week: number | null;
  start_workout_index: number;
  end_workout_index: number;
  workout_ids: string[];
  recovery_level: WeeklyRecoveryLevel;
  recommendation_kind: StrengthProgrammeRecommendationKind;
  applied_adjustments: unknown;
  applied_at: string;
};

type WorkoutReviewRow = {
  program_assignment_exercise_id: string;
  program_workout_id: string;
  rpe: number | string | null;
  technique: ProgrammeStrengthWeekOutcome["technique"];
  pain: number | string | null;
  decision: ProgrammeStrengthWeekOutcome["decision"];
};

function numberOrNull(value: unknown) {
  if (value == null || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function readExercises(value: unknown): ProgrammeStrengthWeekReviewExercise[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const source = item as Record<string, unknown>;
    const assignmentExerciseId = String(source.assignment_exercise_id ?? "");
    const exerciseName = String(source.exercise_name ?? "");
    const automaticAdjustmentPercent = numberOrNull(source.automatic_adjustment_percent);
    const manualAdjustmentPercent = numberOrNull(source.manual_adjustment_percent);
    const combinedAdjustmentPercent = numberOrNull(source.combined_adjustment_percent);
    if (
      !assignmentExerciseId ||
      !exerciseName ||
      automaticAdjustmentPercent == null ||
      manualAdjustmentPercent == null ||
      combinedAdjustmentPercent == null
    ) {
      return [];
    }
    return [
      {
        assignmentExerciseId,
        exerciseName,
        automaticAdjustmentPercent,
        manualAdjustmentPercent,
        combinedAdjustmentPercent,
      },
    ];
  });
}

export async function getLatestProgrammeStrengthWeekReviewClient(
  assignmentId: string,
): Promise<ProgrammeStrengthWeekReview | null> {
  const person = await getCurrentPerson();
  if (!person) throw new Error("Connect your training profile first.");
  const rows = await supabasePublicSelect<StrengthWeekReviewRow>(
    "programme_strength_week_reviews",
    {
      select:
        "id,programme_week,start_workout_index,end_workout_index,workout_ids,recovery_level,recommendation_kind,applied_adjustments,applied_at",
      program_assignment_id: `eq.${assignmentId}`,
      person_id: `eq.${person.id}`,
      status: "eq.active",
      order: "applied_at.desc",
      limit: 1,
    },
  );
  const row = rows[0];
  if (!row) return null;
  const workoutIds = row.workout_ids ?? [];
  const outcomes = workoutIds.length
    ? await supabasePublicSelect<WorkoutReviewRow>("program_workout_reviews", {
        select: "program_assignment_exercise_id,program_workout_id,rpe,technique,pain,decision",
        program_assignment_id: `eq.${assignmentId}`,
        program_workout_id: `in.(${workoutIds.join(",")})`,
      })
    : [];
  return {
    id: row.id,
    programmeWeek: row.programme_week,
    startWorkoutIndex: row.start_workout_index,
    endWorkoutIndex: row.end_workout_index,
    workoutIds,
    recoveryLevel: row.recovery_level,
    recommendationKind: row.recommendation_kind,
    exercises: readExercises(row.applied_adjustments),
    appliedAt: row.applied_at,
    outcomes: outcomes.map((outcome) => ({
      assignmentExerciseId: outcome.program_assignment_exercise_id,
      workoutId: outcome.program_workout_id,
      decision: outcome.decision,
      rpe: numberOrNull(outcome.rpe),
      technique: outcome.technique,
      pain: numberOrNull(outcome.pain),
    })),
  };
}

export async function applyProgrammeStrengthWeekReviewClient(input: {
  assignmentId: string;
  programmeWeek: number | null;
  startWorkoutIndex: number;
  endWorkoutIndex: number;
  workoutIds: string[];
  recoveryLevel: WeeklyRecoveryLevel;
  recommendationKind: StrengthProgrammeRecommendationKind;
  previousReviewId: string | null;
  adjustments: Array<{
    exerciseId: string;
    manualAdjustmentPercent: number;
    combinedAdjustmentPercent: number;
  }>;
}) {
  return supabasePublicRpc<string>("apply_programme_strength_week_review", {
    p_assignment_id: input.assignmentId,
    p_programme_week: input.programmeWeek,
    p_start_workout_index: input.startWorkoutIndex,
    p_end_workout_index: input.endWorkoutIndex,
    p_workout_ids: input.workoutIds,
    p_recovery_level: input.recoveryLevel,
    p_recommendation_kind: input.recommendationKind,
    p_adjustments: input.adjustments.map((adjustment) => ({
      exercise_id: adjustment.exerciseId,
      manual_adjustment_percent: adjustment.manualAdjustmentPercent,
      combined_adjustment_percent: adjustment.combinedAdjustmentPercent,
    })),
    p_previous_review_id: input.previousReviewId,
  });
}
