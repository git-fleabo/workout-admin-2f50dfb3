import {
  readPersonalStrengthReviewSnapshots,
  personalStrengthOutcomes,
  type PersonalStrengthCompletedEntry,
} from "./personal-strength-review";
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

export type ActiveProgrammeStrengthVolumeReview = Pick<
  ProgrammeStrengthWeekReview,
  "startWorkoutIndex" | "endWorkoutIndex" | "exercises"
>;

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
    const personalKey = typeof source.personal_key === "string" ? source.personal_key : undefined;
    const assignmentExerciseId = personalKey ?? String(source.assignment_exercise_id ?? "");
    const exerciseName = String(source.exercise_name ?? "");
    const automaticAdjustmentPercent = personalKey
      ? 0
      : numberOrNull(source.automatic_adjustment_percent);
    const manualAdjustmentPercent = numberOrNull(
      personalKey ? source.load_adjustment_percent : source.manual_adjustment_percent,
    );
    const combinedAdjustmentPercent = personalKey
      ? manualAdjustmentPercent
      : numberOrNull(source.combined_adjustment_percent);
    const setAdjustment = numberOrNull(source.set_adjustment) ?? 0;
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
        personalKey,
        programmeKey: personalKey ? String(source.programme_key) : undefined,
        exerciseId: personalKey ? String(source.exercise_id) : undefined,
        exerciseName,
        automaticAdjustmentPercent,
        manualAdjustmentPercent,
        combinedAdjustmentPercent,
        setAdjustment,
      },
    ];
  });
}

export async function getActiveProgrammeStrengthVolumeReviewClient(
  assignmentId: string,
  personId: string,
): Promise<ActiveProgrammeStrengthVolumeReview | null> {
  const rows = await supabasePublicSelect<StrengthWeekReviewRow>(
    "programme_strength_week_reviews",
    {
      select: "start_workout_index,end_workout_index,applied_adjustments,applied_at",
      program_assignment_id: `eq.${assignmentId}`,
      person_id: `eq.${personId}`,
      status: "eq.active",
      order: "applied_at.desc",
      limit: 1,
    },
  );
  const row = rows[0];
  return row
    ? {
        startWorkoutIndex: row.start_workout_index,
        endWorkoutIndex: row.end_workout_index,
        exercises: readExercises(row.applied_adjustments),
      }
    : null;
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
  const personalSessions = readPersonalStrengthReviewSnapshots(row.applied_adjustments);
  const outcomes =
    !personalSessions.length && workoutIds.length
      ? await supabasePublicSelect<WorkoutReviewRow>("program_workout_reviews", {
          select: "program_assignment_exercise_id,program_workout_id,rpe,technique,pain,decision",
          program_assignment_id: `eq.${assignmentId}`,
          program_workout_id: `in.(${workoutIds.join(",")})`,
        })
      : [];
  const personalOutcomes: ProgrammeStrengthWeekOutcome[] = [];
  if (personalSessions.length) {
    const completed = await supabasePublicSelect<{
      program_workout_id: string;
      suggested_workout_entries: Array<{ target_metrics: Record<string, unknown> | null }>;
      completed_session: {
        completed: boolean;
        session_entries: PersonalStrengthCompletedEntry[];
      } | null;
    }>("suggested_workouts", {
      select:
        "program_workout_id,suggested_workout_entries(target_metrics),completed_session:sessions!suggested_workouts_completed_session_id_fkey!inner(completed,session_entries(exercise_id,order_index,completed,entry_sets(set_number,reps,weight,duration_seconds,rpe,completed,entry_set_segments(id)),entry_metrics(metric_key,metric_value,metric_text)))",
      person_id: `eq.${person.id}`,
      program_assignment_id: `eq.${assignmentId}`,
      program_workout_id: `in.(${workoutIds.join(",")})`,
      status: "eq.completed",
    });
    for (const workout of completed) {
      const snapshot = personalSessions.find(
        (item) => item.workoutId === workout.program_workout_id,
      );
      if (
        snapshot &&
        workout.completed_session?.completed &&
        workout.suggested_workout_entries.length &&
        workout.suggested_workout_entries.every(
          (entry) => entry.target_metrics?.strength_review_id === row.id,
        )
      ) {
        personalOutcomes.push(
          ...personalStrengthOutcomes(snapshot, workout.completed_session?.session_entries ?? []),
        );
      }
    }
  }
  return {
    personalSessions,
    id: row.id,
    programmeWeek: row.programme_week,
    startWorkoutIndex: row.start_workout_index,
    endWorkoutIndex: row.end_workout_index,
    workoutIds,
    recoveryLevel: row.recovery_level,
    recommendationKind: row.recommendation_kind,
    exercises: readExercises(row.applied_adjustments),
    appliedAt: row.applied_at,
    outcomes: [
      ...personalOutcomes,
      ...outcomes.map((outcome) => ({
        assignmentExerciseId: outcome.program_assignment_exercise_id,
        workoutId: outcome.program_workout_id,
        decision: outcome.decision,
        rpe: numberOrNull(outcome.rpe),
        technique: outcome.technique,
        pain: numberOrNull(outcome.pain),
      })),
    ],
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
    setAdjustment: number;
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
      set_adjustment: adjustment.setAdjustment,
    })),
    p_previous_review_id: input.previousReviewId,
  });
}

export async function applyPersonalStrengthWeekReviewClient(
  assignmentId: string,
  review: import("./strength-programme-review").StrengthProgrammeReview,
  recoveryLevel: WeeklyRecoveryLevel,
) {
  if (
    !review.isPersonal ||
    review.expectedCurrentWorkoutIndex == null ||
    review.sessions.some((session) => session.personalRevision == null)
  )
    throw new Error("Refresh the personal strength preview before applying it.");
  return supabasePublicRpc<string>("apply_personal_strength_week_review", {
    p_assignment_id: assignmentId,
    p_current_workout_index: review.expectedCurrentWorkoutIndex,
    p_sessions: review.sessions.map((session) => ({
      workout_id: session.workoutId,
      revision: session.personalRevision,
    })),
    p_recovery_level: recoveryLevel,
    p_recommendation_kind: review.recommendationKind,
    p_previous_review_id: review.previousReviewId,
    p_adjustments: review.exercises.map((exercise) => ({
      programme_key: exercise.programmeKey,
      exercise_id: exercise.exerciseId,
      load_adjustment_percent: exercise.proposedManualAdjustmentPercent,
      set_adjustment: exercise.proposedSetAdjustment,
    })),
  });
}
