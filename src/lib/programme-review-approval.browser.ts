import { getActiveProgrammeRefreshContextClient } from "./supabase-programmes.browser";
import {
  applyPersonalStrengthWeekReviewClient,
  applyProgrammeStrengthWeekReviewClient,
  getLatestProgrammeStrengthWeekReviewClient,
} from "./supabase-programme-strength-review.browser";
import type {
  ProgrammeStrengthWeekReview,
  StrengthProgrammeReview,
} from "./strength-programme-review";
import type { WeeklyRecoveryLevel } from "./weekly-recovery";

export type ProgrammeReviewContext = NonNullable<
  Awaited<ReturnType<typeof getActiveProgrammeRefreshContextClient>>
>;

// Both entry points approve the same reviewed snapshot. Server-side locks and
// revision checks remain authoritative after this fresh-read check.
export async function applyReviewedProgrammeWeekClient({
  context,
  review,
  recoveryLevel,
  appliedReview,
}: {
  context: ProgrammeReviewContext;
  review: StrengthProgrammeReview;
  recoveryLevel: WeeklyRecoveryLevel;
  appliedReview: ProgrammeStrengthWeekReview | null;
}) {
  const [latestContext, latestReview] = await Promise.all([
    getActiveProgrammeRefreshContextClient(),
    getLatestProgrammeStrengthWeekReviewClient(context.assignment.id),
  ]);
  if (
    JSON.stringify(latestContext) !== JSON.stringify(context) ||
    JSON.stringify(latestReview) !== JSON.stringify(appliedReview)
  ) {
    throw new Error(
      "The programme or its review changed since this preview. Close it and review the latest targets before applying.",
    );
  }
  if (
    Boolean(review.isPersonal) !== Boolean(context.assignment.personalProgramme) ||
    context.assignment.personalProgramme?.sessions.some((session) => session.plan.baseStrength)
  ) {
    throw new Error("Use the saved programme’s own progression review for these targets.");
  }
  return review.isPersonal
    ? applyPersonalStrengthWeekReviewClient(context.assignment.id, review, recoveryLevel)
    : applyProgrammeStrengthWeekReviewClient({
        assignmentId: context.assignment.id,
        programmeWeek: review.programmeWeek,
        startWorkoutIndex: review.startWorkoutIndex,
        endWorkoutIndex: review.endWorkoutIndex,
        workoutIds: review.sessions.map((session) => session.workoutId),
        recoveryLevel,
        recommendationKind: review.recommendationKind,
        previousReviewId: review.previousReviewId,
        adjustments: review.exercises.map((exercise) => ({
          exerciseId: exercise.assignmentExerciseId,
          manualAdjustmentPercent: exercise.proposedManualAdjustmentPercent,
          combinedAdjustmentPercent: exercise.proposedCombinedAdjustmentPercent,
          setAdjustment: exercise.proposedSetAdjustment,
        })),
      });
}
