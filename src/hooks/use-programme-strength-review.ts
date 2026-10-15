import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  applyReviewedProgrammeWeekClient,
  type ProgrammeReviewContext,
} from "@/lib/programme-review-approval.browser";
import { getLatestProgrammeStrengthWeekReviewClient } from "@/lib/supabase-programme-strength-review.browser";
import type { StrengthProgrammeReview } from "@/lib/strength-programme-review";
import type { WeeklyRecoveryRecommendation } from "@/lib/weekly-recovery";

export function useProgrammeStrengthReview(
  context: ProgrammeReviewContext | null | undefined,
  recovery: WeeklyRecoveryRecommendation | null,
) {
  const client = useQueryClient();
  const latest = useQuery({
    queryKey: ["programme-strength-week-review", context?.assignment.id],
    queryFn: () => getLatestProgrammeStrengthWeekReviewClient(context!.assignment.id),
    enabled: Boolean(context?.assignment.id),
    staleTime: 30_000,
  });
  const apply = useMutation({
    mutationFn: (review: StrengthProgrammeReview) => {
      if (!context || !recovery || !latest.isSuccess)
        throw new Error("Load the current programme and its evidence before applying a review.");
      return applyReviewedProgrammeWeekClient({
        context,
        review,
        recoveryLevel: recovery.level,
        appliedReview: latest.data,
      });
    },
    onSuccess: async () => {
      await Promise.all(
        [
          "programme-strength-week-review",
          "programme-refresh",
          "programme-schedule",
          "programme-workout-offers",
          "programme-assignments",
          "my-programme-overview",
          "programme-exercise-rule",
          "next-suggested-workouts",
          "scheduled-workout-plans",
          "weekly-review",
          "weekly-coach-rollover",
        ].map((key) => client.invalidateQueries({ queryKey: [key] })),
      );
      toast.success("Reviewed strength week applied", {
        description: "The coach will reassess it after the selected programme week is complete.",
      });
    },
    onError: async (error: Error) => {
      await Promise.all(
        ["programme-refresh", "programme-strength-week-review"].map((key) =>
          client.invalidateQueries({ queryKey: [key] }),
        ),
      );
      toast.error(error.message);
    },
  });
  return { latest, apply };
}
